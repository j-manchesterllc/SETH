export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getGmailClient } from '@/lib/google-api'

/**
 * GET /api/email — List emails from inbox
 * Query params: maxResults (default 15), q (Gmail search query), label (INBOX/UNREAD/STARRED)
 *
 * POST /api/email — Triage actions on emails
 * Body: { action, messageId, labelIds?, replyText? }
 * Actions: archive, star, unstar, markRead, markUnread, trash, label, reply
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const gmail = await getGmailClient(request)
    if (!gmail) {
      return Response.json(
        { error: 'Gmail not connected. Please sign in with Google to enable email access.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const maxResults = Math.min(parseInt(searchParams.get('maxResults') ?? '15', 10), 50)
    const query = searchParams.get('q') ?? ''
    const label = searchParams.get('label') ?? 'INBOX'

    // List message IDs
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: query || undefined,
      labelIds: [label],
    })

    const messageIds = listRes.data.messages ?? []
    if (messageIds.length === 0) {
      return Response.json({ emails: [], count: 0 })
    }

    // Fetch full message details (batch via individual gets — Gmail API doesn't have native batch in REST)
    const emails = await Promise.all(
      messageIds.slice(0, maxResults).map(async (msg) => {
        try {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date', 'Cc'],
          })

          const headers = detail.data.payload?.headers ?? []
          const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null

          return {
            id: detail.data.id,
            threadId: detail.data.threadId,
            snippet: detail.data.snippet ?? '',
            from: getHeader('From'),
            to: getHeader('To'),
            cc: getHeader('Cc'),
            subject: getHeader('Subject') ?? '(No subject)',
            date: getHeader('Date'),
            labelIds: detail.data.labelIds ?? [],
            isUnread: (detail.data.labelIds ?? []).includes('UNREAD'),
            isStarred: (detail.data.labelIds ?? []).includes('STARRED'),
            isImportant: (detail.data.labelIds ?? []).includes('IMPORTANT'),
            sizeEstimate: detail.data.sizeEstimate,
          }
        } catch (err) {
          return null
        }
      })
    )

    const validEmails = emails.filter(Boolean)

    return Response.json({
      emails: validEmails,
      count: validEmails.length,
      resultSizeEstimate: listRes.data.resultSizeEstimate ?? 0,
    })
  } catch (error: any) {
    console.error('[Email] GET error:', error?.message)
    if (error?.code === 401 || error?.message?.includes('invalid_grant')) {
      return Response.json(
        { error: 'Google token expired. Please sign out and sign in with Google again.' },
        { status: 401 }
      )
    }
    return Response.json({ error: 'Failed to fetch emails' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const gmail = await getGmailClient(request)
    if (!gmail) {
      return Response.json(
        { error: 'Gmail not connected. Please sign in with Google.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, messageId, labelIds, replyText } = body ?? {}

    if (!action || !messageId) {
      return Response.json({ error: 'action and messageId are required' }, { status: 400 })
    }

    switch (action) {
      case 'archive': {
        await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: { removeLabelIds: ['INBOX'] },
        })
        return Response.json({ success: true, action: 'archived' })
      }

      case 'star': {
        await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: { addLabelIds: ['STARRED'] },
        })
        return Response.json({ success: true, action: 'starred' })
      }

      case 'unstar': {
        await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: { removeLabelIds: ['STARRED'] },
        })
        return Response.json({ success: true, action: 'unstarred' })
      }

      case 'markRead': {
        await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: { removeLabelIds: ['UNREAD'] },
        })
        return Response.json({ success: true, action: 'marked_read' })
      }

      case 'markUnread': {
        await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: { addLabelIds: ['UNREAD'] },
        })
        return Response.json({ success: true, action: 'marked_unread' })
      }

      case 'trash': {
        await gmail.users.messages.trash({
          userId: 'me',
          id: messageId,
        })
        return Response.json({ success: true, action: 'trashed' })
      }

      case 'label': {
        if (!labelIds || !Array.isArray(labelIds)) {
          return Response.json({ error: 'labelIds array required for label action' }, { status: 400 })
        }
        await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: { addLabelIds: labelIds },
        })
        return Response.json({ success: true, action: 'labeled', labelIds })
      }

      case 'reply': {
        if (!replyText) {
          return Response.json({ error: 'replyText required for reply action' }, { status: 400 })
        }

        // Get original message for threading
        const original = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Message-ID'],
        })

        const headers = original.data.payload?.headers ?? []
        const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''

        const toEmail = getHeader('From')
        const subject = getHeader('Subject')
        const messageIdHeader = getHeader('Message-ID')
        const userEmail = session.user?.email ?? 'me'

        const rawEmail = [
          `From: ${userEmail}`,
          `To: ${toEmail}`,
          `Subject: Re: ${subject.replace(/^Re:\s*/i, '')}`,
          `In-Reply-To: ${messageIdHeader}`,
          `References: ${messageIdHeader}`,
          'Content-Type: text/plain; charset=utf-8',
          '',
          replyText,
        ].join('\r\n')

        const encoded = Buffer.from(rawEmail).toString('base64url')

        await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encoded,
            threadId: original.data.threadId ?? undefined,
          },
        })

        return Response.json({ success: true, action: 'replied', to: toEmail })
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[Email] POST error:', error?.message)
    return Response.json({ error: 'Email action failed' }, { status: 500 })
  }
}

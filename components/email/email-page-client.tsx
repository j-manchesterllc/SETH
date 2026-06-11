'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Mail,
  Search,
  Loader2,
  RefreshCw,
  Star,
  Archive,
  Trash2,
  MailOpen,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface EmailMessage {
  id: string
  threadId: string
  subject: string
  from: string
  snippet: string
  date: string
  isUnread: boolean
  isStarred: boolean
  labels: string[]
}

export function EmailPageClient() {
  const { data: session } = useSession() || {}
  const [emails, setEmails] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actioning, setActioning] = useState<string | null>(null)

  const googleConnected = (session?.user as any)?.googleConnected
  const googleError = (session?.user as any)?.googleError

  const fetchEmails = useCallback(async (query?: string) => {
    if (!googleConnected) { setLoading(false); return }
    query ? setSearching(true) : setLoading(true)
    try {
      const url = query ? `/api/email?query=${encodeURIComponent(query)}` : '/api/email?maxResults=30'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch emails')
      const data = await res.json()
      setEmails(data.emails ?? [])
    } catch (err) {
      toast.error('Failed to load emails')
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }, [googleConnected])

  useEffect(() => {
    fetchEmails()
  }, [fetchEmails])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchEmails(searchQuery || undefined)
  }

  const triageAction = async (emailId: string, action: string) => {
    setActioning(`${emailId}-${action}`)
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, emailId }),
      })
      if (!res.ok) throw new Error(`Failed to ${action}`)
      toast.success(`Email ${action === 'archive' ? 'archived' : action === 'trash' ? 'trashed' : action === 'star' ? 'starred' : action === 'unstar' ? 'unstarred' : action === 'markRead' ? 'marked read' : 'updated'}`)
      // Update local state
      if (action === 'archive' || action === 'trash') {
        setEmails(prev => prev.filter(e => e.id !== emailId))
      } else if (action === 'star') {
        setEmails(prev => prev.map(e => e.id === emailId ? { ...e, isStarred: true } : e))
      } else if (action === 'unstar') {
        setEmails(prev => prev.map(e => e.id === emailId ? { ...e, isStarred: false } : e))
      } else if (action === 'markRead') {
        setEmails(prev => prev.map(e => e.id === emailId ? { ...e, isUnread: false } : e))
      } else if (action === 'markUnread') {
        setEmails(prev => prev.map(e => e.id === emailId ? { ...e, isUnread: true } : e))
      } else {
        fetchEmails(searchQuery || undefined)
      }
    } catch (err) {
      toast.error(`Failed to ${action} email`)
    } finally {
      setActioning(null)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      const now = new Date()
      const isToday = d.toDateString() === now.toDateString()
      if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    } catch { return '' }
  }

  if (!googleConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Gmail Not Connected</h2>
            <p className="text-muted-foreground text-sm">
              {googleError === 'RefreshFailed'
                ? 'Your Google session has expired. Please sign out and sign back in with Google to reconnect Gmail access.'
                : 'Sign in with Google (with Gmail permissions) to view and manage your emails.'}
            </p>
            <Button variant="outline" asChild>
              <Link href="/profile">Go to Profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Email</h1>
            <span className="text-xs text-muted-foreground">{emails.length} messages</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => fetchEmails(searchQuery || undefined)} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search emails... (e.g. from:boss subject:urgent)"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" disabled={searching}>
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </Button>
        </form>
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Mail className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm">No emails found</p>
          </div>
        ) : (
          <div className="divide-y">
            {emails.map((email, i) => (
              <motion.div
                key={email.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
              >
                <div
                  className={cn(
                    'px-6 py-3 hover:bg-muted/30 transition-colors cursor-pointer',
                    email.isUnread && 'bg-primary/[0.03]'
                  )}
                  onClick={() => setExpandedId(expandedId === email.id ? null : email.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
                      {email.isStarred && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />}
                      {email.isUnread && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cn('text-sm truncate', email.isUnread ? 'font-semibold' : 'font-medium')}>
                          {email.from}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(email.date)}</span>
                      </div>
                      <p className={cn('text-sm truncate', email.isUnread ? 'font-medium' : 'text-muted-foreground')}>
                        {email.subject || '(no subject)'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{email.snippet}</p>
                    </div>
                    <div className="shrink-0 pt-1">
                      {expandedId === email.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded actions */}
                  {expandedId === email.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="flex items-center gap-1.5 mt-3 pl-7 flex-wrap"
                      onClick={e => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 text-xs gap-1"
                        disabled={actioning === `${email.id}-archive`}
                        onClick={() => triageAction(email.id, 'archive')}
                      >
                        <Archive className="w-3.5 h-3.5" /> Archive
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 text-xs gap-1"
                        disabled={actioning === `${email.id}-${email.isStarred ? 'unstar' : 'star'}`}
                        onClick={() => triageAction(email.id, email.isStarred ? 'unstar' : 'star')}
                      >
                        <Star className={cn('w-3.5 h-3.5', email.isStarred && 'fill-yellow-500 text-yellow-500')} />
                        {email.isStarred ? 'Unstar' : 'Star'}
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 text-xs gap-1"
                        disabled={actioning === `${email.id}-${email.isUnread ? 'markRead' : 'markUnread'}`}
                        onClick={() => triageAction(email.id, email.isUnread ? 'markRead' : 'markUnread')}
                      >
                        <MailOpen className="w-3.5 h-3.5" />
                        {email.isUnread ? 'Mark Read' : 'Mark Unread'}
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                        disabled={actioning === `${email.id}-trash`}
                        onClick={() => triageAction(email.id, 'trash')}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Trash
                      </Button>
                      {email.labels.filter(l => !['INBOX','UNREAD','STARRED','IMPORTANT','CATEGORY_PRIMARY','CATEGORY_SOCIAL','CATEGORY_PROMOTIONS','CATEGORY_UPDATES','CATEGORY_FORUMS'].includes(l)).map(label => (
                        <Badge key={label} variant="secondary" className="text-[10px]">{label}</Badge>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

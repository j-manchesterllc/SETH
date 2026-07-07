export const dynamic = 'force-dynamic'
export const revalidate = 0
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { analyzePatterns } from '@/lib/cortex'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const newPatterns = await analyzePatterns(session.user.id)
    return NextResponse.json({ success: true, newPatterns })
  } catch (error) {
    console.error('[Cortex] Analyze error:', error)
    return NextResponse.json({ error: 'Failed to analyze patterns' }, { status: 500 })
  }
}

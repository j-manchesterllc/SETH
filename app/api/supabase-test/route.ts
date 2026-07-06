import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export async function GET() {
  try {
    const count = await prisma.agent.count();
    return new Response(JSON.stringify({ agentCount: count, timestamp: Date.now() }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Supabase test error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

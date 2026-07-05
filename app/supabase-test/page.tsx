import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';
export default async function Page() {
  try {
    const count = await prisma.agent.count();
    const now = Date.now();
    return new Response(
      JSON.stringify({ agentCount: count, timestamp: now }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Supabase test error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

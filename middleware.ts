import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from './utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request)

  // Refresh session if needed (keeps cookies alive)
  await supabase.auth.getSession()

  // Add custom auth logic here if required
  // e.g., redirect unauthenticated users from /dashboard

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

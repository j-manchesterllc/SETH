import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Import the Supabase client creation function from utils
import { createClient } from "./utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Create Supabase client configured for middleware
  const supabase = createClient(request);

  // Refresh session if expired - required for Server Components
  await supabase.auth.getSession();

  // Continue with the request
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     */
    "/((?!_static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
  runtime: 'nodejs',
};

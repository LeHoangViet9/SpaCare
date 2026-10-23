import { NextResponse } from 'next/server.js';
import type { NextRequest } from 'next/server.js';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionToken = request.cookies.get('spacare_session')?.value;

  // Protect workspace and customer routes if unauthenticated
  const isWorkspace = pathname === '/workspace' || pathname.startsWith('/workspace/');
  const isCustomer = pathname === '/customer' || pathname.startsWith('/customer/');

  if ((isWorkspace || isCustomer) && !sessionToken) {
    const returnTo = encodeURIComponent(pathname + search);
    const loginUrl = new URL(`/login?returnTo=${returnTo}`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/workspace',
    '/workspace/:path*',
    '/customer',
    '/customer/:path*',
  ],
};

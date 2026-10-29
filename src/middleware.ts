import { NextResponse } from 'next/server.js';
import type { NextRequest } from 'next/server.js';
import { isWriteFrozen, maintenanceResponse } from './lib/write-freeze.ts';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionToken = request.cookies.get('spacare_session')?.value;

  if (isWriteFrozen() && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    return maintenanceResponse(request.headers.get('x-request-id') || undefined);
  }

  // Protect workspace and customer routes if unauthenticated
  const isWorkspace = pathname === '/workspace' || pathname.startsWith('/workspace/');
  const isCustomer = pathname === '/customer' || pathname.startsWith('/customer/');

  if (isWriteFrozen() && pathname !== '/maintenance' && (isWorkspace || isCustomer || pathname === '/booking')) {
    return NextResponse.rewrite(new URL('/maintenance', request.url));
  }

  if ((isWorkspace || isCustomer) && !sessionToken) {
    const returnTo = encodeURIComponent(pathname + search);
    const loginUrl = new URL(`/login?returnTo=${returnTo}`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/workspace',
    '/workspace/:path*',
    '/customer',
    '/customer/:path*',
    '/booking',
    '/booking/:path*',
  ],
};

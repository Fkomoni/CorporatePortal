import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isLoggedIn = !!session;
  const loginType = (session?.user as { loginType?: string })?.loginType;

  // Never intercept API routes — they handle their own auth
  if (pathname.startsWith('/api/')) return NextResponse.next();

  const isAdminRoute  = pathname.startsWith('/admin');
  // /verify-registration is a public page — let unauthenticated users through
  const isPortalRoute = !isAdminRoute && !pathname.startsWith('/login') && pathname !== '/verify-registration';
  const isStaffLogin  = pathname === '/admin/login';
  const isHrLogin     = pathname === '/login';

  // Staff trying to access admin area but not logged in → admin/login
  if (isAdminRoute && !isStaffLogin && !isLoggedIn) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  // HR trying to access portal but not logged in → /login
  if (isPortalRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // HR user trying to reach admin → redirect to portal dashboard
  if (isAdminRoute && !isStaffLogin && isLoggedIn && loginType !== 'staff') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Staff trying to reach portal → redirect to admin
  if (isPortalRoute && isLoggedIn && loginType === 'staff') {
    return NextResponse.redirect(new URL('/admin/corporates', req.url));
  }

  // Already logged in HR user hitting /login → dashboard
  if (isHrLogin && isLoggedIn && loginType !== 'staff') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Already logged in staff hitting /admin/login → admin
  if (isStaffLogin && isLoggedIn && loginType === 'staff') {
    return NextResponse.redirect(new URL('/admin/corporates', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|leadway-logo.jpeg).*)'],
};

import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/api/auth');

  if (!isLoggedIn && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isLoggedIn && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|leadway-logo.jpeg).*)'],
};

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { moduleForPath, canAccessModule } from '@/lib/roles';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isLoggedIn = !!session;
  const loginType = (session?.user as { loginType?: string })?.loginType;

  // Never intercept API routes — they handle their own auth
  if (pathname.startsWith('/api/')) return NextResponse.next();

  const isAdminRoute  = pathname === '/admin' || pathname.startsWith('/admin/');
  // /verify-registration, /enroll/* and /respond/* are public — unauthenticated
  // users must reach them freely. /respond/* is where Leadway staff answer a
  // service request from the emailed link: they hold no portal login, so it sits
  // at its own top-level path rather than under /service-desk, where a future
  // change to the portal's rules could silently expose or block it.
  const isPublicPage  = pathname === '/verify-registration' || pathname === '/accept-invite' || pathname === '/enroll' || pathname.startsWith('/enroll/') || pathname.startsWith('/respond/');
  const isPortalRoute = !isAdminRoute && !pathname.startsWith('/login') && !isPublicPage;
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

  // HR user whose role doesn't grant access to this module (e.g. a Finance
  // role hitting /members) → bounce to dashboard rather than leak the page.
  if (isPortalRoute && isLoggedIn && loginType !== 'staff') {
    const role = (session?.user as { role?: string })?.role;
    const mod = moduleForPath(pathname);
    if (mod && !canAccessModule(role, mod)) {
      return NextResponse.redirect(new URL('/dashboard?denied=1', req.url));
    }
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
  // Static assets in /public must bypass auth: next/image's internal fetch of
  // the source file carries no session cookie, and logged-out pages (login,
  // emails) reference these too — a redirect here turns them into broken
  // images. Excluded by extension so new assets don't need to be listed.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|svg|webp|ico)$).*)'],
};

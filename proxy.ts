import { NextResponse, type NextRequest } from 'next/server';

const REQUIRED_AUTH_COOKIES = ['auth_account_id', 'auth_session_id', 'auth_session_key'] as const;

function hasAuthCookies(request: NextRequest) {
  return REQUIRED_AUTH_COOKIES.every((name) => {
    const value = request.cookies.get(name)?.value;
    return Boolean(value && value.trim());
  });
}

export default function proxy(request: NextRequest) {
  // Is it an API request to the bridge? If so, we want to return a 401 if the auth cookies are missing.
  if (!request.nextUrl.pathname.startsWith('/bridge/')) {

    // Check if the required auth cookies are present. If so, allow the request to proceed. Otherwise, redirect to the auth start page.
    if (hasAuthCookies(request)) {
      return NextResponse.next();
    } else {
      return NextResponse.redirect(new URL('https://neupgroup.com/account/auth/start'));
    }
  }

}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};


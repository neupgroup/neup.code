import { NextRequest, NextResponse } from 'next/server';

const REQUIRED_AUTH_COOKIES = ['auth_account_id', 'auth_session_id', 'auth_session_key'] as const;

function hasAuthCookies(request: NextRequest) {
  return REQUIRED_AUTH_COOKIES.every((name) => {
    const value = request.cookies.get(name)?.value;
    return Boolean(value && value.trim());
  });
}

export default function proxy(request: NextRequest) {
  if (hasAuthCookies(request)) {
    return NextResponse.next();
  }

  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  return NextResponse.redirect(
    new URL(
      'https://neupgroup.com/account/auth/start?appid=neupcode&redirectsTo=' +
        encodeURIComponent(request.nextUrl.href),
    ),
  );
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};

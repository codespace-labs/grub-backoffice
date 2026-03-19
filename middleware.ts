import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "./lib/auth-constants";

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const hasToken = Boolean(req.cookies.get(ACCESS_TOKEN_COOKIE)?.value);
  const isLoginRoute = pathname === "/login";

  if (!hasToken && !isLoginRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (hasToken && isLoginRoute) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(req: NextRequest) {
  // Open mode — no JWT_SECRET configured, allow everything through
  if (!process.env.JWT_SECRET) return NextResponse.next();

  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const cookie = req.cookies.get("nexus_session")?.value;

  if (cookie) {
    try {
      await jwtVerify(cookie, secret);
      return NextResponse.next();
    } catch {
      // Expired or tampered — fall through to redirect
    }
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};

import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";

const secret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET ?? "nexuspay-dev-secret-change-in-production"
  );

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const expected = process.env.DASHBOARD_PASSWORD;

    // In production, DASHBOARD_PASSWORD must be set
    if (!expected) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { success: false, error: "DASHBOARD_PASSWORD not configured on server" },
          { status: 500 }
        );
      }
      // Dev with no password set — any input works (shows a warning in logs)
      console.warn("[Auth] DASHBOARD_PASSWORD not set — allowing dev login");
    } else if (password !== expected) {
      // Consistent timing to prevent enumeration
      await new Promise((r) => setTimeout(r, 400));
      return NextResponse.json(
        { success: false, error: "Invalid password" },
        { status: 401 }
      );
    }

    const token = await new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secret());

    const res = NextResponse.json({ success: true });
    res.cookies.set("nexus_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.json({ success: false, error: "Login failed" }, { status: 500 });
  }
}

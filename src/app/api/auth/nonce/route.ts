import { NextResponse } from "next/server";

export async function GET() {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const res = NextResponse.json({ nonce });
  res.cookies.set("nexus_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300, // 5 minutes
    path: "/",
  });
  return res;
}

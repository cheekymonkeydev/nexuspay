import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { SignJWT } from "jose";

export async function POST(req: NextRequest) {
  if (!process.env.JWT_SECRET) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 501 });
  }

  const { address, message, signature } = await req.json();

  if (!address || !message || !signature) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Validate nonce matches what we issued
  const nonce = req.cookies.get("nexus_nonce")?.value;
  if (!nonce || !message.includes(nonce)) {
    return NextResponse.json({ error: "Invalid or expired nonce" }, { status: 400 });
  }

  // Verify the wallet actually signed this message
  let valid = false;
  try {
    valid = await verifyMessage({ address, message, signature });
  } catch {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Issue 7-day session JWT
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const token = await new SignJWT({ sub: address, address })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const res = NextResponse.json({ ok: true, address });
  res.cookies.set("nexus_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  res.cookies.delete("nexus_nonce");
  return res;
}

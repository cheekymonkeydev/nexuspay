import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function GET(req: NextRequest) {
  if (!process.env.JWT_SECRET) {
    return NextResponse.json({ address: null, open: true });
  }
  const cookie = req.cookies.get("nexus_session")?.value;
  if (!cookie) return NextResponse.json({ address: null }, { status: 401 });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(cookie, secret);
    return NextResponse.json({ address: payload.address as string });
  } catch {
    return NextResponse.json({ address: null }, { status: 401 });
  }
}

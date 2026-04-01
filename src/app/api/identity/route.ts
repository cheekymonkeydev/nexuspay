import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { RegisterCredentialInput } from "@/lib/types";
import { ok, err, handleError, nanoid } from "@/lib/utils";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

export async function GET(req: NextRequest) {
  try {
    const agentId = req.nextUrl.searchParams.get("agentId");
    const where = agentId ? { agentId } : {};
    const creds = await prisma.agentCredential.findMany({ where, orderBy: { createdAt: "desc" } });
    return ok(creds);
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = RegisterCredentialInput.parse(body);

    const wallet = await prisma.agentWallet.findUnique({ where: { agentId: input.agentId } });
    if (!wallet) return err("Agent wallet not found", 404);

    const did = `did:nexuspay:${nanoid(16)}`;
    const jwt = await new SignJWT({ sub: input.agentId, did, label: input.label })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer("nexuspay")
      .setExpirationTime("365d")
      .sign(JWT_SECRET);

    const cred = await prisma.agentCredential.create({
      data: { agentId: input.agentId, label: input.label, publicKey: input.publicKey, did, jwt },
    });

    return ok(cred);
  } catch (e) { return handleError(e); }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

export async function POST(req: NextRequest) {
  try {
    const { jwt } = await req.json();
    if (!jwt) return err("JWT required");

    const { payload } = await jwtVerify(jwt, JWT_SECRET, { issuer: "nexuspay" });
    const agentId = payload.sub;
    const did = payload.did as string;

    // Check revocation
    const cred = await prisma.agentCredential.findFirst({ where: { agentId, did } });
    if (!cred) return err("Credential not found", 404);
    if (cred.isRevoked) return err("Credential has been revoked", 403);

    return ok({ verified: true, agentId, did, label: cred.label });
  } catch (e) {
    if (e instanceof Error && e.message.includes("expired")) return err("JWT expired", 401);
    return handleError(e);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { CreateApiKeyInput } from "@/lib/types";
import { ok, err, handleError, nanoid, sha256 } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "keys:write")) return err("Missing scope: keys:write", 403);
  try {
    const body = await req.json();
    const input = CreateApiKeyInput.parse(body);

    const rawKey = `nxp_${nanoid(40)}`;
    const prefix = rawKey.slice(0, 8);
    const keyHash = await sha256(rawKey);

    await prisma.apiKey.create({
      data: { name: input.name, keyHash, prefix, scopes: input.scopes },
    });

    // Return the raw key ONCE — it's hashed in DB and can never be retrieved again
    return ok({ key: rawKey, prefix, name: input.name, scopes: input.scopes });
  } catch (e) { return handleError(e); }
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "keys:read")) return err("Missing scope: keys:read", 403);
  try {
    const keys = await prisma.apiKey.findMany({
      select: { id: true, name: true, prefix: true, scopes: true, isActive: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return ok(keys);
  } catch (e) { return handleError(e); }
}

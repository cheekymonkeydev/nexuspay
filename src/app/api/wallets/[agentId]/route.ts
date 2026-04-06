import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "wallets:read")) return err("Missing scope: wallets:read", 403);
  try {
    const { agentId } = await params;
    const wallet = await prisma.agentWallet.findUnique({ where: { agentId } });
    if (!wallet) return err("Wallet not found", 404);
    return ok(wallet);
  } catch (e) { return handleError(e); }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "wallets:write")) return err("Missing scope: wallets:write", 403);
  try {
    const { agentId } = await params;
    const body = await req.json();

    const wallet = await prisma.agentWallet.findUnique({ where: { agentId } });
    if (!wallet) return err("Wallet not found", 404);
    if (wallet.status === "REVOKED") return err("Revoked wallets cannot be modified", 403);

    const updateData: Record<string, unknown> = {};

    // Status toggle
    if (body.status !== undefined) {
      if (!["ACTIVE", "SUSPENDED"].includes(body.status)) {
        return err("Status must be ACTIVE or SUSPENDED", 400);
      }
      updateData.status = body.status;
    }

    // Auto top-up settings
    if (body.autoTopUpEnabled !== undefined) updateData.autoTopUpEnabled = Boolean(body.autoTopUpEnabled);
    if (body.topUpThreshold !== undefined) updateData.topUpThreshold = body.topUpThreshold === null ? null : Number(body.topUpThreshold);
    if (body.topUpAmount !== undefined) updateData.topUpAmount = body.topUpAmount === null ? null : Number(body.topUpAmount);

    const updated = await prisma.agentWallet.update({
      where: { agentId },
      data: updateData,
    });

    return ok(updated);
  } catch (e) { return handleError(e); }
}

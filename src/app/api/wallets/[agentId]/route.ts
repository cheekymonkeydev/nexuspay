import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  if (!await authenticate(req)) return err("Unauthorized", 401);
  try {
    const { agentId } = await params;
    const { status } = await req.json();

    if (!["ACTIVE", "SUSPENDED"].includes(status)) {
      return err("Status must be ACTIVE or SUSPENDED", 400);
    }

    const wallet = await prisma.agentWallet.findUnique({ where: { agentId } });
    if (!wallet) return err("Wallet not found", 404);
    if (wallet.status === "REVOKED") return err("Revoked wallets cannot be modified", 403);

    const updated = await prisma.agentWallet.update({
      where: { agentId },
      data: { status },
    });

    return ok(updated);
  } catch (e) { return handleError(e); }
}

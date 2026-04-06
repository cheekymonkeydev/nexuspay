/**
 * POST /api/transactions/[id]/reject
 *
 * Reject a transaction that is held pending manual review.
 * Refunds the held USDC back to the agent wallet and marks REJECTED.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";
import { deliverWebhook } from "@/lib/webhooks";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "transactions:write")) return err("Missing scope: transactions:write", 403);
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason : "Rejected by administrator";

    const tx = await prisma.transaction.findUnique({ where: { id } });
    if (!tx) return err("Transaction not found", 404);
    if (tx.status !== "PENDING") return err(`Transaction is ${tx.status}, not PENDING`, 409);

    const checks = tx.policyChecks as Record<string, unknown> | null;
    if (!checks?.requiresApproval) return err("Transaction is not awaiting approval", 409);

    // Refund balance + mark rejected atomically
    const [, rejected] = await prisma.$transaction([
      prisma.agentWallet.update({
        where: { agentId: tx.fromAgentId },
        data: { balanceUsdc: { increment: tx.amountUsdc } },
      }),
      prisma.transaction.update({
        where: { id },
        data: { status: "REJECTED", failureReason: reason },
      }),
    ]);

    deliverWebhook("transaction.rejected", rejected);
    return ok(rejected);
  } catch (e) { return handleError(e); }
}

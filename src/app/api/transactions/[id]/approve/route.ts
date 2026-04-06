/**
 * POST /api/transactions/[id]/approve
 *
 * Approve a transaction that is held pending manual review.
 * Executes on-chain settlement (if wallet has CDP) then marks CONFIRMED.
 * Funds were already deducted when the transaction was created.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendUSDC } from "@/lib/cdp";
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

    const tx = await prisma.transaction.findUnique({ where: { id } });
    if (!tx) return err("Transaction not found", 404);
    if (tx.status !== "PENDING") return err(`Transaction is ${tx.status}, not PENDING`, 409);

    // Confirm it's an approval-held transaction (not a normal in-flight one)
    const checks = tx.policyChecks as Record<string, unknown> | null;
    if (!checks?.requiresApproval) return err("Transaction is not awaiting approval", 409);

    // Get the wallet for on-chain settlement
    const wallet = await prisma.agentWallet.findUnique({ where: { agentId: tx.fromAgentId } });
    if (!wallet) return err("Agent wallet not found", 404);

    // Attempt on-chain settlement
    try {
      const { txHash } = await sendUSDC(wallet.cdpWalletId, tx.toAddress, tx.amountUsdc);
      const confirmed = await prisma.transaction.update({
        where: { id },
        data: { status: "CONFIRMED", txHash, failureReason: null },
      });
      deliverWebhook("transaction.confirmed", confirmed);
      return ok(confirmed);
    } catch (settlementError) {
      // Settlement failed — refund balance and mark FAILED
      const [, failed] = await prisma.$transaction([
        prisma.agentWallet.update({
          where: { agentId: tx.fromAgentId },
          data: { balanceUsdc: { increment: tx.amountUsdc } },
        }),
        prisma.transaction.update({
          where: { id },
          data: {
            status: "FAILED",
            failureReason: settlementError instanceof Error ? settlementError.message : "Settlement failed after approval",
          },
        }),
      ]);
      deliverWebhook("transaction.failed", failed);
      return err("Approved but on-chain settlement failed — balance refunded", 502);
    }
  } catch (e) { return handleError(e); }
}

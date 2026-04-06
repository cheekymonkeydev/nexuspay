/**
 * POST /api/wallets/[agentId]/sync
 *
 * Syncs a wallet's balance against the real on-chain USDC balance.
 * Detects new deposits and credits them to the DB balance atomically.
 *
 * Deposit detection logic:
 *   pendingOutgoing  = sum of PENDING txns that are in-flight (not approval-held)
 *   expectedOnChain  = dbBalance + pendingOutgoing  (what chain should show)
 *   deposit          = max(0, onChainBalance - expectedOnChain)
 *
 * This correctly handles:
 *   - In-flight transactions (balance decremented in DB but not yet on chain)
 *   - Approval-held transactions (balance already decremented, not in-flight)
 *   - Multiple concurrent deposits
 *
 * For wallets without a real address (test/simulated wallets), returns
 * synced: false without modifying the balance.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate } from "@/lib/auth";
import { getUsdcBalance } from "@/lib/chain";

type Params = { params: Promise<{ agentId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  if (!await authenticate(req)) return err("Unauthorized", 401);
  try {
    const { agentId } = await params;

    const wallet = await prisma.agentWallet.findUnique({ where: { agentId } });
    if (!wallet) return err("Wallet not found", 404);

    // Skip simulated wallets — their random addresses don't correspond to real on-chain state
    if (!wallet.cdpWalletId) {
      return ok({
        agentId,
        synced: false,
        reason: "Simulated wallet — balance managed internally",
        balanceUsdc: wallet.balanceUsdc,
        deposited: 0,
      });
    }

    // Fetch on-chain USDC balance
    const onChainBalance = await getUsdcBalance(wallet.address);
    if (onChainBalance === null) {
      return ok({
        agentId,
        synced: false,
        reason: "RPC unavailable — try again shortly",
        balanceUsdc: wallet.balanceUsdc,
        deposited: 0,
      });
    }

    // Sum of PENDING transactions that are in-flight (sent to chain but not confirmed yet).
    // Approval-held transactions (policyChecks.requiresApproval = true) are NOT in-flight —
    // they are waiting for human approval and have not been sent on-chain.
    const pendingAgg = await prisma.transaction.aggregate({
      where: {
        fromAgentId: agentId,
        status: "PENDING",
        // Exclude approval-held ones — they haven't hit the chain yet
        NOT: { policyChecks: { path: ["requiresApproval"], equals: true } },
      },
      _sum: { amountUsdc: true },
    });
    const pendingOutgoing = pendingAgg._sum.amountUsdc ?? 0;

    // expectedOnChain = what the chain balance should be given current DB state
    const expectedOnChain = wallet.balanceUsdc + pendingOutgoing;
    const deposited = Math.max(0, onChainBalance - expectedOnChain);

    // Round to 6 decimal places to avoid floating-point drift
    const depositedRounded = Math.round(deposited * 1_000_000) / 1_000_000;

    if (depositedRounded < 0.000001) {
      // No meaningful deposit detected
      return ok({
        agentId,
        synced: true,
        deposited: 0,
        balanceUsdc: wallet.balanceUsdc,
        onChainBalance,
        expectedOnChain,
      });
    }

    // Credit the deposit atomically
    const updated = await prisma.agentWallet.update({
      where: { agentId },
      data: { balanceUsdc: { increment: depositedRounded } },
    });

    console.info(
      `[sync] Deposit credited: agentId=${agentId} amount=$${depositedRounded} ` +
      `onChain=$${onChainBalance} prev=$${wallet.balanceUsdc} new=$${updated.balanceUsdc}`
    );

    return ok({
      agentId,
      synced: true,
      deposited: depositedRounded,
      balanceUsdc: updated.balanceUsdc,
      onChainBalance,
      expectedOnChain,
    });
  } catch (e) { return handleError(e); }
}

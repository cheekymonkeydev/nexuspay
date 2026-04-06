/**
 * POST /api/system/sync-deposits
 *
 * Scans all active CDP-backed wallets for new on-chain USDC deposits
 * and credits them to DB balances. Intended to be called by a cron job
 * every 1-5 minutes.
 *
 * Protected by CRON_SECRET header to prevent unauthorized calls.
 *
 * Returns a summary of wallets checked, deposits found, and total credited.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { getUsdcBalance } from "@/lib/chain";

const CRON_SECRET = process.env.CRON_SECRET ?? process.env.JWT_SECRET;

export async function POST(req: NextRequest) {
  // Allow internal calls (from Vercel cron) or calls with CRON_SECRET
  const authHeader = req.headers.get("Authorization");
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";

  if (!isVercelCron) {
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return err("Unauthorized", 401);
    }
  }

  try {
    // Only sync wallets that have real CDP wallet IDs (mainnet wallets)
    const wallets = await prisma.agentWallet.findMany({
      where: {
        status: "ACTIVE",
        cdpWalletId: { not: null },
      },
      select: {
        agentId: true,
        address: true,
        balanceUsdc: true,
        cdpWalletId: true,
      },
    });

    const results: Array<{
      agentId: string;
      deposited: number;
      newBalance: number;
      error?: string;
    }> = [];

    let totalDeposited = 0;
    let walletsWithDeposits = 0;

    for (const wallet of wallets) {
      try {
        const onChainBalance = await getUsdcBalance(wallet.address);
        if (onChainBalance === null) {
          results.push({ agentId: wallet.agentId, deposited: 0, newBalance: wallet.balanceUsdc, error: "RPC error" });
          continue;
        }

        // Account for in-flight pending transactions
        const pendingAgg = await prisma.transaction.aggregate({
          where: {
            fromAgentId: wallet.agentId,
            status: "PENDING",
            NOT: { policyChecks: { path: ["requiresApproval"], equals: true } },
          },
          _sum: { amountUsdc: true },
        });
        const pendingOutgoing = pendingAgg._sum.amountUsdc ?? 0;
        const expectedOnChain = wallet.balanceUsdc + pendingOutgoing;
        const deposited = Math.round(Math.max(0, onChainBalance - expectedOnChain) * 1_000_000) / 1_000_000;

        if (deposited >= 0.000001) {
          const updated = await prisma.agentWallet.update({
            where: { agentId: wallet.agentId },
            data: { balanceUsdc: { increment: deposited } },
          });
          totalDeposited += deposited;
          walletsWithDeposits++;
          results.push({ agentId: wallet.agentId, deposited, newBalance: updated.balanceUsdc });
          console.info(`[sync-deposits] ${wallet.agentId}: +$${deposited} → $${updated.balanceUsdc}`);
        } else {
          results.push({ agentId: wallet.agentId, deposited: 0, newBalance: wallet.balanceUsdc });
        }
      } catch (e) {
        results.push({
          agentId: wallet.agentId,
          deposited: 0,
          newBalance: wallet.balanceUsdc,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return ok({
      checked: wallets.length,
      walletsWithDeposits,
      totalDeposited,
      results,
    });
  } catch (e) { return handleError(e); }
}

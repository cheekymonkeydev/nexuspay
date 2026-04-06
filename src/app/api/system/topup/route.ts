import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate } from "@/lib/auth";

/**
 * POST /api/system/topup
 * Scans all agent wallets with auto top-up enabled and tops up any
 * that have fallen below their threshold. Deducts from treasury.
 * Safe to call repeatedly — only acts when threshold is breached.
 */
export async function POST(req: NextRequest) {
  if (!await authenticate(req)) return err("Unauthorized", 401);
  try {
    const wallets = await prisma.agentWallet.findMany({
      where: { autoTopUpEnabled: true, status: "ACTIVE" },
    });

    const treasury = await prisma.treasury.findUnique({ where: { id: "default" } });
    if (!treasury) return err("Treasury not found", 404);

    let remainingTreasury = treasury.balanceUsdc;
    const results: Array<{ agentId: string; action: string; amount?: number; reason?: string }> = [];

    for (const wallet of wallets) {
      if (!wallet.topUpThreshold || !wallet.topUpAmount) {
        results.push({ agentId: wallet.agentId, action: "skipped", reason: "No threshold/amount configured" });
        continue;
      }
      if (wallet.balanceUsdc >= wallet.topUpThreshold) {
        results.push({ agentId: wallet.agentId, action: "ok", reason: `Balance $${wallet.balanceUsdc.toFixed(2)} above threshold` });
        continue;
      }
      if (remainingTreasury < wallet.topUpAmount) {
        results.push({ agentId: wallet.agentId, action: "skipped", reason: "Insufficient treasury balance" });
        continue;
      }

      await prisma.$transaction([
        prisma.agentWallet.update({
          where: { agentId: wallet.agentId },
          data: { balanceUsdc: { increment: wallet.topUpAmount } },
        }),
        prisma.treasury.update({
          where: { id: "default" },
          data: {
            balanceUsdc: { decrement: wallet.topUpAmount },
            totalDisbursed: { increment: wallet.topUpAmount },
          },
        }),
      ]);

      remainingTreasury -= wallet.topUpAmount;
      results.push({
        agentId: wallet.agentId,
        action: "topped_up",
        amount: wallet.topUpAmount,
      });
    }

    const toppedUp = results.filter((r) => r.action === "topped_up");
    return ok({
      checked: wallets.length,
      toppedUp: toppedUp.length,
      totalDisbursed: toppedUp.reduce((s, r) => s + (r.amount ?? 0), 0),
      results,
    });
  } catch (e) { return handleError(e); }
}

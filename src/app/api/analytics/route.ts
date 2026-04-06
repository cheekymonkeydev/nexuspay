import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "analytics:read")) return err("Missing scope: analytics:read", 403);
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10)));
    const since = new Date(Date.now() - days * 86_400_000);
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);

    // Run all queries in parallel
    const [
      allTxns,
      todayTxns,
      topAgentsRaw,
      wallets,
    ] = await Promise.all([
      // All transactions in window (id + fields needed for aggregation)
      prisma.transaction.findMany({
        where: { createdAt: { gte: since } },
        select: {
          id: true,
          amountUsdc: true,
          status: true,
          isP2P: true,
          category: true,
          fromAgentId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      // Today's confirmed
      prisma.transaction.findMany({
        where: { createdAt: { gte: dayStart }, status: "CONFIRMED" },
        select: { amountUsdc: true },
      }),
      // Top agents by volume (confirmed only)
      prisma.transaction.groupBy({
        by: ["fromAgentId"],
        where: { createdAt: { gte: since }, status: "CONFIRMED" },
        _sum: { amountUsdc: true },
        _count: { id: true },
        orderBy: { _sum: { amountUsdc: "desc" } },
        take: 10,
      }),
      // All wallet balances for top agents
      prisma.agentWallet.findMany({
        select: { agentId: true, balanceUsdc: true, status: true },
      }),
    ]);

    const confirmed = allTxns.filter((t) => t.status === "CONFIRMED");
    const failed = allTxns.filter((t) => t.status === "FAILED");
    const rejected = allTxns.filter((t) => t.status === "REJECTED");
    const pending = allTxns.filter((t) => t.status === "PENDING");

    const totalVolume = confirmed.reduce((s, t) => s + t.amountUsdc, 0);
    const todayVolume = todayTxns.reduce((s, t) => s + t.amountUsdc, 0);
    const avgTxSize = confirmed.length > 0 ? totalVolume / confirmed.length : 0;
    const failureRate = allTxns.length > 0
      ? (((failed.length + rejected.length) / allTxns.length) * 100)
      : 0;

    // Volume by day — fill all days in range
    const volumeByDay: { date: string; volume: number; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const dateStr = d.toISOString().slice(0, 10);
      volumeByDay.push({ date: dateStr, volume: 0, count: 0 });
    }
    confirmed.forEach((t) => {
      const dateStr = new Date(t.createdAt).toISOString().slice(0, 10);
      const entry = volumeByDay.find((d) => d.date === dateStr);
      if (entry) { entry.volume += t.amountUsdc; entry.count += 1; }
    });

    // Category breakdown (confirmed only, exclude nulls → "uncategorised")
    const categoryMap = new Map<string, { volume: number; count: number }>();
    confirmed.forEach((t) => {
      const cat = t.category ?? "uncategorised";
      const existing = categoryMap.get(cat) ?? { volume: 0, count: 0 };
      categoryMap.set(cat, { volume: existing.volume + t.amountUsdc, count: existing.count + 1 });
    });
    const byCategory = Array.from(categoryMap.entries())
      .map(([category, { volume, count }]) => ({ category, volume, count }))
      .sort((a, b) => b.volume - a.volume);

    // Type breakdown
    const p2p = confirmed.filter((t) => t.isP2P);
    const x402 = confirmed.filter((t) => t.category === "x402" && !t.isP2P);
    const onChain = confirmed.filter((t) => !t.isP2P && t.category !== "x402");
    const byType = {
      onChain: { count: onChain.length, volume: onChain.reduce((s, t) => s + t.amountUsdc, 0) },
      p2p: { count: p2p.length, volume: p2p.reduce((s, t) => s + t.amountUsdc, 0) },
      x402: { count: x402.length, volume: x402.reduce((s, t) => s + t.amountUsdc, 0) },
    };

    // Top agents enriched with wallet balance
    const walletMap = new Map(wallets.map((w) => [w.agentId, w]));
    const topAgents = topAgentsRaw.map((row) => ({
      agentId: row.fromAgentId,
      volume: row._sum.amountUsdc ?? 0,
      count: row._count.id,
      balance: walletMap.get(row.fromAgentId)?.balanceUsdc ?? 0,
      status: walletMap.get(row.fromAgentId)?.status ?? "UNKNOWN",
    }));

    return ok({
      period: { days, since: since.toISOString() },
      stats: {
        totalVolume,
        totalTxns: allTxns.length,
        confirmedTxns: confirmed.length,
        failedTxns: failed.length,
        rejectedTxns: rejected.length,
        pendingTxns: pending.length,
        failureRate: parseFloat(failureRate.toFixed(2)),
        avgTxSize: parseFloat(avgTxSize.toFixed(4)),
        todayVolume,
        todayTxns: todayTxns.length,
      },
      volumeByDay,
      byCategory,
      byType,
      topAgents,
    });
  } catch (e) { return handleError(e); }
}

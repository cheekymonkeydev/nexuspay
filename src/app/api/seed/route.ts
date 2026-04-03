import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";

// One-time seed endpoint — protected by SEED_SECRET env var
// Trigger: GET /api/seed?secret=your_secret
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.SEED_SECRET) {
    return err("Forbidden", 403);
  }

  try {
    // ─── Treasury ───
    await prisma.treasury.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default", balanceUsdc: 10000, totalFunded: 10000, totalDisbursed: 558.45 },
    });

    // ─── Agent Wallets ───
    const walletData = [
      { agentId: "agent-alpha", address: "0x7a3f1b9c2d4e5f6a8b7c0d1e2f3a4b5c6d7e8f9a", balanceUsdc: 245.50, status: "ACTIVE" as const },
      { agentId: "agent-beta",  address: "0x9b2e4d1a7c3f8e5b0a6d2c9f1e4b7a3d8c5f2e1b", balanceUsdc: 128.75, status: "ACTIVE" as const },
      { agentId: "agent-gamma", address: "0x3c1d7e9f2a4b6c8d0e1f3a5b7c9d2e4f6a8b0c1d", balanceUsdc: 67.20,  status: "ACTIVE" as const },
      { agentId: "agent-delta", address: "0x5e4a2c8b1d3f7e9a0b6c4d2e8f1a3b5c7d9e0f2a", balanceUsdc: 0,      status: "SUSPENDED" as const },
    ];

    for (const w of walletData) {
      await prisma.agentWallet.upsert({
        where: { agentId: w.agentId },
        update: { balanceUsdc: w.balanceUsdc, status: w.status },
        create: { ...w, metadata: {} },
      });
    }

    // ─── Spending Policies ───
    await prisma.spendingPolicy.deleteMany({
      where: { agentId: { in: walletData.map((w) => w.agentId) } },
    });

    await prisma.spendingPolicy.createMany({
      data: [
        {
          agentId: "agent-alpha", tier: "MODERATE",
          maxPerTransaction: 100, dailyLimit: 500, monthlyLimit: 5000,
          allowedRecipients: [], blockedMerchants: ["gambling", "adult", "weapons"],
          allowedCategories: ["compute", "storage", "service", "api", "p2p"],
          requireApproval: false,
        },
        {
          agentId: "agent-beta", tier: "CONSERVATIVE",
          maxPerTransaction: 25, dailyLimit: 100, monthlyLimit: 1000,
          allowedRecipients: ["0x7a3f1b9c2d4e5f6a8b7c0d1e2f3a4b5c6d7e8f9a", "0x3c1d7e9f2a4b6c8d0e1f3a5b7c9d2e4f6a8b0c1d"],
          blockedMerchants: ["gambling", "adult", "weapons"],
          allowedCategories: ["compute", "p2p"],
          requireApproval: true,
        },
        {
          agentId: "agent-gamma", tier: "AGGRESSIVE",
          maxPerTransaction: 500, dailyLimit: 2000, monthlyLimit: 15000,
          allowedRecipients: [], blockedMerchants: [],
          allowedCategories: [],
          requireApproval: false,
        },
      ],
    });

    // ─── Transactions ───
    await prisma.transaction.deleteMany({});

    const now = Date.now();
    const hour = 3_600_000;
    const day = 24 * hour;

    await prisma.transaction.createMany({
      data: [
        { fromAgentId: "agent-alpha", toAddress: "0x9b2e4d1a7c3f8e5b0a6d2c9f1e4b7a3d8c5f2e1b", amountUsdc: 25.00, status: "CONFIRMED", txHash: "0x8f2a3b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a", category: "compute", memo: "GPU rental — 2hr block", isP2P: false, createdAt: new Date(now - 2 * 60_000) },
        { fromAgentId: "agent-beta",  toAddress: "0x3c1d7e9f2a4b6c8d0e1f3a5b7c9d2e4f6a8b0c1d", toAgentId: "agent-gamma", amountUsdc: 5.00, status: "CONFIRMED", category: "p2p", memo: "Tool access fee", isP2P: true, createdAt: new Date(now - 8 * 60_000) },
        { fromAgentId: "agent-alpha", toAddress: "paywall:/api/premium/data", amountUsdc: 0.001, status: "CONFIRMED", category: "x402", memo: "x402 payment for /api/premium/data", isP2P: false, createdAt: new Date(now - 12 * 60_000) },
        { fromAgentId: "agent-gamma", toAddress: "0x4f1c8a2d3b5e7f9a0c1d2e3f4a5b6c7d8e9f0a1b", amountUsdc: 150.00, status: "REJECTED", category: "transfer", memo: "Attempted large transfer", failureReason: "Exceeds per-transaction limit", isP2P: false, createdAt: new Date(now - hour) },
        { fromAgentId: "agent-alpha", toAddress: "0x9b2e4d1a7c3f8e5b0a6d2c9f1e4b7a3d8c5f2e1b", toAgentId: "agent-beta", amountUsdc: 10.00, status: "CONFIRMED", category: "p2p", memo: "Shared inference cost split", isP2P: true, createdAt: new Date(now - 2 * hour) },
        { fromAgentId: "agent-beta",  toAddress: "0x7a3f1b9c2d4e5f6a8b7c0d1e2f3a4b5c6d7e8f9a", amountUsdc: 32.50, status: "PENDING", txHash: "0x1d3e9f4a2b5c7d8e0f1a3b4c6d7e9f0a2b3c5d6e8f9a0b1c3d4e6f7a8b9c0d1e", category: "service", memo: "Monthly monitoring subscription", isP2P: false, createdAt: new Date(now - 3 * hour) },
        { fromAgentId: "agent-alpha", toAddress: "paywall:/api/ml/inference", amountUsdc: 0.01, status: "CONFIRMED", category: "x402", memo: "x402 payment for /api/ml/inference", isP2P: false, createdAt: new Date(now - 5 * hour) },
        { fromAgentId: "agent-gamma", toAddress: "0x7a3f1b9c2d4e5f6a8b7c0d1e2f3a4b5c6d7e8f9a", amountUsdc: 18.00, status: "CONFIRMED", txHash: "0x2e4f6a8b0c1d3e5f7a9b1c2d4e6f8a0b2c3d5e7f9a0b1c3d4e6f8a0b2c4d6e8f", category: "compute", memo: "Batch processing job", isP2P: false, createdAt: new Date(now - day) },
        { fromAgentId: "agent-alpha", toAddress: "0x3c1d7e9f2a4b6c8d0e1f3a5b7c9d2e4f6a8b0c1d", toAgentId: "agent-gamma", amountUsdc: 7.50, status: "CONFIRMED", category: "p2p", memo: "Data pipeline access", isP2P: true, createdAt: new Date(now - 1.5 * day) },
        { fromAgentId: "agent-beta",  toAddress: "paywall:/api/search/deep", amountUsdc: 0.005, status: "CONFIRMED", category: "x402", memo: "x402 payment for /api/search/deep", isP2P: false, createdAt: new Date(now - 2 * day) },
        { fromAgentId: "agent-alpha", toAddress: "0x6b8c0d2e4f6a8b1c3d5e7f9a0b2c4d6e8f1a3b5c", amountUsdc: 45.00, status: "CONFIRMED", txHash: "0x3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a", category: "storage", memo: "Vector DB hosting — 30 day", isP2P: false, createdAt: new Date(now - 3 * day) },
        { fromAgentId: "agent-gamma", toAddress: "0x9b2e4d1a7c3f8e5b0a6d2c9f1e4b7a3d8c5f2e1b", toAgentId: "agent-beta", amountUsdc: 3.00, status: "CONFIRMED", category: "p2p", memo: "API key share refund", isP2P: true, createdAt: new Date(now - 4 * day) },
      ],
    });

    // ─── Paywall Endpoints ───
    await prisma.paywallEndpoint.deleteMany({});

    await prisma.paywallEndpoint.createMany({
      data: [
        { path: "/api/premium/data", priceUsdc: 0.001, description: "Premium data feed", totalPaid: 1.25, hitCount: 1247 },
        { path: "/api/ml/inference", priceUsdc: 0.01, description: "ML inference endpoint", totalPaid: 0.89, hitCount: 89 },
        { path: "/api/search/deep", priceUsdc: 0.005, description: "Deep search index", isActive: false, totalPaid: 2.12, hitCount: 423 },
      ],
    });

    return ok({
      seeded: {
        wallets: walletData.length,
        policies: 3,
        transactions: 12,
        paywallEndpoints: 3,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

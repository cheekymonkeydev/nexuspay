import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendUSDC } from "@/lib/cdp";
import { SendTransactionInput } from "@/lib/types";
import { ok, err, handleError } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const agentId = req.nextUrl.searchParams.get("agentId");
    const status = req.nextUrl.searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (agentId) where.fromAgentId = agentId;
    if (status) where.status = status;

    const txns = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return ok(txns);
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = SendTransactionInput.parse(body);

    // 1. Get wallet
    const wallet = await prisma.agentWallet.findUnique({ where: { agentId: input.fromAgentId } });
    if (!wallet) return err("Agent wallet not found", 404);
    if (wallet.status !== "ACTIVE") return err("Wallet is suspended", 403);

    // 2. Balance check
    if (wallet.balanceUsdc < input.amountUsdc) return err("Insufficient balance", 400);

    // 3. Policy checks
    const policies = await prisma.spendingPolicy.findMany({
      where: { agentId: input.fromAgentId, isActive: true },
    });

    const checks: Record<string, boolean> = {};
    for (const p of policies) {
      // Per-transaction limit
      if (input.amountUsdc > p.maxPerTransaction) {
        checks.maxPerTransaction = false;
        return err(`Exceeds per-transaction limit of $${p.maxPerTransaction}`, 403);
      }
      checks.maxPerTransaction = true;

      // Blocked merchants
      if (input.category && p.blockedMerchants.includes(input.category)) {
        checks.blockedMerchant = false;
        return err(`Category "${input.category}" is blocked`, 403);
      }
      checks.blockedMerchant = true;

      // Allowed categories
      if (input.category && p.allowedCategories.length > 0 && !p.allowedCategories.includes(input.category)) {
        checks.allowedCategory = false;
        return err(`Category "${input.category}" not in allowed list`, 403);
      }
      checks.allowedCategory = true;

      // Allowed recipients
      if (p.allowedRecipients.length > 0 && !p.allowedRecipients.includes(input.toAddress)) {
        checks.allowedRecipient = false;
        return err("Recipient not in allowlist", 403);
      }
      checks.allowedRecipient = true;

      // Daily limit
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dailySpent = await prisma.transaction.aggregate({
        where: { fromAgentId: input.fromAgentId, status: "CONFIRMED", createdAt: { gte: dayStart } },
        _sum: { amountUsdc: true },
      });
      if ((dailySpent._sum.amountUsdc ?? 0) + input.amountUsdc > p.dailyLimit) {
        checks.dailyLimit = false;
        return err(`Would exceed daily limit of $${p.dailyLimit}`, 403);
      }
      checks.dailyLimit = true;

      // Approval gate
      if (p.requireApproval) {
        checks.approval = false;
        return err("Transaction requires manual approval", 403);
      }
      checks.approval = true;
    }

    // 4. Create pending transaction
    const tx = await prisma.transaction.create({
      data: {
        fromAgentId: input.fromAgentId,
        toAddress: input.toAddress,
        amountUsdc: input.amountUsdc,
        category: input.category,
        memo: input.memo,
        status: "PENDING",
        policyChecks: checks,
      },
    });

    // 5. Settle on-chain
    const { txHash } = await sendUSDC(wallet.cdpWalletId, input.toAddress, input.amountUsdc);

    // 6. Update balances and transaction
    await prisma.$transaction([
      prisma.agentWallet.update({
        where: { agentId: input.fromAgentId },
        data: { balanceUsdc: { decrement: input.amountUsdc } },
      }),
      prisma.transaction.update({
        where: { id: tx.id },
        data: { status: "CONFIRMED", txHash },
      }),
    ]);

    return ok({ ...tx, status: "CONFIRMED", txHash });
  } catch (e) { return handleError(e); }
}

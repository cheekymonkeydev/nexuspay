import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendUSDC } from "@/lib/cdp";
import { SendTransactionInput } from "@/lib/types";
import { ok, err, handleError } from "@/lib/utils";
import { enforcePolicies } from "@/lib/policy";

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

    // 3. Policy enforcement (includes monthly limits)
    const policyResult = await enforcePolicies(input.fromAgentId, input.amountUsdc, {
      category: input.category,
      toAddress: input.toAddress,
    });
    if (!policyResult.passed) {
      // Create rejected transaction for audit trail
      await prisma.transaction.create({
        data: {
          fromAgentId: input.fromAgentId,
          toAddress: input.toAddress,
          amountUsdc: input.amountUsdc,
          category: input.category,
          memo: input.memo,
          status: "REJECTED",
          policyChecks: policyResult.checks,
          failureReason: policyResult.failureReason,
        },
      });
      return err(policyResult.failureReason || "Policy check failed", 403);
    }

    // 4. Race-safe balance decrement (WHERE balanceUsdc >= amount)
    const decremented = await prisma.agentWallet.updateMany({
      where: { agentId: input.fromAgentId, balanceUsdc: { gte: input.amountUsdc } },
      data: { balanceUsdc: { decrement: input.amountUsdc } },
    });

    if (decremented.count === 0) {
      return err("Insufficient balance (concurrent transaction)", 409);
    }

    // 5. Create pending transaction
    const tx = await prisma.transaction.create({
      data: {
        fromAgentId: input.fromAgentId,
        toAddress: input.toAddress,
        amountUsdc: input.amountUsdc,
        category: input.category,
        memo: input.memo,
        status: "PENDING",
        policyChecks: policyResult.checks,
      },
    });

    // 6. Settle on-chain
    try {
      const { txHash } = await sendUSDC(wallet.cdpWalletId, input.toAddress, input.amountUsdc);

      // Mark confirmed
      const confirmed = await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: "CONFIRMED", txHash },
      });

      return ok(confirmed);
    } catch (settlementError) {
      // Settlement failed — refund balance and mark transaction FAILED
      await prisma.$transaction([
        prisma.agentWallet.update({
          where: { agentId: input.fromAgentId },
          data: { balanceUsdc: { increment: input.amountUsdc } },
        }),
        prisma.transaction.update({
          where: { id: tx.id },
          data: {
            status: "FAILED",
            failureReason: settlementError instanceof Error ? settlementError.message : "Settlement failed",
          },
        }),
      ]);

      return err("On-chain settlement failed — balance refunded", 502);
    }
  } catch (e) { return handleError(e); }
}

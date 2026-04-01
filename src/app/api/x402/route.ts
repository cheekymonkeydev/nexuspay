import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { RegisterPaywallInput, PaywallPaymentInput } from "@/lib/types";
import { ok, err, handleError } from "@/lib/utils";

// Register a paywall endpoint
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // If body has agentId, it's a payment; otherwise it's registration
    if (body.agentId) {
      const input = PaywallPaymentInput.parse(body);
      return handlePayment(input);
    }

    const input = RegisterPaywallInput.parse(body);
    const endpoint = await prisma.paywallEndpoint.create({
      data: { path: input.path, priceUsdc: input.priceUsdc, description: input.description },
    });
    return ok(endpoint);
  } catch (e) { return handleError(e); }
}

async function handlePayment(input: { path: string; agentId: string }) {
  const endpoint = await prisma.paywallEndpoint.findUnique({ where: { path: input.path } });
  if (!endpoint) return err("Paywall endpoint not found", 404);
  if (!endpoint.isActive) return err("Endpoint is disabled", 403);

  const wallet = await prisma.agentWallet.findUnique({ where: { agentId: input.agentId } });
  if (!wallet) return err("Agent wallet not found", 404);
  if (wallet.balanceUsdc < endpoint.priceUsdc) {
    return err(`Insufficient balance. Required: $${endpoint.priceUsdc}`, 402);
  }

  // Debit agent, credit paywall
  await prisma.$transaction([
    prisma.agentWallet.update({
      where: { agentId: input.agentId },
      data: { balanceUsdc: { decrement: endpoint.priceUsdc } },
    }),
    prisma.paywallEndpoint.update({
      where: { id: endpoint.id },
      data: { totalPaid: { increment: endpoint.priceUsdc }, hitCount: { increment: 1 } },
    }),
    prisma.transaction.create({
      data: {
        fromAgentId: input.agentId,
        toAddress: `paywall:${endpoint.path}`,
        amountUsdc: endpoint.priceUsdc,
        status: "CONFIRMED",
        category: "x402",
        memo: `x402 payment for ${endpoint.path}`,
      },
    }),
  ]);

  return ok({ access: true, charged: endpoint.priceUsdc, endpoint: endpoint.path });
}

export async function GET() {
  try {
    const endpoints = await prisma.paywallEndpoint.findMany({ orderBy: { createdAt: "desc" } });
    return ok(endpoints);
  } catch (e) { return handleError(e); }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { P2PTransferInput } from "@/lib/types";
import { ok, err, handleError } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = P2PTransferInput.parse(body);

    if (input.fromAgentId === input.toAgentId) return err("Cannot transfer to self");

    // Get both wallets
    const [from, to] = await Promise.all([
      prisma.agentWallet.findUnique({ where: { agentId: input.fromAgentId } }),
      prisma.agentWallet.findUnique({ where: { agentId: input.toAgentId } }),
    ]);

    if (!from) return err("Sender wallet not found", 404);
    if (!to) return err("Recipient wallet not found", 404);
    if (from.status !== "ACTIVE") return err("Sender wallet is suspended", 403);
    if (from.balanceUsdc < input.amountUsdc) return err("Insufficient balance", 400);

    // Atomic transfer
    const [, , tx] = await prisma.$transaction([
      prisma.agentWallet.update({
        where: { agentId: input.fromAgentId },
        data: { balanceUsdc: { decrement: input.amountUsdc } },
      }),
      prisma.agentWallet.update({
        where: { agentId: input.toAgentId },
        data: { balanceUsdc: { increment: input.amountUsdc } },
      }),
      prisma.transaction.create({
        data: {
          fromAgentId: input.fromAgentId,
          toAddress: to.address,
          toAgentId: input.toAgentId,
          amountUsdc: input.amountUsdc,
          memo: input.memo,
          isP2P: true,
          status: "CONFIRMED",
        },
      }),
    ]);

    return ok(tx);
  } catch (e) { return handleError(e); }
}

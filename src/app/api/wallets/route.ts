import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createCDPWallet } from "@/lib/cdp";
import { CreateWalletInput } from "@/lib/types";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!await authenticate(req)) return err("Unauthorized", 401);
  try {
    const wallets = await prisma.agentWallet.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { sentTransactions: true, policies: true } } },
    });
    return ok(wallets);
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  if (!await authenticate(req)) return err("Unauthorized", 401);
  try {
    const body = await req.json();
    const input = CreateWalletInput.parse(body);

    const existing = await prisma.agentWallet.findUnique({ where: { agentId: input.agentId } });
    if (existing) return err("Agent wallet already exists", 409);

    const { address, cdpWalletId } = await createCDPWallet();

    // Debit treasury for initial funding
    if (input.initialFunding > 0) {
      await prisma.treasury.update({
        where: { id: "default" },
        data: {
          balanceUsdc: { decrement: input.initialFunding },
          totalDisbursed: { increment: input.initialFunding },
        },
      });
    }

    const wallet = await prisma.agentWallet.create({
      data: {
        agentId: input.agentId,
        address,
        cdpWalletId,
        balanceUsdc: input.initialFunding,
        metadata: (input.metadata ?? {}) as Record<string, string>,
      },
    });

    return ok(wallet, { funded: input.initialFunding, cdpBacked: !!cdpWalletId });
  } catch (e) { return handleError(e); }
}

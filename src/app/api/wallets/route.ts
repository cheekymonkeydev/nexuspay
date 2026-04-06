import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createCDPWallet } from "@/lib/cdp";
import { CreateWalletInput } from "@/lib/types";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "wallets:read")) return err("Missing scope: wallets:read", 403);
  try {
    // In protected mode, only return wallets owned by the authenticated user.
    // In open mode (id === "open"), return all wallets for single-operator setups.
    const ownerFilter = auth.id !== "open" ? { ownerId: auth.id } : {};
    const wallets = await prisma.agentWallet.findMany({
      where: ownerFilter,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { sentTransactions: true, policies: true } } },
    });
    return ok(wallets);
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "wallets:write")) return err("Missing scope: wallets:write", 403);
  try {
    const body = await req.json();
    const input = CreateWalletInput.parse(body);

    const existing = await prisma.agentWallet.findUnique({ where: { agentId: input.agentId } });
    if (existing) return err("Agent wallet already exists", 409);

    const { address, cdpWalletId } = await createCDPWallet();

    const wallet = await prisma.agentWallet.create({
      data: {
        agentId: input.agentId,
        ownerId: auth.id !== "open" ? auth.id : null,
        address,
        cdpWalletId,
        balanceUsdc: 0,
        metadata: (input.metadata ?? {}) as Record<string, string>,
      },
    });

    return ok(wallet, { cdpBacked: !!cdpWalletId });
  } catch (e) { return handleError(e); }
}

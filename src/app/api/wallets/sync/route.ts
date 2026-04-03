import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate } from "@/lib/auth";

// Syncs on-chain USDC balance for a wallet that has a real CDP wallet ID.
// For simulated wallets (no cdpWalletId), balance stays as-is in DB.
export async function POST(req: NextRequest) {
  if (!await authenticate(req)) return err("Unauthorized", 401);
  try {
    const { agentId } = await req.json();

    const wallet = await prisma.agentWallet.findUnique({ where: { agentId } });
    if (!wallet) return err("Wallet not found", 404);

    if (!wallet.cdpWalletId) {
      return ok({ agentId, synced: false, reason: "No CDP wallet ID — balance managed by NexusPay", balanceUsdc: wallet.balanceUsdc });
    }

    // Fetch real on-chain balance via CDP
    let onChainBalance: number | null = null;
    try {
      const sdk = await import("@coinbase/coinbase-sdk");
      sdk.Coinbase.configure({
        apiKeyName: process.env.CDP_API_KEY_NAME!,
        privateKey: (process.env.CDP_API_KEY_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
      });
      const cdpWallet = await sdk.Wallet.fetch(wallet.cdpWalletId);
      const balance = await cdpWallet.getBalance("usdc");
      onChainBalance = Number(balance);
    } catch (e) {
      console.warn("[sync] CDP fetch failed:", e);
      return ok({ agentId, synced: false, reason: "CDP fetch failed", balanceUsdc: wallet.balanceUsdc });
    }

    const updated = await prisma.agentWallet.update({
      where: { agentId },
      data: { balanceUsdc: onChainBalance },
    });

    return ok({ agentId, synced: true, balanceUsdc: updated.balanceUsdc, previousBalance: wallet.balanceUsdc });
  } catch (e) { return handleError(e); }
}

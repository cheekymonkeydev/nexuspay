/**
 * Direct Base RPC utilities — no SDK dependency.
 *
 * Uses public JSON-RPC endpoints to query on-chain state.
 * Works for any wallet address regardless of whether it has a cdpWalletId.
 */

// ── USDC contract addresses ───────────────────────────────────────────────────
const USDC: Record<string, string> = {
  "base-mainnet": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "base":         "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // legacy alias
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

// ── RPC endpoints ─────────────────────────────────────────────────────────────
const RPC: Record<string, string> = {
  "base-mainnet": "https://mainnet.base.org",
  "base":         "https://mainnet.base.org",
  "base-sepolia": "https://sepolia.base.org",
};

// ── balanceOf selector ────────────────────────────────────────────────────────
// keccak256("balanceOf(address)")[0:4] = 0x70a08231
const BALANCE_OF_SELECTOR = "0x70a08231";

function getNetwork(): string {
  return process.env.NETWORK ?? "base-mainnet";
}

/**
 * Returns the USDC balance for a given address on the configured network.
 * USDC has 6 decimals so the raw uint256 is divided by 1_000_000.
 *
 * Returns null on any RPC error (treat as unknown, not zero).
 */
export async function getUsdcBalance(address: string): Promise<number | null> {
  const network = getNetwork();
  const rpc     = RPC[network];
  const token   = USDC[network];

  if (!rpc || !token) {
    console.warn(`[chain] Unknown network: ${network}`);
    return null;
  }

  // Encode calldata: balanceOf(address) — left-pad address to 32 bytes
  const padded   = address.replace(/^0x/, "").toLowerCase().padStart(64, "0");
  const calldata = `${BALANCE_OF_SELECTOR}${padded}`;

  try {
    const res = await fetch(rpc, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method:  "eth_call",
        params:  [{ to: token, data: calldata }, "latest"],
        id: 1,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) return null;

    const json = await res.json() as { result?: string; error?: unknown };
    if (!json.result || json.result === "0x") return 0;

    const raw = BigInt(json.result);
    return Number(raw) / 1_000_000; // USDC = 6 decimals
  } catch (e) {
    console.warn("[chain] getUsdcBalance failed:", e);
    return null;
  }
}

/**
 * Returns true if the given network string is mainnet.
 * Matches both "base-mainnet" and legacy "base".
 */
export function isMainnetNetwork(network: string): boolean {
  return network === "base-mainnet" || network === "base";
}

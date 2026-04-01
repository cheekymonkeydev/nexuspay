/**
 * Coinbase CDP SDK integration for wallet creation and USDC transfers on Base.
 * Falls back to simulated local addresses when CDP keys are not configured.
 */

let Coinbase: unknown = null;
let Wallet: unknown = null;

async function loadCDP() {
  if (!process.env.CDP_API_KEY_NAME || !process.env.CDP_API_KEY_PRIVATE_KEY) return false;
  try {
    const sdk = await import("@coinbase/coinbase-sdk");
    Coinbase = sdk.Coinbase;
    Wallet = sdk.Wallet;
    (Coinbase as { configure: (opts: { apiKeyName: string; privateKey: string }) => void }).configure({
      apiKeyName: process.env.CDP_API_KEY_NAME!,
      privateKey: process.env.CDP_API_KEY_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    });
    return true;
  } catch {
    console.warn("[CDP] SDK not available, using simulation mode");
    return false;
  }
}

function randomAddress(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createCDPWallet(): Promise<{ address: string; cdpWalletId: string | null }> {
  const ready = await loadCDP();
  if (ready && Wallet) {
    try {
      const wallet = await (Wallet as { create: (opts: { networkId: string }) => Promise<{ getDefaultAddress: () => Promise<{ getId: () => string }>; getId: () => string }> }).create({
        networkId: process.env.NETWORK || "base-sepolia",
      });
      const addr = await wallet.getDefaultAddress();
      return { address: addr.getId(), cdpWalletId: wallet.getId() };
    } catch (e) {
      console.warn("[CDP] Wallet creation failed, falling back to local:", e);
    }
  }
  return { address: randomAddress(), cdpWalletId: null };
}

export async function sendUSDC(
  fromCdpWalletId: string | null,
  toAddress: string,
  amountUsdc: number
): Promise<{ txHash: string; settled: boolean }> {
  const ready = await loadCDP();
  if (ready && Wallet && fromCdpWalletId) {
    try {
      const WalletClass = Wallet as { fetch: (id: string) => Promise<{ createTransfer: (opts: { amount: number; assetId: string; destination: string; networkId: string }) => Promise<{ getTransactionHash: () => string }> }> };
      const wallet = await WalletClass.fetch(fromCdpWalletId);
      const transfer = await wallet.createTransfer({
        amount: amountUsdc,
        assetId: "usdc",
        destination: toAddress,
        networkId: process.env.NETWORK || "base-sepolia",
      });
      return { txHash: transfer.getTransactionHash(), settled: true };
    } catch (e) {
      console.warn("[CDP] Transfer failed, simulating:", e);
    }
  }
  // Simulate
  const simHash = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  return { txHash: simHash, settled: false };
}

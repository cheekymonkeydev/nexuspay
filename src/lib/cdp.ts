/**
 * Coinbase CDP SDK integration — wallet creation and USDC transfers on Base.
 * Falls back to simulation when CDP keys are not configured.
 */

let Coinbase: unknown = null;
let Wallet: unknown = null;
let cdpReady: boolean | null = null; // null = not yet checked

async function loadCDP(): Promise<boolean> {
  if (cdpReady !== null) return cdpReady;

  if (!process.env.CDP_API_KEY_NAME || !process.env.CDP_API_KEY_PRIVATE_KEY) {
    cdpReady = false;
    return false;
  }

  try {
    const sdk = await import("@coinbase/coinbase-sdk");
    Coinbase = sdk.Coinbase;
    Wallet = sdk.Wallet;
    (Coinbase as {
      configure: (opts: { apiKeyName: string; privateKey: string }) => void;
    }).configure({
      apiKeyName: process.env.CDP_API_KEY_NAME,
      privateKey: process.env.CDP_API_KEY_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
    cdpReady = true;
    console.info("[CDP] Initialized — network:", process.env.NETWORK ?? "base-sepolia");
    return true;
  } catch (e) {
    console.warn("[CDP] SDK init failed, using simulation mode:", e);
    cdpReady = false;
    return false;
  }
}

function randomAddress(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHash(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ─── Status ─── */
export async function getCDPStatus(): Promise<{
  mode: "live" | "simulated";
  configured: boolean;
  network: string;
}> {
  const configured = !!(process.env.CDP_API_KEY_NAME && process.env.CDP_API_KEY_PRIVATE_KEY);
  const ready = await loadCDP();
  return {
    mode: ready ? "live" : "simulated",
    configured,
    network: process.env.NETWORK ?? "base-sepolia",
  };
}

/* ─── Wallet creation ─── */
export async function createCDPWallet(): Promise<{
  address: string;
  cdpWalletId: string | null;
  simulated: boolean;
}> {
  const ready = await loadCDP();
  if (ready && Wallet) {
    try {
      const WalletCls = Wallet as {
        create: (opts: { networkId: string }) => Promise<{
          getDefaultAddress: () => Promise<{ getId: () => string }>;
          getId: () => string;
        }>;
      };
      const wallet = await WalletCls.create({
        networkId: process.env.NETWORK ?? "base-sepolia",
      });
      const addr = await wallet.getDefaultAddress();
      return { address: addr.getId(), cdpWalletId: wallet.getId(), simulated: false };
    } catch (e) {
      console.warn("[CDP] Wallet creation failed, falling back to simulation:", e);
    }
  }

  return { address: randomAddress(), cdpWalletId: null, simulated: true };
}

/* ─── USDC transfer ─── */
export async function sendUSDC(
  fromCdpWalletId: string | null,
  toAddress: string,
  amountUsdc: number
): Promise<{ txHash: string; simulated: boolean }> {
  const ready = await loadCDP();
  if (ready && Wallet && fromCdpWalletId) {
    try {
      const WalletCls = Wallet as {
        fetch: (id: string) => Promise<{
          createTransfer: (opts: {
            amount: number;
            assetId: string;
            destination: string;
            networkId: string;
          }) => Promise<{ getTransactionHash: () => string }>;
        }>;
      };
      const wallet = await WalletCls.fetch(fromCdpWalletId);
      const transfer = await wallet.createTransfer({
        amount: amountUsdc,
        assetId: "usdc",
        destination: toAddress,
        networkId: process.env.NETWORK ?? "base-sepolia",
      });
      return { txHash: transfer.getTransactionHash(), simulated: false };
    } catch (e) {
      console.warn("[CDP] Transfer failed, falling back to simulation:", e);
    }
  }

  return { txHash: randomHash(), simulated: true };
}

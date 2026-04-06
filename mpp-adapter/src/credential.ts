import type {
  MppCredential,
  VerifyResult,
  NexusPayTransaction,
  NexusPayApiResponse,
  MppAdapterConfig,
} from "./types.js";
import { fromB64url } from "./crypto.js";

/* ─── Config helpers ─────────────────────────────────────────────────────── */

function getNexusPayUrl(config: MppAdapterConfig): string {
  const u = config.nexuspayUrl ?? process.env.NEXUSPAY_URL;
  if (!u) {
    throw new Error(
      "[nexuspay-mpp-adapter] NEXUSPAY_URL env var is required. " +
      "Set it to your NexusPay instance URL, e.g. https://nexuspay.finance"
    );
  }
  return u.replace(/\/$/, "");
}

function getNexusPayApiKey(config: MppAdapterConfig): string {
  const k = config.apiKey ?? process.env.NEXUSPAY_API_KEY;
  if (!k) {
    throw new Error(
      "[nexuspay-mpp-adapter] NEXUSPAY_API_KEY env var is required. " +
      "Create an API key in your NexusPay dashboard with transactions:read scope."
    );
  }
  return k;
}

/* ─── Authorization header parsing ──────────────────────────────────────── */

export function parseAuthorizationHeader(header: string): MppCredential | null {
  try {
    if (!header.startsWith("Payment ")) return null;
    const token = header.slice("Payment ".length).trim();
    if (!token) return null;

    const parsed = JSON.parse(fromB64url(token)) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;

    const c = parsed as MppCredential;
    if (typeof c.source !== "string") return null;
    if (typeof c.challenge?.id !== "string") return null;
    if (typeof c.payload?.transactionId !== "string") return null;

    return c;
  } catch {
    return null;
  }
}

export function extractAgentId(source: string): string | null {
  const m = source.match(/^agent:(.+)$/);
  return m ? m[1] : null;
}

/* ─── Remote transaction verification ───────────────────────────────────── */

async function fetchTransaction(
  transactionId: string,
  config: MppAdapterConfig,
): Promise<NexusPayTransaction | null> {
  const url    = `${getNexusPayUrl(config)}/api/transactions/${transactionId}`;
  const apiKey = getNexusPayApiKey(config);

  let res: Response;
  try {
    res = await fetch(url, {
      method:  "GET",
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      signal:  AbortSignal.timeout(10_000),
    });
  } catch {
    // Network error or timeout — deterministic 401, not a 500
    return null;
  }

  if (!res.ok) return null;

  try {
    const json = (await res.json()) as NexusPayApiResponse<NexusPayTransaction>;
    return json.success && json.data ? json.data : null;
  } catch {
    return null;
  }
}

/* ─── Full verification pipeline ────────────────────────────────────────── */

export async function verifyCredential(
  authHeader: string,
  config: MppAdapterConfig,
  _endpointPath: string,
): Promise<VerifyResult> {
  // 1. Parse
  const credential = parseAuthorizationHeader(authHeader);
  if (!credential) {
    return {
      ok: false, status: 401,
      problem: "malformed-credential",
      detail:  "Could not parse Authorization: Payment header",
    };
  }

  // 2. Extract agentId
  const agentId = extractAgentId(credential.source);
  if (!agentId) {
    return {
      ok: false, status: 401,
      problem: "malformed-credential",
      detail:  "Invalid source format — expected agent:{agentId}",
    };
  }

  // 3. Extract transactionId
  const { transactionId } = credential.payload;
  if (!transactionId || transactionId.trim() === "") {
    return {
      ok: false, status: 401,
      problem: "malformed-credential",
      detail:  "Missing or empty transactionId in payload",
    };
  }

  // 4. Fetch from NexusPay
  const txn = await fetchTransaction(transactionId, config);
  if (!txn) {
    return {
      ok: false, status: 401,
      problem: "verification-failed",
      detail:  "Transaction not found or NexusPay unreachable",
    };
  }

  // 5. Check status
  if (txn.status !== "CONFIRMED") {
    return {
      ok: false, status: 401,
      problem: "verification-failed",
      detail:  `Transaction status is ${txn.status}, expected CONFIRMED`,
    };
  }

  // 6. Check amount
  if (txn.amountUsdc < config.price) {
    return {
      ok: false, status: 402,
      problem: "payment-insufficient",
      detail:  `Payment of $${txn.amountUsdc.toFixed(6)} is less than required $${config.price.toFixed(6)}`,
    };
  }

  return { ok: true, transactionId, agentId, amountUsdc: txn.amountUsdc };
}

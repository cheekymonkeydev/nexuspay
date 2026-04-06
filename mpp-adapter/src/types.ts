/* ─── Public config ──────────────────────────────────────────────────────── */

export interface MppAdapterConfig {
  /** Price in USDC, e.g. 0.10 */
  price: number;
  /** Human-readable realm shown in the challenge.
   *  Defaults to NEXUSPAY_MPP_REALM env → NEXT_PUBLIC_APP_URL hostname → "localhost" */
  realm?: string;
  /** Challenge TTL in milliseconds. Default: 300_000 (5 minutes) */
  challengeTtlMs?: number;
  /** Optional safety cap — throws at decoration time if price > maxPrice */
  maxPrice?: number;
  /** Override the NexusPay base URL (default: NEXUSPAY_URL env var) */
  nexuspayUrl?: string;
  /** Override the NexusPay API key (default: NEXUSPAY_API_KEY env var) */
  apiKey?: string;
}

/* ─── Internal MPP types ─────────────────────────────────────────────────── */

export interface MppChallengeData {
  amount: string;        // toFixed(6), e.g. "0.100000"
  currency: "usdc";
  endpointPath: string;
  expires: number;       // Unix ms
}

export interface MppChallenge {
  id: string;
  realm: string;
  method: "nexuspay";
  intent: "charge";
  request: string;       // base64url(JSON(MppChallengeData))
}

export interface MppCredential {
  challenge: { id: string };
  source: string;        // "agent:{agentId}"
  payload: { transactionId: string };
}

/* ─── NexusPay API shapes ────────────────────────────────────────────────── */

export interface NexusPayTransaction {
  id: string;
  fromAgentId: string;
  toAddress: string;
  amountUsdc: number;
  status: "PENDING" | "CONFIRMED" | "FAILED" | "REJECTED";
  category?: string;
  memo?: string;
  createdAt: string;
}

export interface NexusPayApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/* ─── Verification result ────────────────────────────────────────────────── */

export type VerifyResult =
  | { ok: true; transactionId: string; agentId: string; amountUsdc: number }
  | { ok: false; status: number; problem: string; detail: string };

/* ─── Receipt ────────────────────────────────────────────────────────────── */

export interface ReceiptData {
  method: "nexuspay";
  reference: string;   // transactionId
  timestamp: string;   // ISO 8601
  agentId: string;
  amountUsdc: number;
}

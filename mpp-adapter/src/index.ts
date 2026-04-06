/**
 * nexuspay-mpp-adapter
 *
 * One-liner MPP paywall wrappers for Next.js — powered by NexusPay USDC.
 *
 * App Router:
 *   export const GET = withMpp(handler, { price: 0.10 });
 *
 * Pages Router:
 *   export default withMppPages(handler, { price: 0.10 });
 */

// ── Primary API ─────────────────────────────────────────────────────────────
export { withMpp }           from "./withMpp.js";
export { withMppPages }      from "./withMppPages.js";
export type { WithMppOptions }      from "./withMpp.js";
export type { WithMppPagesOptions } from "./withMppPages.js";

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  MppAdapterConfig,
  MppChallenge,
  MppChallengeData,
  MppCredential,
  NexusPayTransaction,
  NexusPayApiResponse,
  VerifyResult,
  ReceiptData,
} from "./types.js";

// ── Replay store interface (for custom Redis adapters etc.) ──────────────────
export type { ReplayStore } from "./replay.js";
export { defaultReplayStore, clearReplayStore } from "./replay.js";

// ── Low-level primitives (advanced use / testing) ────────────────────────────
export { createChallenge, buildWwwAuthenticate, buildChallengeResponse } from "./challenge.js";
export { parseAuthorizationHeader, verifyCredential, extractAgentId } from "./credential.js";
export { buildPaymentReceipt, attachReceiptHeader } from "./receipt.js";
export { b64url, fromB64url, computeChallengeId } from "./crypto.js";

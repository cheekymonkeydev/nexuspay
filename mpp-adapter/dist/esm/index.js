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
export { withMpp } from "./withMpp.js";
export { withMppPages } from "./withMppPages.js";
export { defaultReplayStore, clearReplayStore } from "./replay.js";
// ── Low-level primitives (advanced use / testing) ────────────────────────────
export { createChallenge, buildWwwAuthenticate, buildChallengeResponse } from "./challenge.js";
export { parseAuthorizationHeader, verifyCredential, extractAgentId } from "./credential.js";
export { buildPaymentReceipt, attachReceiptHeader } from "./receipt.js";
export { b64url, fromB64url, computeChallengeId } from "./crypto.js";

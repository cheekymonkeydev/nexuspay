/**
 * withMpp — Next.js App Router paywall wrapper
 *
 * Wraps any App Router route handler with a full MPP payment gate.
 * Agents that don't include a valid Authorization: Payment header receive
 * a 402 challenge. Once they pay via NexusPay and retry, they get through.
 *
 * @example
 * // app/api/inference/route.ts
 * import { withMpp } from "nexuspay-mpp-adapter";
 *
 * export const POST = withMpp(
 *   async (req) => Response.json({ result: await runModel(req) }),
 *   { price: 0.05 }
 * );
 */

import type { MppAdapterConfig, ReceiptData } from "./types.js";
import type { ReplayStore } from "./replay.js";
import { createChallenge, buildChallengeResponse } from "./challenge.js";
import { verifyCredential } from "./credential.js";
import { checkAndMarkUsed } from "./replay.js";
import { buildPaymentReceipt, attachReceiptHeader } from "./receipt.js";

/* ─── Handler types ──────────────────────────────────────────────────────── */

// Supports both (req) => Response and (req, ctx) => Response signatures
type AppRouterHandler = (
  req: Request,
  context?: { params?: Promise<Record<string, string | string[]>> },
) => Promise<Response> | Response;

/* ─── Extended config (App Router only) ─────────────────────────────────── */

export interface WithMppOptions extends MppAdapterConfig {
  /** Custom replay store for multi-instance deployments (e.g. Redis adapter) */
  replayStore?: ReplayStore;
}

/* ─── Problem response ───────────────────────────────────────────────────── */

function problem(type: string, detail: string, status: number): Response {
  const title = type.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return new Response(
    JSON.stringify({ type: `https://paymentauth.org/problems/${type}`, title, status, detail }),
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

/* ─── withMpp ────────────────────────────────────────────────────────────── */

export function withMpp(handler: AppRouterHandler, options: WithMppOptions): AppRouterHandler {
  // Fail fast at decoration time
  if (typeof options.price !== "number" || options.price <= 0) {
    throw new Error("[nexuspay-mpp-adapter] options.price must be a positive number");
  }
  if (options.maxPrice !== undefined && options.price > options.maxPrice) {
    throw new Error(
      `[nexuspay-mpp-adapter] options.price (${options.price}) exceeds maxPrice (${options.maxPrice})`
    );
  }

  const ttlMs = options.challengeTtlMs ?? 5 * 60 * 1000;

  return async function mppGatedHandler(req, context) {
    const url          = new URL(req.url);
    const endpointPath = url.pathname;
    const authHeader   = req.headers.get("Authorization") ?? "";

    // ── Phase 1: No valid auth → 402 challenge ───────────────────────────
    if (!authHeader.startsWith("Payment ")) {
      const challenge = createChallenge(endpointPath, options);
      return buildChallengeResponse(challenge, options.price);
    }

    // ── Phase 2: Verify credential against NexusPay ──────────────────────
    const result = await verifyCredential(authHeader, options, endpointPath);
    if (!result.ok) return problem(result.problem, result.detail, result.status);

    // ── Phase 3: Replay check ─────────────────────────────────────────────
    const fresh = await checkAndMarkUsed(result.transactionId, ttlMs, options.replayStore);
    if (!fresh) {
      return problem("verification-failed", "Payment credential has already been used", 401);
    }

    // ── Phase 4: Call through + attach receipt ────────────────────────────
    const receiptData: ReceiptData = {
      method:     "nexuspay",
      reference:  result.transactionId,
      timestamp:  new Date().toISOString(),
      agentId:    result.agentId,
      amountUsdc: result.amountUsdc,
    };

    const response = await handler(req, context);
    return attachReceiptHeader(response, buildPaymentReceipt(receiptData));
  };
}

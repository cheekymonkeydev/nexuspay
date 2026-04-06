/**
 * withMppPages — Next.js Pages Router paywall wrapper
 *
 * @example
 * // pages/api/inference.ts
 * import { withMppPages } from "nexuspay-mpp-adapter";
 *
 * export default withMppPages(
 *   async (req, res) => { res.json({ result: "premium data" }); },
 *   { price: 0.05 }
 * );
 */

import type { MppAdapterConfig, ReceiptData } from "./types.js";
import type { ReplayStore } from "./replay.js";
import { createChallenge, buildWwwAuthenticate } from "./challenge.js";
import { verifyCredential } from "./credential.js";
import { checkAndMarkUsed } from "./replay.js";
import { buildPaymentReceipt } from "./receipt.js";

/* ─── Pages Router handler type (no Next.js dependency at runtime) ───────── */

interface PageReq {
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}
interface PageRes {
  setHeader(name: string, value: string): void;
  status(code: number): PageRes;
  json(body: unknown): void;
  end(): void;
}
type PageHandler = (req: PageReq, res: PageRes) => Promise<void> | void;

/* ─── Options ────────────────────────────────────────────────────────────── */

export interface WithMppPagesOptions extends MppAdapterConfig {
  replayStore?: ReplayStore;
}

/* ─── withMppPages ───────────────────────────────────────────────────────── */

export function withMppPages(handler: PageHandler, options: WithMppPagesOptions): PageHandler {
  if (typeof options.price !== "number" || options.price <= 0) {
    throw new Error("[nexuspay-mpp-adapter] options.price must be a positive number");
  }
  if (options.maxPrice !== undefined && options.price > options.maxPrice) {
    throw new Error(
      `[nexuspay-mpp-adapter] options.price (${options.price}) exceeds maxPrice (${options.maxPrice})`
    );
  }

  const ttlMs = options.challengeTtlMs ?? 5 * 60 * 1000;

  return async function mppGatedPagesHandler(req, res) {
    const endpointPath = (req.url ?? "/").split("?")[0];
    const rawAuth      = req.headers["authorization"];
    const authHeader   = Array.isArray(rawAuth) ? rawAuth[0] : (rawAuth ?? "");

    // ── Phase 1: No auth → 402 challenge ─────────────────────────────────
    if (!authHeader.startsWith("Payment ")) {
      const challenge = createChallenge(endpointPath, options);
      res.setHeader("WWW-Authenticate", buildWwwAuthenticate(challenge));
      res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate");
      res.setHeader("Content-Type", "application/problem+json");
      res.status(402).json({
        type:   "https://paymentauth.org/problems/payment-required",
        title:  "Payment Required",
        status: 402,
        detail: `This resource costs $${options.price.toFixed(2)} USDC. Pay using NexusPay MPP.`,
      });
      return;
    }

    // ── Phase 2: Verify credential ────────────────────────────────────────
    const result = await verifyCredential(authHeader, options, endpointPath);
    if (!result.ok) {
      const title = result.problem
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      res.setHeader("Content-Type", "application/problem+json");
      res.status(result.status).json({
        type:   `https://paymentauth.org/problems/${result.problem}`,
        title,
        status: result.status,
        detail: result.detail,
      });
      return;
    }

    // ── Phase 3: Replay check ─────────────────────────────────────────────
    const fresh = await checkAndMarkUsed(result.transactionId, ttlMs, options.replayStore);
    if (!fresh) {
      res.setHeader("Content-Type", "application/problem+json");
      res.status(401).json({
        type:   "https://paymentauth.org/problems/verification-failed",
        title:  "Verification Failed",
        status: 401,
        detail: "Payment credential has already been used",
      });
      return;
    }

    // ── Phase 4: Call through + attach receipt ────────────────────────────
    const receiptData: ReceiptData = {
      method:     "nexuspay",
      reference:  result.transactionId,
      timestamp:  new Date().toISOString(),
      agentId:    result.agentId,
      amountUsdc: result.amountUsdc,
    };
    res.setHeader("Payment-Receipt", buildPaymentReceipt(receiptData));

    await handler(req, res);
  };
}

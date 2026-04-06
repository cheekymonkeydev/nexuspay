/**
 * POST /api/mpp/pay
 *
 * Proxy: given a target URL and an agentId, fetch the resource
 * handling the full MPP 402 → pay → retry cycle automatically.
 *
 * Body: { agentId, url, method?, headers?, body? }
 * Returns: { status, headers, body, receipt, amountPaid }
 *
 * Used by AI agents and the MCP nexuspay_mpp_pay tool so they
 * don't need to implement the MPP protocol themselves.
 */
import { NextRequest } from "next/server";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";
import {
  parseWwwAuthenticate,
  verifyChallenge,
  buildAuthorizationHeader,
  buildPaymentReceipt,
  type MppCredential,
} from "@/lib/mpp";
import { prisma } from "@/lib/db";
import { z } from "zod";

const PaySchema = z.object({
  agentId:    z.string().min(1),
  url:        z.string().url(),
  method:     z.string().default("GET"),
  headers:    z.record(z.string()).optional(),
  body:       z.string().optional(),
  maxAmount:  z.number().positive().optional(), // safety cap
});

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "transactions:write")) return err("Missing scope: transactions:write", 403);
  try {
    const input = PaySchema.parse(await req.json());

    // Step 1: Probe the resource
    const probeRes = await fetch(input.url, {
      method: input.method,
      headers: { "Content-Type": "application/json", ...input.headers },
      body: input.body,
      signal: AbortSignal.timeout(15_000),
    });

    // If it's not a 402, return the response directly
    if (probeRes.status !== 402) {
      const body = await probeRes.text();
      return ok({ status: probeRes.status, body, amountPaid: 0, mppHandled: false });
    }

    // Step 2: Parse the MPP challenge
    const wwwAuth = probeRes.headers.get("WWW-Authenticate") ?? "";
    const challenge = parseWwwAuthenticate(wwwAuth);

    if (!challenge?.id || !challenge.request || !challenge.realm || !challenge.method || !challenge.intent) {
      return err("Resource returned 402 but no valid MPP challenge header", 400);
    }

    // Step 3: Verify challenge integrity and decode amount
    const { valid, data: challengeData, error: challengeError } = verifyChallenge(
      challenge.id,
      challenge.realm,
      challenge.method as string,
      challenge.intent as string,
      challenge.request,
    );

    // Allow external MPP challenges (not HMAC-signed by us) — skip our verify
    // and trust the decoded amount from the request field directly
    let amount = 0;
    if (valid && challengeData) {
      amount = parseFloat(challengeData.amount);
    } else {
      // External challenge — decode request to get amount
      try {
        const decoded = JSON.parse(Buffer.from(challenge.request, "base64url").toString("utf8"));
        amount = typeof decoded.amount === "string" ? parseFloat(decoded.amount) : (decoded.amount as number);
      } catch {
        return err(challengeError ?? "Cannot decode MPP challenge amount", 400);
      }
    }

    if (!amount || isNaN(amount) || amount <= 0) return err("Invalid payment amount in challenge", 400);
    if (input.maxAmount && amount > input.maxAmount) {
      return err(`Payment amount $${amount} exceeds maxAmount cap $${input.maxAmount}`, 402);
    }

    // Step 4: Deduct from agent wallet
    const wallet = await prisma.agentWallet.findUnique({ where: { agentId: input.agentId } });
    if (!wallet) return err("Agent wallet not found", 404);
    if (wallet.status !== "ACTIVE") return err("Wallet is not active", 403);
    if (wallet.balanceUsdc < amount) {
      return err(`Insufficient balance. Required: $${amount.toFixed(2)}, Available: $${wallet.balanceUsdc.toFixed(2)}`, 402);
    }

    const targetUrl = new URL(input.url);
    const txRecord = await prisma.$transaction(async (tx) => {
      await tx.agentWallet.update({
        where: { agentId: input.agentId },
        data: { balanceUsdc: { decrement: amount } },
      });
      return tx.transaction.create({
        data: {
          fromAgentId: input.agentId,
          toAddress:   `mpp:${targetUrl.hostname}${targetUrl.pathname}`,
          amountUsdc:  amount,
          status:      "CONFIRMED",
          category:    "mpp",
          memo:        `MPP payment to ${targetUrl.hostname}`,
        },
      });
    });

    // Step 5: Build Authorization credential
    const credential: MppCredential = {
      challenge: { id: challenge.id },
      source:    `agent:${input.agentId}`,
      payload:   { transactionId: txRecord.id },
    };

    const receipt = buildPaymentReceipt({
      method:      "nexuspay",
      reference:   txRecord.id,
      timestamp:   new Date().toISOString(),
      challengeId: challenge.id,
    });

    // Step 6: Retry the request with Authorization header
    const retryRes = await fetch(input.url, {
      method: input.method,
      headers: {
        "Content-Type": "application/json",
        ...input.headers,
        "Authorization": buildAuthorizationHeader(credential),
        "X-Payment-Receipt": receipt,
      },
      body: input.body,
      signal: AbortSignal.timeout(15_000),
    });

    const responseBody = await retryRes.text();

    return ok({
      status:           retryRes.status,
      body:             responseBody,
      receipt,
      transactionId:    txRecord.id,
      amountPaid:       amount,
      remainingBalance: wallet.balanceUsdc - amount,
      mppHandled:       true,
    });
  } catch (e) { return handleError(e); }
}

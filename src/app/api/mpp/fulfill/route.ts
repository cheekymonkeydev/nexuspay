/**
 * POST /api/mpp/fulfill
 *
 * Agent-side: pays an MPP challenge from a NexusPay wallet and
 * returns a signed Authorization credential string to use on the retry.
 *
 * Body: { agentId, challengeId, request, realm, method, intent }
 * Returns: { credential, receipt } where credential is the full
 *   "Payment <base64url>" string to send as Authorization header.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";
import {
  verifyChallenge,
  buildAuthorizationHeader,
  buildPaymentReceipt,
  extractAgentId,
  type MppCredential,
} from "@/lib/mpp";
import { z } from "zod";

const FulfillSchema = z.object({
  agentId:     z.string().min(1),
  challengeId: z.string().min(1),
  request:     z.string().min(1),
  realm:       z.string().min(1),
  method:      z.string().min(1),
  intent:      z.enum(["charge", "session"]).default("charge"),
});

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "transactions:write")) return err("Missing scope: transactions:write", 403);
  try {
    const body = await req.json();
    const input = FulfillSchema.parse(body);

    // 1. Verify the challenge is valid and not expired
    const { valid, data: challengeData, error: challengeError } = verifyChallenge(
      input.challengeId,
      input.realm,
      input.method,
      input.intent,
      input.request,
    );
    if (!valid || !challengeData) {
      return err(challengeError ?? "Invalid challenge", 400);
    }

    const amount = parseFloat(challengeData.amount);

    // 2. Check the agent wallet has sufficient balance
    const wallet = await prisma.agentWallet.findUnique({ where: { agentId: input.agentId } });
    if (!wallet) return err("Agent wallet not found", 404);
    if (wallet.status !== "ACTIVE") return err("Wallet is not active", 403);
    if (wallet.balanceUsdc < amount) {
      return err(`Insufficient balance. Required: $${amount.toFixed(2)}, Available: $${wallet.balanceUsdc.toFixed(2)}`, 402);
    }

    // 3. Check if a NexusPay-registered MPP endpoint matches
    const endpoint = await prisma.mppEndpoint.findUnique({
      where: { path: challengeData.endpointPath },
    });

    // 4. Deduct from wallet (and credit endpoint if it's ours)
    const txRecord = await prisma.$transaction(async (tx) => {
      await tx.agentWallet.update({
        where: { agentId: input.agentId },
        data: { balanceUsdc: { decrement: amount } },
      });

      const txn = await tx.transaction.create({
        data: {
          fromAgentId: input.agentId,
          toAddress: `mpp:${challengeData.endpointPath}`,
          amountUsdc: amount,
          status: "CONFIRMED",
          category: "mpp",
          memo: `MPP payment for ${challengeData.endpointPath}`,
        },
      });

      if (endpoint?.isActive) {
        await tx.mppEndpoint.update({
          where: { id: endpoint.id },
          data: { totalPaid: { increment: amount }, hitCount: { increment: 1 } },
        });
        await tx.mppPayment.create({
          data: {
            endpointId: endpoint.id,
            agentId: input.agentId,
            amountUsdc: amount,
            challengeId: input.challengeId,
            transactionId: txn.id,
          },
        });
      }

      return txn;
    });

    // 5. Build the signed credential and receipt
    const credential: MppCredential = {
      challenge: { id: input.challengeId },
      source:    `agent:${input.agentId}`,
      payload:   { transactionId: txRecord.id },
    };

    const receiptStr = buildPaymentReceipt({
      method:      "nexuspay",
      reference:   txRecord.id,
      timestamp:   new Date().toISOString(),
      challengeId: input.challengeId,
    });

    return ok({
      credential:          buildAuthorizationHeader(credential),
      receipt:             receiptStr,
      transactionId:       txRecord.id,
      amountPaid:          amount,
      remainingBalance:    wallet.balanceUsdc - amount,
    });
  } catch (e) { return handleError(e); }
}

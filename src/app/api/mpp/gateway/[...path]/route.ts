/**
 * GET|POST /api/mpp/gateway/[...path]
 *
 * MPP Gateway — the universal handler for all registered MPP endpoints.
 *
 * Without Authorization header  → 402 + WWW-Authenticate: Payment challenge
 * With valid Authorization       → verify payment, return 200 + Payment-Receipt
 *
 * Register endpoints via POST /api/mpp or the dashboard MPP tab.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createChallenge,
  challengeResponse,
  parseAuthorizationHeader,
  verifyChallenge,
  buildPaymentReceipt,
  mppProblem,
  extractAgentId,
} from "@/lib/mpp";

type Params = { params: Promise<{ path: string[] }> };

async function handler(req: NextRequest, { params }: Params) {
  const { path } = await params;
  const endpointPath = "/" + path.join("/");

  // Look up registered endpoint
  const endpoint = await prisma.mppEndpoint.findUnique({ where: { path: endpointPath } });
  if (!endpoint) {
    return new Response(
      JSON.stringify({ type: "https://paymentauth.org/problems/not-found", title: "Not Found", status: 404, detail: `No MPP endpoint registered at ${endpointPath}` }),
      { status: 404, headers: { "Content-Type": "application/problem+json" } },
    );
  }
  if (!endpoint.isActive) {
    return mppProblem("endpoint-disabled", "This endpoint is currently disabled", 403);
  }

  const authHeader = req.headers.get("Authorization");

  // ── Step 1: No auth → issue challenge ────────────────────────────────
  if (!authHeader || !authHeader.startsWith("Payment ")) {
    const challenge = createChallenge(endpointPath, endpoint.priceUsdc, endpoint.intent as "charge" | "session");
    return challengeResponse(challenge);
  }

  // ── Step 2: Has auth → verify payment ────────────────────────────────
  const credential = parseAuthorizationHeader(authHeader);
  if (!credential) return mppProblem("malformed-credential", "Could not parse Authorization header", 401);

  const agentId = extractAgentId(credential.source);
  if (!agentId) return mppProblem("malformed-credential", "Invalid source format — expected agent:{agentId}", 401);

  const transactionId = credential.payload?.transactionId;
  if (!transactionId) return mppProblem("malformed-credential", "Missing transactionId in payload", 401);

  // Verify the transaction exists and matches
  const txn = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!txn) return mppProblem("verification-failed", "Transaction not found", 401);
  if (txn.fromAgentId !== agentId) return mppProblem("verification-failed", "Transaction agent mismatch", 401);
  if (txn.amountUsdc < endpoint.priceUsdc) return mppProblem("payment-insufficient", `Payment of $${txn.amountUsdc} is less than required $${endpoint.priceUsdc}`, 402);
  if (txn.status !== "CONFIRMED") return mppProblem("verification-failed", "Transaction is not confirmed", 401);

  // Check for replay — ensure this txn hasn't already been used for this endpoint
  const alreadyUsed = await prisma.mppPayment.findFirst({
    where: { transactionId, endpointId: endpoint.id },
  });
  if (alreadyUsed) return mppProblem("verification-failed", "Payment credential already used", 401);

  // Record this payment against the endpoint
  await prisma.$transaction([
    prisma.mppPayment.create({
      data: {
        endpointId:    endpoint.id,
        agentId,
        amountUsdc:    txn.amountUsdc,
        challengeId:   credential.challenge.id,
        transactionId: txn.id,
      },
    }),
    prisma.mppEndpoint.update({
      where: { id: endpoint.id },
      data: { totalPaid: { increment: txn.amountUsdc }, hitCount: { increment: 1 } },
    }),
  ]);

  // Build receipt
  const receipt = buildPaymentReceipt({
    method:      "nexuspay",
    reference:   txn.id,
    timestamp:   new Date().toISOString(),
    challengeId: credential.challenge.id,
  });

  // ── Step 3: Return access ────────────────────────────────────────────
  return NextResponse.json(
    {
      access:      true,
      endpoint:    endpointPath,
      agentId,
      charged:     txn.amountUsdc,
      receipt,
    },
    {
      status: 200,
      headers: { "Payment-Receipt": receipt },
    },
  );
}

export { handler as GET, handler as POST };

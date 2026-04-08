/**
 * Marketplace payment router.
 *
 * Routes a marketplace purchase to the right payment mechanism:
 *   P2P     — direct internal wallet-to-wallet transfer (subscriptions, sessions)
 *   X402    — external x402-protected URL via operator wallet EIP-3009 signing
 *   MPP     — external MPP-protected URL via 402→pay→retry cycle
 *
 * After payment, creates a ServicePurchase record and updates listing stats.
 */
import { prisma } from "@/lib/db";
import { payX402 } from "@/lib/x402-client";
import { enforcePolicies } from "@/lib/policy";
import {
  parseWwwAuthenticate,
  verifyChallenge,
  buildAuthorizationHeader,
  buildPaymentReceipt,
  type MppCredential,
} from "@/lib/mpp";

export interface PurchaseResult {
  purchaseId:       string;
  transactionId?:   string;
  amountPaid:       number;
  protocol:         string;
  accessToken?:     string;
  accessExpiresAt?: Date;
  /** For X402/MPP per-call listings — instructions for using the service */
  paymentInstructions?: {
    protocol:   string;
    url?:       string;
    sdkCall?:   string;
  };
  /** For X402/MPP — the actual response body if a call was made on purchase */
  responseBody?: unknown;
}

export async function purchaseService(
  listingId: string,
  buyerAgentId: string,
  maxAmountUsdc?: number,
): Promise<PurchaseResult> {
  const listing = await prisma.marketplaceListing.findUnique({
    where: { id: listingId },
  });

  if (!listing) throw new Error("Listing not found");
  if (listing.status !== "ACTIVE") throw new Error(`Listing is ${listing.status.toLowerCase()}`);

  const price = listing.priceUsdc;
  const cap = maxAmountUsdc ?? price;

  if (price > cap) {
    throw new Error(`Listing price $${price} exceeds maxAmountUsdc $${cap}`);
  }

  // Policy check on the buyer
  const policy = await enforcePolicies(buyerAgentId, price, { category: "marketplace" });
  if (!policy.passed) {
    throw new Error(policy.failureReason ?? "Policy check failed");
  }

  // ── Route by protocol ──────────────────────────────────────────────────────

  if (listing.protocol === "P2P") {
    return purchaseP2P(listing, buyerAgentId, price);
  }

  if (listing.protocol === "X402") {
    return purchaseX402(listing, buyerAgentId, price);
  }

  if (listing.protocol === "MPP") {
    return purchaseMPP(listing, buyerAgentId, price);
  }

  throw new Error(`Unknown protocol: ${listing.protocol}`);
}

// ── P2P ───────────────────────────────────────────────────────────────────────

async function purchaseP2P(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listing: any,
  buyerAgentId: string,
  price: number,
): Promise<PurchaseResult> {
  const buyer = await prisma.agentWallet.findUnique({ where: { agentId: buyerAgentId } });
  if (!buyer) throw new Error("Buyer wallet not found");
  if (buyer.balanceUsdc < price) {
    throw new Error(`Insufficient balance: $${buyer.balanceUsdc.toFixed(6)} < $${price}`);
  }

  // Build access token for subscription/session listings
  let accessToken: string | undefined;
  let accessExpiresAt: Date | undefined;
  if (listing.pricingModel === "per-month") {
    accessExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    accessToken = Buffer.from(
      JSON.stringify({ listingId: listing.id, buyerAgentId, exp: accessExpiresAt.toISOString() })
    ).toString("base64url");
  }

  const purchase = await prisma.$transaction(async (tx) => {
    // Debit buyer
    await tx.agentWallet.update({
      where: { agentId: buyerAgentId },
      data: { balanceUsdc: { decrement: price } },
    });
    // Credit provider if it's an internal agent, else credit treasury
    if (listing.providerAgentId) {
      await tx.agentWallet.update({
        where: { agentId: listing.providerAgentId },
        data: { balanceUsdc: { increment: price } },
      });
    } else {
      await tx.treasury.update({
        where: { id: "default" },
        data: { balanceUsdc: { increment: price }, totalFunded: { increment: price } },
      });
    }
    // Transaction record
    await tx.transaction.create({
      data: {
        fromAgentId: buyerAgentId,
        toAddress:   listing.providerAgentId ?? `marketplace:${listing.id}`,
        toAgentId:   listing.providerAgentId ?? undefined,
        amountUsdc:  price,
        status:      "CONFIRMED",
        category:    "marketplace",
        memo:        `Marketplace: ${listing.name}`,
      },
    });
    // Purchase record
    return tx.servicePurchase.create({
      data: {
        listingId:      listing.id,
        buyerAgentId,
        amountUsdc:     price,
        protocol:       "P2P",
        accessToken,
        accessExpiresAt,
      },
    });
  });

  // Update listing stats
  await prisma.marketplaceListing.update({
    where: { id: listing.id },
    data: {
      totalRevenue:    { increment: price },
      totalPurchases:  { increment: 1 },
    },
  });

  return {
    purchaseId:     purchase.id,
    amountPaid:     price,
    protocol:       "P2P",
    accessToken,
    accessExpiresAt,
  };
}

// ── X402 ──────────────────────────────────────────────────────────────────────

async function purchaseX402(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listing: any,
  buyerAgentId: string,
  price: number,
): Promise<PurchaseResult> {
  const url = listing.externalUrl ?? listing.endpointPath;
  if (!url) throw new Error("Listing has no URL configured");

  // For per-call X402 listings, make the actual call and pay via operator wallet
  const result = await payX402({
    agentId:      buyerAgentId,
    url,
    maxAmountUsdc: price,
  });

  const purchase = await prisma.servicePurchase.create({
    data: {
      listingId:    listing.id,
      buyerAgentId,
      transactionId: result.transactionId,
      amountUsdc:   result.amountPaid,
      protocol:     "X402",
    },
  });

  await prisma.marketplaceListing.update({
    where: { id: listing.id },
    data: {
      totalRevenue:   { increment: result.amountPaid },
      totalPurchases: { increment: 1 },
    },
  });

  return {
    purchaseId:   purchase.id,
    transactionId: result.transactionId,
    amountPaid:   result.amountPaid,
    protocol:     "X402",
    responseBody: result.body,
    paymentInstructions: {
      protocol: "X402",
      url,
      sdkCall: `nexuspay.x402Client.fetch({ agentId: "${buyerAgentId}", url: "${url}" })`,
    },
  };
}

// ── MPP ───────────────────────────────────────────────────────────────────────

async function purchaseMPP(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listing: any,
  buyerAgentId: string,
  price: number,
): Promise<PurchaseResult> {
  const url = listing.externalUrl ?? listing.endpointPath;
  if (!url) throw new Error("Listing has no URL configured");

  // Probe the URL to get the MPP challenge
  const probeRes = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (probeRes.status !== 402) {
    // Service returned a direct response — no payment needed
    const body = await probeRes.json().catch(() => probeRes.text());
    const purchase = await prisma.servicePurchase.create({
      data: { listingId: listing.id, buyerAgentId, amountUsdc: 0, protocol: "MPP" },
    });
    return { purchaseId: purchase.id, amountPaid: 0, protocol: "MPP", responseBody: body };
  }

  const wwwAuth = probeRes.headers.get("WWW-Authenticate") ?? "";
  const challenge = parseWwwAuthenticate(wwwAuth);
  if (!challenge?.id) throw new Error("MPP service returned 402 without valid challenge");

  let amount = 0;
  const { valid, data: challengeData } = verifyChallenge(
    challenge.id,
    challenge.realm ?? "",
    challenge.method ?? "",
    challenge.intent ?? "",
    challenge.request ?? "",
  );
  if (valid && challengeData) {
    amount = parseFloat(challengeData.amount);
  } else {
    try {
      const decoded = JSON.parse(Buffer.from(challenge.request ?? "", "base64url").toString("utf8"));
      amount = typeof decoded.amount === "string" ? parseFloat(decoded.amount) : (decoded.amount as number);
    } catch {
      throw new Error("Cannot decode MPP challenge amount");
    }
  }

  if (!amount || isNaN(amount) || amount <= 0) throw new Error("Invalid amount in MPP challenge");
  if (amount > price) throw new Error(`MPP charge $${amount} exceeds listing price $${price}`);

  const wallet = await prisma.agentWallet.findUnique({ where: { agentId: buyerAgentId } });
  if (!wallet) throw new Error("Buyer wallet not found");
  if (wallet.balanceUsdc < amount) {
    throw new Error(`Insufficient balance: $${wallet.balanceUsdc.toFixed(6)} < $${amount}`);
  }

  const txRecord = await prisma.$transaction(async (tx) => {
    await tx.agentWallet.update({
      where: { agentId: buyerAgentId },
      data: { balanceUsdc: { decrement: amount } },
    });
    return tx.transaction.create({
      data: {
        fromAgentId: buyerAgentId,
        toAddress:   `mpp:${new URL(url).hostname}`,
        amountUsdc:  amount,
        status:      "CONFIRMED",
        category:    "marketplace",
        memo:        `Marketplace MPP: ${listing.name}`,
      },
    });
  });

  const credential: MppCredential = {
    challenge: { id: challenge.id },
    source:    `agent:${buyerAgentId}`,
    payload:   { transactionId: txRecord.id },
  };
  const receipt = buildPaymentReceipt({
    method: "nexuspay", reference: txRecord.id,
    timestamp: new Date().toISOString(), challengeId: challenge.id,
  });

  const retryRes = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": buildAuthorizationHeader(credential),
      "X-Payment-Receipt": receipt,
    },
    signal: AbortSignal.timeout(15_000),
  });

  const responseBody = await retryRes.json().catch(() => retryRes.text());

  const purchase = await prisma.servicePurchase.create({
    data: {
      listingId:     listing.id,
      buyerAgentId,
      transactionId: txRecord.id,
      amountUsdc:    amount,
      protocol:      "MPP",
    },
  });

  await prisma.marketplaceListing.update({
    where: { id: listing.id },
    data: { totalRevenue: { increment: amount }, totalPurchases: { increment: 1 } },
  });

  return {
    purchaseId:    purchase.id,
    transactionId: txRecord.id,
    amountPaid:    amount,
    protocol:      "MPP",
    responseBody,
    paymentInstructions: {
      protocol: "MPP",
      url,
      sdkCall: `nexuspay.mpp.pay({ agentId: "${buyerAgentId}", url: "${url}" })`,
    },
  };
}

/**
 * x402 client — NexusPay operator wallet pays external x402-protected APIs
 * on behalf of agents using EIP-3009 (transferWithAuthorization).
 *
 * Architecture:
 *   - One OPERATOR_PRIVATE_KEY env var controls a NexusPay-owned wallet
 *   - That wallet holds USDC on Base and signs all x402 payments on-chain
 *   - Agents are charged from their internal DB balance (no per-agent key mgmt)
 *
 * Flow:
 *   1. Initial request → server returns 402 + PAYMENT-REQUIRED header
 *   2. Parse requirements, find USDC on Base option
 *   3. Verify agent has sufficient balance
 *   4. Sign EIP-712 TransferWithAuthorization with operator key
 *   5. Retry with PAYMENT-SIGNATURE header → x402 facilitator settles on-chain
 *   6. Deduct from agent DB balance + record CONFIRMED transaction
 */

import { privateKeyToAccount } from "viem/accounts";
import { prisma } from "@/lib/db";

// USDC contract addresses per network (CAIP-2 format)
const USDC: Record<string, `0x${string}`> = {
  "eip155:8453":  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base mainnet
  "eip155:84532": "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia
};

// EIP-3009 typed data structure
const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from",        type: "address" },
    { name: "to",          type: "address" },
    { name: "value",       type: "uint256" },
    { name: "validAfter",  type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce",       type: "bytes32" },
  ],
} as const;

export interface X402PayOptions {
  agentId: string;
  url: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  maxAmountUsdc?: number; // default 1.00 — reject if x402 price exceeds this
}

export interface X402PayResult {
  status: number;
  body: unknown;
  amountPaid: number;
  transactionId?: string;
  paywalled: boolean;
  operatorAddress: string;
}

export function getOperatorAddress(): string {
  const pk = process.env.OPERATOR_PRIVATE_KEY;
  if (!pk) throw new Error("OPERATOR_PRIVATE_KEY is not configured");
  return privateKeyToAccount(pk as `0x${string}`).address;
}

function getOperatorAccount() {
  const pk = process.env.OPERATOR_PRIVATE_KEY;
  if (!pk) throw new Error("OPERATOR_PRIVATE_KEY is not configured");
  return privateKeyToAccount(pk as `0x${string}`);
}

function parseBase64Url(value: string): unknown {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
}

function toBase64Url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function randomNonce(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("")}`;
}

function chainIdFromNetwork(network: string): number {
  // CAIP-2: "eip155:8453"
  return parseInt(network.split(":")[1] ?? "8453", 10);
}

export async function payX402(opts: X402PayOptions): Promise<X402PayResult> {
  const { agentId, url, method = "GET", body, headers = {}, maxAmountUsdc = 1.0 } = opts;

  const operator = getOperatorAccount();
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };
  const requestInit: RequestInit = {
    method,
    headers: requestHeaders,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  };

  // ── Step 1: Initial request ────────────────────────────────────────────────
  const initial = await fetch(url, requestInit);

  if (initial.status !== 402) {
    const responseBody = await initial.json().catch(() => initial.text());
    return {
      status: initial.status,
      body: responseBody,
      amountPaid: 0,
      paywalled: false,
      operatorAddress: operator.address,
    };
  }

  // ── Step 2: Parse payment requirements (v2 header or v1 body) ─────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let requirements: any;
  const reqHeader = initial.headers.get("PAYMENT-REQUIRED")
    ?? initial.headers.get("payment-required");

  if (reqHeader) {
    requirements = parseBase64Url(reqHeader);
  } else {
    // x402 v1 — requirements in response body
    requirements = await initial.json().catch(() => null);
  }

  if (!requirements?.accepts?.length) {
    throw new Error("402 response missing valid payment requirements");
  }

  // ── Step 3: Find USDC on Base payment option ───────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentOption = requirements.accepts.find((a: any) => {
    const usdcAddr = USDC[a.network];
    return (
      usdcAddr &&
      a.asset?.toLowerCase() === usdcAddr.toLowerCase() &&
      a.scheme === "exact"
    );
  });

  if (!paymentOption) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const networks = requirements.accepts.map((a: any) => `${a.network}/${a.asset}`).join(", ");
    throw new Error(
      `No compatible x402 payment option. Server accepts: ${networks}. ` +
      `NexusPay supports USDC on Base (eip155:8453) and Base Sepolia (eip155:84532).`
    );
  }

  const amountUsdc = Number(BigInt(paymentOption.amount)) / 1_000_000;

  if (amountUsdc > maxAmountUsdc) {
    throw new Error(
      `x402 price $${amountUsdc.toFixed(6)} exceeds maxAmountUsdc $${maxAmountUsdc}`
    );
  }

  // ── Step 4: Check agent balance ────────────────────────────────────────────
  const wallet = await prisma.agentWallet.findUnique({ where: { agentId } });
  if (!wallet) throw new Error(`Agent wallet not found: ${agentId}`);
  if (wallet.balanceUsdc < amountUsdc) {
    throw new Error(
      `Insufficient balance: $${wallet.balanceUsdc.toFixed(6)} < $${amountUsdc.toFixed(6)}`
    );
  }

  // ── Step 5: Sign EIP-3009 TransferWithAuthorization ───────────────────────
  const chainId = chainIdFromNetwork(paymentOption.network);
  const now = Math.floor(Date.now() / 1000);

  const authorization = {
    from:        operator.address,
    to:          paymentOption.payTo as `0x${string}`,
    value:       BigInt(paymentOption.amount),
    validAfter:  BigInt(now - 60),
    validBefore: BigInt(now + (paymentOption.maxTimeoutSeconds ?? 300)),
    nonce:       randomNonce(),
  };

  const signature = await operator.signTypedData({
    domain: {
      name:              paymentOption.extra?.name    ?? "USD Coin",
      version:           paymentOption.extra?.version ?? "2",
      chainId:           BigInt(chainId),
      verifyingContract: paymentOption.asset as `0x${string}`,
    },
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization",
    message: authorization,
  });

  // ── Step 6: Build PAYMENT-SIGNATURE header ─────────────────────────────────
  const paymentPayload = {
    x402Version: 2,
    resource:    requirements.resource ?? { url },
    accepted:    paymentOption,
    payload: {
      signature,
      authorization: {
        from:        authorization.from,
        to:          authorization.to,
        value:       authorization.value.toString(),
        validAfter:  authorization.validAfter.toString(),
        validBefore: authorization.validBefore.toString(),
        nonce:       authorization.nonce,
      },
    },
  };

  const paymentSignatureHeader = toBase64Url(paymentPayload);

  // ── Step 7: Retry with payment ─────────────────────────────────────────────
  const paid = await fetch(url, {
    ...requestInit,
    headers: {
      ...requestHeaders,
      "PAYMENT-SIGNATURE": paymentSignatureHeader, // v2
      "X-PAYMENT":         paymentSignatureHeader, // v1 compat
    },
  });

  const paidBody = await paid.json().catch(() => paid.text());

  if (paid.status >= 400) {
    throw new Error(`x402 server rejected payment: HTTP ${paid.status}`);
  }

  // ── Step 8: Deduct balance and record transaction ──────────────────────────
  const [, tx] = await prisma.$transaction([
    prisma.agentWallet.update({
      where: { agentId },
      data:  { balanceUsdc: { decrement: amountUsdc } },
    }),
    prisma.transaction.create({
      data: {
        fromAgentId: agentId,
        toAddress:   paymentOption.payTo,
        amountUsdc,
        status:      "CONFIRMED",
        category:    "x402-client",
        memo:        `x402: ${new URL(url).hostname}`,
      },
    }),
  ]);

  console.info(
    `[x402] paid: agentId=${agentId} amount=$${amountUsdc} ` +
    `url=${url} operator=${operator.address}`
  );

  return {
    status:          paid.status,
    body:            paidBody,
    amountPaid:      amountUsdc,
    transactionId:   tx.id,
    paywalled:       true,
    operatorAddress: operator.address,
  };
}

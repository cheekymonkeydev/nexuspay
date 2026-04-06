/**
 * Machine Payments Protocol (MPP) — Core Implementation
 *
 * Implements the MPP open standard (mpp.dev) for NexusPay.
 * Uses standard HTTP headers: WWW-Authenticate / Authorization / Payment-Receipt
 * with NexusPay USDC balances as the payment rail.
 *
 * Spec: https://paymentauth.org
 */
import crypto from "crypto";

const MPP_SECRET = process.env.MPP_SECRET ?? process.env.JWT_SECRET ?? "dev-mpp-secret";
const MPP_REALM  = process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "") ?? "nexuspay.finance";
const MPP_METHOD = "nexuspay";
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/* ── Encoding helpers ─────────────────────────────────────────────────── */

function b64url(data: string): string {
  return Buffer.from(data).toString("base64url");
}

function fromB64url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

/* ── Types ────────────────────────────────────────────────────────────── */

export interface MppChallengeData {
  amount:       string;  // USDC amount e.g. "0.01"
  currency:     string;  // "usdc"
  endpointPath: string;
  expires:      number;  // Unix ms
}

export interface MppChallenge {
  id:      string;
  realm:   string;
  method:  string;
  intent:  "charge" | "session";
  request: string;  // base64url-encoded MppChallengeData
}

export interface MppCredential {
  challenge: { id: string };
  source:    string;  // "agent:{agentId}"
  payload:   { transactionId: string };
}

export interface MppReceipt {
  method:      string;
  reference:   string;  // transactionId
  timestamp:   string;
  challengeId: string;
}

/* ── Challenge generation ─────────────────────────────────────────────── */

function computeId(realm: string, method: string, intent: string, request: string, expires: number): string {
  const input = `${realm}|${method}|${intent}|${request}|${expires}`;
  return crypto.createHmac("sha256", MPP_SECRET).update(input).digest("base64url");
}

export function createChallenge(
  endpointPath: string,
  amount: number,
  intent: "charge" | "session" = "charge",
): MppChallenge {
  const expires = Date.now() + CHALLENGE_TTL_MS;
  const data: MppChallengeData = {
    amount: amount.toFixed(6),
    currency: "usdc",
    endpointPath,
    expires,
  };
  const request = b64url(JSON.stringify(data));
  const id = computeId(MPP_REALM, MPP_METHOD, intent, request, expires);
  return { id, realm: MPP_REALM, method: MPP_METHOD, intent, request };
}

/* ── Header builders ──────────────────────────────────────────────────── */

export function buildWwwAuthenticate(challenge: MppChallenge): string {
  return `Payment id="${challenge.id}", realm="${challenge.realm}", method="${challenge.method}", intent="${challenge.intent}", request="${challenge.request}"`;
}

export function buildAuthorizationHeader(credential: MppCredential): string {
  return `Payment ${b64url(JSON.stringify(credential))}`;
}

export function buildPaymentReceipt(receipt: MppReceipt): string {
  return b64url(JSON.stringify(receipt));
}

/* ── Parsing & verification ───────────────────────────────────────────── */

export function parseWwwAuthenticate(header: string): Partial<MppChallenge> | null {
  try {
    const result: Record<string, string> = {};
    const rx = /(\w+)="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(header.replace(/^Payment\s+/i, ""))) !== null) {
      result[m[1]] = m[2];
    }
    return result as Partial<MppChallenge>;
  } catch { return null; }
}

export function parseAuthorizationHeader(header: string): MppCredential | null {
  try {
    const token = header.replace(/^Payment\s+/i, "");
    return JSON.parse(fromB64url(token)) as MppCredential;
  } catch { return null; }
}

export function verifyChallenge(
  id: string,
  realm: string,
  method: string,
  intent: string,
  request: string,
): { valid: boolean; data?: MppChallengeData; error?: string } {
  try {
    const data = JSON.parse(fromB64url(request)) as MppChallengeData;
    if (Date.now() > data.expires) return { valid: false, error: "payment-expired" };
    const expected = computeId(realm, method, intent, request, data.expires);
    if (expected !== id) return { valid: false, error: "invalid-challenge" };
    return { valid: true, data };
  } catch {
    return { valid: false, error: "malformed-credential" };
  }
}

/* ── RFC 9457 error responses ─────────────────────────────────────────── */

export function mppProblem(type: string, detail: string, status: number): Response {
  const title = type.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  return new Response(
    JSON.stringify({ type: `https://paymentauth.org/problems/${type}`, title, status, detail }),
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

/* ── 402 Challenge response ───────────────────────────────────────────── */

export function challengeResponse(challenge: MppChallenge): Response {
  return new Response(
    JSON.stringify({
      type: "https://paymentauth.org/problems/payment-required",
      title: "Payment Required",
      status: 402,
      detail: `This resource costs $${JSON.parse(fromB64url(challenge.request)).amount} USDC. Pay using the NexusPay MPP method.`,
    }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/problem+json",
        "WWW-Authenticate": buildWwwAuthenticate(challenge),
        "Access-Control-Expose-Headers": "WWW-Authenticate",
      },
    },
  );
}

/* ── Utility ──────────────────────────────────────────────────────────── */

export function extractAgentId(source: string): string | null {
  const match = source.match(/^agent:(.+)$/);
  return match ? match[1] : null;
}

/**
 * POST /api/x402/client
 *
 * Makes an HTTP request on behalf of an agent, automatically handling
 * any x402 Payment Required responses by paying with the agent's USDC balance.
 *
 * The NexusPay operator wallet (OPERATOR_PRIVATE_KEY) signs the on-chain
 * EIP-3009 authorization — no per-agent key management required.
 *
 * Request body:
 *   agentId       string   — which agent pays
 *   url           string   — the target URL to fetch
 *   method        string?  — HTTP method (default: GET)
 *   body          any?     — request body (JSON-serialized)
 *   headers       object?  — additional request headers
 *   maxAmountUsdc number?  — max USDC willing to pay (default: 1.00)
 *
 * Response:
 *   status        number   — HTTP status from the target server
 *   body          any      — response body from the target server
 *   amountPaid    number   — USDC charged (0 if not paywalled)
 *   transactionId string?  — NexusPay transaction ID (if payment made)
 *   paywalled     boolean  — whether a 402 was encountered and paid
 *   operatorAddress string — NexusPay operator wallet address
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";
import { payX402, getOperatorAddress } from "@/lib/x402-client";

const X402FetchInput = z.object({
  agentId:       z.string().min(1),
  url:           z.string().url(),
  method:        z.string().optional(),
  body:          z.unknown().optional(),
  headers:       z.record(z.string()).optional(),
  maxAmountUsdc: z.number().positive().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "transactions:write")) return err("Missing scope: transactions:write", 403);
  try {
    const body = await req.json();
    const input = X402FetchInput.parse(body);
    const result = await payX402(input);
    return ok(result);
  } catch (e) { return handleError(e); }
}

// GET — return the operator wallet address so users know where to send USDC
export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  try {
    const address = getOperatorAddress();
    return ok({ operatorAddress: address, network: process.env.NETWORK ?? "base-mainnet" });
  } catch {
    return ok({ operatorAddress: null, configured: false });
  }
}

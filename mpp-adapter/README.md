# nexuspay-mpp-adapter

One-liner MPP paywall wrapper for Next.js — powered by [NexusPay](https://nexuspay.finance) USDC.

[![npm version](https://img.shields.io/npm/v/nexuspay-mpp-adapter.svg)](https://www.npmjs.com/package/nexuspay-mpp-adapter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Add a machine-payable paywall to any Next.js API route in one line. AI agents pay in USDC via the [Machine Payments Protocol (MPP)](https://paymentauth.org) and receive immediate access. No accounts, no API keys for them — just USDC on Base.

---

## How it works

```
Agent hits your endpoint
    ↓
Adapter returns 402 + WWW-Authenticate: Payment challenge
    ↓
Agent calls NexusPay POST /api/mpp/pay  (or nexuspay_mpp_pay MCP tool)
    ↓
NexusPay deducts USDC from agent wallet, returns Authorization: Payment credential
    ↓
Agent retries your endpoint with the credential
    ↓
Adapter verifies transaction via NexusPay API → returns 200 + Payment-Receipt
```

---

## Installation

```bash
npm install nexuspay-mpp-adapter
```

---

## Quick Start

### App Router (Next.js 13+)

```typescript
// app/api/inference/route.ts
import { withMpp } from "nexuspay-mpp-adapter";

async function handler(req: Request) {
  const body = await req.json();
  return Response.json({ result: `Processed: ${body.prompt}` });
}

// Wrap with 10-cent paywall
export const POST = withMpp(handler, { price: 0.10 });

// Different prices per method
export const GET  = withMpp(handler, { price: 0.05 });
```

### Pages Router (Next.js 12 and below)

```typescript
// pages/api/inference.ts
import { withMppPages } from "nexuspay-mpp-adapter";

export default withMppPages(
  async (req, res) => {
    res.json({ result: "premium data" });
  },
  { price: 0.10 }
);
```

---

## Environment Variables

Add these to your `.env.local`:

```bash
# HMAC key for signing challenges — must be secret and random
# Generate: openssl rand -hex 32
NEXUSPAY_MPP_SECRET=your-32-char-hex-secret

# Your NexusPay instance URL
NEXUSPAY_URL=https://nexuspay.finance

# API key from NexusPay dashboard (needs transactions:read scope)
NEXUSPAY_API_KEY=npk_live_...

# Optional: realm shown in the challenge header (defaults to your app URL hostname)
NEXUSPAY_MPP_REALM=yourdomain.com
```

---

## Configuration Options

```typescript
withMpp(handler, {
  price: 0.10,           // Required: price in USDC

  realm: "api.myapp.com",         // Optional: realm in the challenge header
  challengeTtlMs: 300_000,        // Optional: challenge TTL (default: 5 min)
  maxPrice: 10.00,                // Optional: throws at startup if price > maxPrice (safety)

  nexuspayUrl: "https://...",     // Optional: override NEXUSPAY_URL env var
  apiKey: "npk_live_...",         // Optional: override NEXUSPAY_API_KEY env var

  replayStore: myRedisStore,      // Optional: custom replay store (see below)
});
```

---

## Agent Usage

Agents using the [NexusPay MCP server](https://www.npmjs.com/package/nexuspay-mcp) get this for free:

```
User: Fetch the premium inference data from https://api.myapp.com/api/inference
Claude: (calls nexuspay_mpp_pay with the URL and agent wallet)
        → pays the 402 automatically
        → returns the response body
```

Agents using the NexusPay SDK directly:

```typescript
import { mppPay } from "nexuspay-sdk";

const result = await mppPay({
  agentId: "my-agent",
  url: "https://api.myapp.com/api/inference",
  method: "POST",
  body: JSON.stringify({ prompt: "hello" }),
  maxAmount: 1.00,
});
```

---

## Multi-Instance Deployments

By default, replay protection is in-process (single server). For multiple instances or serverless, provide a Redis-backed replay store:

```typescript
import { withMpp, type ReplayStore } from "nexuspay-mpp-adapter";
import { createClient } from "redis";

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const redisReplayStore: ReplayStore = {
  async has(id: string) {
    return (await redis.exists(`mpp:used:${id}`)) === 1;
  },
  async add(id: string, ttlMs: number) {
    await redis.set(`mpp:used:${id}`, "1", { PX: ttlMs });
  },
};

export const POST = withMpp(handler, {
  price: 0.10,
  replayStore: redisReplayStore,
});
```

---

## Response Headers

On success, your handler's response is augmented with:

```
Payment-Receipt: <base64url-encoded receipt JSON>
```

The receipt contains:
```json
{
  "method": "nexuspay",
  "reference": "<transactionId>",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "agentId": "agent-researcher",
  "amountUsdc": 0.10
}
```

---

## Error Responses

All errors follow [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) Problem Details format.

| Status | type | Cause |
|--------|------|-------|
| `402` | `payment-required` | No Authorization header — agent must pay |
| `402` | `payment-insufficient` | Payment amount < required price |
| `401` | `malformed-credential` | Can't parse Authorization header |
| `401` | `verification-failed` | Transaction not found, not CONFIRMED, or already used |

---

## License

MIT — [NexusPay](https://nexuspay.finance)

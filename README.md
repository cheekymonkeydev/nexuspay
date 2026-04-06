# NexusPay

**Autonomous payment infrastructure for AI agents.** NexusPay gives AI agents their own USDC wallets on Base, spending policies, P2P transfers, x402 micropayments, and a full REST API — deployable in minutes on Vercel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/cheekymonkeydev/nexuspay)

---

## What is NexusPay?

NexusPay is an open-source backend that lets AI agents send, receive, and manage USDC autonomously. Agents get their own on-chain wallets, configurable spending limits, and native support for the x402 pay-per-request protocol — without any human in the loop.

**Built for the agent economy.** Whether you're running a multi-agent pipeline, a pay-per-inference API, or an autonomous research assistant, NexusPay handles the financial layer.

---

## Features

- **Agent Wallets** — Create CDP-backed USDC wallets per agent on Base
- **Spending Policies** — Per-agent limits (per-tx, daily, monthly) with Conservative / Moderate / Aggressive tiers
- **On-chain Transactions** — Send USDC to any Base address
- **P2P Transfers** — Instant zero-gas transfers between agents
- **x402 Micropayments** — HTTP pay-per-request protocol support
- **Webhooks** — Real-time event delivery with HMAC-SHA256 signing
- **Analytics** — Transaction volume, agent spend breakdowns, category charts
- **API Keys** — Granular scope-based access control
- **Auto Top-Up** — Automatically refill wallets from treasury when balance drops below threshold
- **Dashboard** — Full management UI for wallets, transactions, policies, analytics, and more

---

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| `nexuspay-sdk` | TypeScript SDK for the REST API | [![npm](https://img.shields.io/npm/v/nexuspay-sdk)](https://www.npmjs.com/package/nexuspay-sdk) |
| `nexuspay-agentkit` | Coinbase AgentKit plugin | [![npm](https://img.shields.io/npm/v/nexuspay-agentkit)](https://www.npmjs.com/package/nexuspay-agentkit) |
| `nexuspay-mcp` | MCP server for Claude / Cursor / Windsurf | [![npm](https://img.shields.io/npm/v/nexuspay-mcp)](https://www.npmjs.com/package/nexuspay-mcp) |

---

## Quick Start

### 1. Deploy to Vercel

```bash
git clone https://github.com/cheekymonkeydev/nexuspay
cd nexuspay
vercel deploy
```

Or click the **Deploy** button above.

### 2. Set environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon (or any Postgres) connection string |
| `JWT_SECRET` | Random secret for session tokens |
| `CDP_API_KEY_NAME` | Coinbase Developer Platform key name |
| `CDP_API_KEY_PRIVATE_KEY` | Coinbase Developer Platform private key |
| `CDP_NETWORK` | `base-sepolia` (testnet) or `base-mainnet` |

### 3. Push the database schema

```bash
npx prisma@6 db push --schema ./prisma/schema.prisma
```

### 4. Open the dashboard

Visit your deployment URL and connect a wallet to get started.

---

## API

All endpoints require an `X-Api-Key` header (create one in the dashboard).

```bash
# Create an agent wallet
curl -X POST https://your-deployment.vercel.app/api/wallets \
  -H "X-Api-Key: nxp_your_key" \
  -H "Content-Type: application/json" \
  -d '{"agentId": "my-agent", "initialFunding": 10}'

# Get balance
curl https://your-deployment.vercel.app/api/wallets/my-agent \
  -H "X-Api-Key: nxp_your_key"

# Send USDC
curl -X POST https://your-deployment.vercel.app/api/transactions \
  -H "X-Api-Key: nxp_your_key" \
  -H "Content-Type: application/json" \
  -d '{"fromAgentId": "my-agent", "toAddress": "0x...", "amountUsdc": 1.00}'
```

Full API reference: [nexuspay.finance/docs](https://nexuspay.finance/docs)

---

## MCP Server (Claude / Cursor / Windsurf)

Give your AI assistant native payment tools with one config block:

```json
{
  "mcpServers": {
    "nexuspay": {
      "command": "npx",
      "args": ["-y", "nexuspay-mcp"],
      "env": {
        "NEXUSPAY_URL": "https://your-deployment.vercel.app",
        "NEXUSPAY_API_KEY": "nxp_your_key"
      }
    }
  }
}
```

Then just talk to it: *"Create a wallet for my research agent"*, *"Send $5 to agent-writer"*, *"Show me today's transactions"*.

---

## AgentKit Plugin (Coinbase)

```typescript
import { nexusPayActionProvider } from "nexuspay-agentkit";

const agentKit = await AgentKit.from({
  actionProviders: [
    nexusPayActionProvider({
      baseUrl: process.env.NEXUSPAY_URL!,
      apiKey: process.env.NEXUSPAY_API_KEY!,
    }),
  ],
});
```

---

## Tech Stack

- **Framework** — Next.js 15 App Router
- **Database** — Neon PostgreSQL via Prisma ORM
- **Blockchain** — Base (via Coinbase Developer Platform)
- **Auth** — Sign-In with Ethereum (SIWE)
- **Deployment** — Vercel

---

## License

MIT

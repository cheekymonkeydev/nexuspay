# nexuspay-sdk

TypeScript SDK for [NexusPay](https://nexuspay.finance) — autonomous agent payment infrastructure.

## Installation

```bash
npm install nexuspay-sdk
```

## Quick Start

```typescript
import NexusPay from "nexuspay-sdk";

const client = new NexusPay({
  baseUrl: "https://nexuspay.finance",
  apiKey: "nxp_your_api_key_here",
});

// Create a wallet for your agent
const wallet = await client.wallets.create({
  agentId: "my-agent-001",
  initialFunding: 50,
});
console.log(wallet.address, wallet.balanceUsdc);

// Send a payment
const tx = await client.transactions.send({
  fromAgentId: "my-agent-001",
  toAddress: "0xRecipientAddress",
  amountUsdc: 5.00,
  category: "compute",
  memo: "GPU rental payment",
});

// Instant P2P transfer between agents
const transfer = await client.p2p.transfer({
  fromAgentId: "my-agent-001",
  toAgentId: "my-agent-002",
  amountUsdc: 10.00,
});

// Pay a paywall endpoint (x402)
const access = await client.x402.pay({
  path: "/api/premium-data",
  agentId: "my-agent-001",
});
if (access.access) {
  // proceed to call the endpoint
}
```

## Configuration

```typescript
const client = new NexusPay({
  baseUrl: "https://nexuspay.finance", // Your NexusPay deployment URL
  apiKey: "nxp_...",                    // API key (from dashboard → API Keys)
});
```

If `JWT_SECRET` is not set on the server, the API is open and no `apiKey` is required (development mode).

## API Reference

### `client.wallets`

| Method | Description |
|--------|-------------|
| `wallets.create(opts)` | Create a new agent wallet |
| `wallets.list()` | List all wallets |
| `wallets.get(agentId)` | Get a wallet by agentId |
| `wallets.setStatus(agentId, status)` | Suspend or reactivate a wallet |

```typescript
// Create
const wallet = await client.wallets.create({ agentId: "agent-001", initialFunding: 100 });

// Suspend
await client.wallets.setStatus("agent-001", "SUSPENDED");

// Reactivate
await client.wallets.setStatus("agent-001", "ACTIVE");
```

### `client.transactions`

| Method | Description |
|--------|-------------|
| `transactions.send(opts)` | Send an on-chain USDC transaction |
| `transactions.list(opts?)` | List transactions with optional filters |

```typescript
const txns = await client.transactions.list({
  agentId: "agent-001",
  status: "CONFIRMED",
  category: "compute",
});
```

### `client.p2p`

| Method | Description |
|--------|-------------|
| `p2p.transfer(opts)` | Instant off-chain transfer between agents |

```typescript
const result = await client.p2p.transfer({
  fromAgentId: "agent-001",
  toAgentId: "agent-002",
  amountUsdc: 25.00,
  memo: "Revenue share",
});
```

### `client.policies`

| Method | Description |
|--------|-------------|
| `policies.create(opts)` | Create a spending policy for an agent |
| `policies.list(opts?)` | List policies |

```typescript
await client.policies.create({
  agentId: "agent-001",
  tier: "CONSERVATIVE",
  maxPerTransaction: 10,
  dailyLimit: 50,
  monthlyLimit: 500,
  requireApproval: false,
  allowedCategories: ["compute", "storage"],
});
```

### `client.x402`

| Method | Description |
|--------|-------------|
| `x402.register(opts)` | Register a paywall endpoint |
| `x402.pay(opts)` | Pay to access an endpoint |
| `x402.list()` | List all paywall endpoints |

```typescript
// Register your endpoint as a paywall
await client.x402.register({
  path: "/api/my-premium-endpoint",
  priceUsdc: 0.001,
  description: "Real-time market data",
});

// Agent pays to access it
const { access, charged } = await client.x402.pay({
  path: "/api/my-premium-endpoint",
  agentId: "agent-001",
});
```

### `client.identity`

| Method | Description |
|--------|-------------|
| `identity.register(opts)` | Register a DID credential for an agent |
| `identity.list(agentId?)` | List credentials |

### `client.keys`

| Method | Description |
|--------|-------------|
| `keys.create(opts)` | Create an API key (raw key shown once) |
| `keys.list()` | List all API keys |

```typescript
const { key, prefix } = await client.keys.create({
  name: "production-agent",
  scopes: ["*"],
});
// Store `key` securely — it cannot be retrieved again
```

## Error Handling

All methods throw `NexusPayError` on failure:

```typescript
import { NexusPayError } from "nexuspay-sdk";

try {
  await client.transactions.send({ ... });
} catch (e) {
  if (e instanceof NexusPayError) {
    console.error(`${e.status}: ${e.message}`);
    // e.body contains the full API error response
  }
}
```

## Building from Source

```bash
cd sdk
npm install
npm run build   # outputs to dist/
npm run dev     # watch mode
```

## License

MIT

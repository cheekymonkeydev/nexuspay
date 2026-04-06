# nexuspay-agentkit

NexusPay action provider for [Coinbase AgentKit](https://github.com/coinbase/agentkit). Gives any AgentKit-powered AI agent managed USDC wallets, spending policies, P2P transfers, and x402 micropayments on Base — in one import.

## Install

```bash
npm install nexuspay-agentkit @coinbase/agentkit
```

## Quick Start

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { nexusPayActionProvider } from "nexuspay-agentkit";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";

const agentKit = await AgentKit.from({
  cdpApiKeyName: process.env.CDP_API_KEY_NAME!,
  cdpApiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!,
  actionProviders: [
    nexusPayActionProvider({
      baseUrl: process.env.NEXUSPAY_URL!,      // your NexusPay deployment
      apiKey: process.env.NEXUSPAY_API_KEY!,   // from NexusPay dashboard → API Keys
    }),
  ],
});

const tools = await getLangChainTools(agentKit);
const llm = new ChatOpenAI({ model: "gpt-4o" });

const agent = createReactAgent({ llm, tools });

// The agent can now:
// — check wallet balances
// — send USDC on-chain
// — transfer instantly to other agents
// — pay x402 paywalls automatically
// — audit its own transaction history
// — create and check spending policies
```

## Available Actions

| Action | Description |
|---|---|
| `nexuspay_get_balance` | Get USDC balance for an agent wallet |
| `nexuspay_list_wallets` | List all agent wallets and balances |
| `nexuspay_create_wallet` | Create a new CDP-backed agent wallet on Base |
| `nexuspay_send_payment` | Send USDC on-chain to any address |
| `nexuspay_p2p_transfer` | Instant zero-gas transfer between agents |
| `nexuspay_pay_x402` | Pay an x402 paywall to gain API access |
| `nexuspay_list_transactions` | List recent transactions with filters |
| `nexuspay_check_policies` | Check spending limits for an agent |
| `nexuspay_create_policy` | Set spending limits for an agent wallet |

## Example Agent Prompts

Once connected, your agent understands natural language payment instructions:

```
"Check the balance of agent-researcher before sending the payment"
"Transfer $2.50 to agent-writer for the content it generated"
"Pay the inference API at /api/premium/gpt4 using agent-alpha's wallet"
"Set a $10 daily limit on agent-beta's spending"
"Show me the last 10 transactions from agent-alpha"
```

## Environment Variables

```env
NEXUSPAY_URL=https://nexuspay.finance
NEXUSPAY_API_KEY=npk_live_...

# Coinbase CDP (for AgentKit)
CDP_API_KEY_NAME=your-cdp-key-name
CDP_API_KEY_PRIVATE_KEY=your-cdp-private-key
```

## Get a NexusPay API Key

1. Go to your NexusPay dashboard
2. Open the **API Keys** tab
3. Click **Create Key** and copy the raw key (shown once)
4. Set it as `NEXUSPAY_API_KEY` in your environment

## Multi-Agent Example

```typescript
// Agent A pays Agent B for a completed task
await agent.invoke({
  messages: [{
    role: "user",
    content: `
      Agent B just completed the data analysis task.
      Transfer $5 USDC from agent-orchestrator to agent-analyst as payment.
      Then check agent-orchestrator's remaining balance.
    `,
  }],
});
```

## x402 Micropayments

NexusPay implements the [x402 protocol](https://x402.org) for HTTP pay-per-request. When your agent hits a monetized API and gets an HTTP 402 response, it can pay automatically:

```typescript
// Agent receives 402 from a paid API
// Calls nexuspay_pay_x402 automatically
// Gets access — no human intervention needed
```

## Links

- [NexusPay Dashboard](https://nexuspay.finance)
- [NexusPay REST API Docs](https://nexuspay.finance/docs)
- [nexuspay-sdk on npm](https://www.npmjs.com/package/nexuspay-sdk)
- [Coinbase AgentKit Docs](https://docs.cdp.coinbase.com/agent-kit/welcome)

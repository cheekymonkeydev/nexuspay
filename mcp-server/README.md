# nexuspay-mcp

MCP server for [NexusPay](https://nexuspay.finance) — gives Claude, Cursor, Windsurf, and any MCP-compatible AI assistant native USDC payment tools.

## What it does

Once installed, your AI assistant can:

- Check agent wallet balances
- Create new wallets for AI agents
- Send USDC on-chain to any Base address
- Transfer USDC instantly between agents (zero gas)
- Pay x402 paywall endpoints automatically
- View transaction history
- Create and check spending policies

No code required — just configure and talk to it naturally.

## Quick start

### 1. Install

```bash
npm install -g nexuspay-mcp
```

Or use directly with `npx` (no install needed):

```json
"command": "npx",
"args": ["-y", "nexuspay-mcp"]
```

### 2. Get your credentials

1. Open your NexusPay dashboard
2. Go to **API Keys** → **Create Key**
3. Copy the key

### 3. Add to your MCP client

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "nexuspay": {
      "command": "npx",
      "args": ["-y", "nexuspay-mcp"],
      "env": {
        "NEXUSPAY_URL": "https://your-nexuspay.vercel.app",
        "NEXUSPAY_API_KEY": "nxp_your_key_here"
      }
    }
  }
}
```

**Cursor** (`.cursor/mcp.json` in your project or `~/.cursor/mcp.json` globally):

```json
{
  "mcpServers": {
    "nexuspay": {
      "command": "npx",
      "args": ["-y", "nexuspay-mcp"],
      "env": {
        "NEXUSPAY_URL": "https://your-nexuspay.vercel.app",
        "NEXUSPAY_API_KEY": "nxp_your_key_here"
      }
    }
  }
}
```

**Windsurf** (`~/.codeium/windsurf/mcp_config.json`):

```json
{
  "mcpServers": {
    "nexuspay": {
      "command": "npx",
      "args": ["-y", "nexuspay-mcp"],
      "env": {
        "NEXUSPAY_URL": "https://your-nexuspay.vercel.app",
        "NEXUSPAY_API_KEY": "nxp_your_key_here"
      }
    }
  }
}
```

### 4. Start using it

Restart your MCP client, then just talk to it:

```
"Create a wallet for my research agent"
"Check the balance on agent-alpha"
"Send $5 USDC from agent-writer to 0x742d35Cc..."
"Transfer $2 from agent-orchestrator to agent-analyst for the task it completed"
"Set a $10 daily spending limit on agent-beta"
"Show me the last 10 transactions"
```

## Available tools

| Tool | Description |
|------|-------------|
| `nexuspay_get_balance` | Get USDC balance for an agent wallet |
| `nexuspay_list_wallets` | List all wallets and balances |
| `nexuspay_create_wallet` | Create a new agent wallet on Base |
| `nexuspay_send_payment` | Send USDC on-chain to any address |
| `nexuspay_p2p_transfer` | Instant zero-gas transfer between agents |
| `nexuspay_pay_x402` | Pay an x402 paywall to gain API access |
| `nexuspay_list_transactions` | View transaction history with filters |
| `nexuspay_check_policies` | Check spending limits for an agent |
| `nexuspay_create_policy` | Set spending limits for an agent wallet |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXUSPAY_URL` | Yes | Base URL of your NexusPay deployment |
| `NEXUSPAY_API_KEY` | No | API key from Dashboard → API Keys (open mode works without one) |

## Self-hosting

NexusPay is open source. Deploy your own instance on Vercel:

👉 [github.com/cheekymonkeydev/nexuspay](https://github.com/cheekymonkeydev/nexuspay)

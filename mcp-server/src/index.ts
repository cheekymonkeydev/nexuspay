import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

/* ─── Config ─────────────────────────────────────────── */

const BASE_URL = (process.env.NEXUSPAY_URL ?? "").replace(/\/$/, "");
const API_KEY = process.env.NEXUSPAY_API_KEY ?? "";

if (!BASE_URL) {
  console.error("Error: NEXUSPAY_URL environment variable is required");
  process.exit(1);
}

/* ─── API helper ─────────────────────────────────────── */

async function api(path: string, method = "GET", body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "X-Api-Key": API_KEY } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json() as { success?: boolean; data?: unknown; error?: string };
  if (!res.ok || json.success === false) {
    throw new Error(json.error ?? `Request failed: ${res.status}`);
  }
  return json.data ?? json;
}

function text(data: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorText(e: unknown): { content: { type: "text"; text: string }[]; isError: true } {
  return {
    content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
    isError: true,
  };
}

/* ─── Tool definitions ───────────────────────────────── */

const TOOLS: Tool[] = [
  {
    name: "nexuspay_get_balance",
    description: "Get the current USDC balance of an agent wallet. Use this before sending payments to check if the agent has enough funds.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "The agent wallet identifier, e.g. 'agent-researcher'" },
      },
      required: ["agentId"],
    },
  },
  {
    name: "nexuspay_list_wallets",
    description: "List all agent wallets with their balances and statuses. Use this to get an overview of all agents and their current funds.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "nexuspay_create_wallet",
    description: "Create a new USDC wallet for an AI agent on Base. Each agent should have a unique agentId. Fund the wallet by sending USDC to the returned address.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Unique identifier for this agent, e.g. 'agent-writer'" },
      },
      required: ["agentId"],
    },
  },
  {
    name: "nexuspay_send_payment",
    description: "Send USDC on-chain from an agent wallet to any Base address. Policy-checked before settlement. Use for paying external services or APIs.",
    inputSchema: {
      type: "object",
      properties: {
        fromAgentId: { type: "string", description: "Agent wallet to send from" },
        toAddress:   { type: "string", description: "Recipient Base address (0x...)" },
        amountUsdc:  { type: "number", description: "Amount in USDC to send" },
        category:    { type: "string", description: "Payment category, e.g. 'compute', 'storage', 'api'" },
        memo:        { type: "string", description: "Optional note describing the payment" },
      },
      required: ["fromAgentId", "toAddress", "amountUsdc"],
    },
  },
  {
    name: "nexuspay_p2p_transfer",
    description: "Instantly transfer USDC between two NexusPay agent wallets. Zero gas, no on-chain settlement — balances update atomically. Use when paying another agent for work done.",
    inputSchema: {
      type: "object",
      properties: {
        fromAgentId: { type: "string", description: "Sending agent wallet ID" },
        toAgentId:   { type: "string", description: "Receiving agent wallet ID" },
        amountUsdc:  { type: "number", description: "Amount in USDC to transfer" },
        memo:        { type: "string", description: "Optional note, e.g. 'payment for data analysis task'" },
      },
      required: ["fromAgentId", "toAgentId", "amountUsdc"],
    },
  },
  {
    name: "nexuspay_pay_x402",
    description: "Pay a NexusPay x402 paywall endpoint to gain access. Use when an API returns HTTP 402 Payment Required.",
    inputSchema: {
      type: "object",
      properties: {
        path:    { type: "string", description: "The endpoint path to pay for, e.g. '/api/premium/inference'" },
        agentId: { type: "string", description: "Agent wallet that will be charged" },
      },
      required: ["path", "agentId"],
    },
  },
  {
    name: "nexuspay_list_transactions",
    description: "List recent transactions. Filter by agent, status, or category. Use this to check payment history or debug failed transactions.",
    inputSchema: {
      type: "object",
      properties: {
        agentId:  { type: "string", description: "Filter by agent ID (optional)" },
        status:   { type: "string", enum: ["PENDING", "CONFIRMED", "FAILED", "REJECTED"], description: "Filter by status (optional)" },
        category: { type: "string", description: "Filter by category (optional)" },
        limit:    { type: "number", description: "Number of results to return (default 20, max 100)" },
      },
    },
  },
  {
    name: "nexuspay_check_policies",
    description: "Check spending policies for an agent wallet. Returns limits per transaction, daily caps, allowed categories, and whether approval is required.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Agent wallet ID to check policies for (optional — omit to list all)" },
      },
    },
  },
  {
    name: "nexuspay_create_policy",
    description: "Create a spending policy for an agent wallet. Sets limits to prevent overspending. Always create a policy after creating a wallet.",
    inputSchema: {
      type: "object",
      properties: {
        agentId:          { type: "string", description: "Agent wallet to apply the policy to" },
        maxPerTransaction: { type: "number", description: "Maximum USDC per single transaction" },
        dailyLimit:        { type: "number", description: "Maximum USDC per day" },
        monthlyLimit:      { type: "number", description: "Maximum USDC per month (optional)" },
        tier:              { type: "string", enum: ["CONSERVATIVE", "MODERATE", "AGGRESSIVE", "CUSTOM"], description: "Policy tier preset" },
        allowedCategories: { type: "array", items: { type: "string" }, description: "Whitelist of payment categories. Empty means all allowed." },
        requireApproval:   { type: "boolean", description: "Whether transactions require human approval" },
      },
      required: ["agentId", "maxPerTransaction", "dailyLimit"],
    },
  },
];

/* ─── Tool handlers ──────────────────────────────────── */

async function handleTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "nexuspay_get_balance": {
      const wallet = await api(`/wallets/${args.agentId}`) as { agentId: string; balanceUsdc: number; address: string; status: string };
      return text({
        agentId: wallet.agentId,
        balanceUsdc: wallet.balanceUsdc,
        address: wallet.address,
        status: wallet.status,
        message: `Agent ${wallet.agentId} has $${wallet.balanceUsdc.toFixed(2)} USDC available.`,
      });
    }

    case "nexuspay_list_wallets": {
      const wallets = await api("/wallets") as { agentId: string; balanceUsdc: number; address: string; status: string }[];
      const list = Array.isArray(wallets) ? wallets : (wallets as { data?: unknown[] }).data ?? [];
      return text({
        wallets: list,
        total: Array.isArray(list) ? list.length : 0,
        totalBalance: Array.isArray(list) ? (list as { balanceUsdc: number }[]).reduce((s, w) => s + w.balanceUsdc, 0) : 0,
      });
    }

    case "nexuspay_create_wallet": {
      const wallet = await api("/wallets", "POST", { agentId: args.agentId }) as { agentId: string; address: string; balanceUsdc: number };
      return text({
        success: true,
        agentId: wallet.agentId,
        address: wallet.address,
        balanceUsdc: wallet.balanceUsdc,
        message: `Wallet created for ${wallet.agentId}. Send USDC to ${wallet.address} on Base to fund it.`,
      });
    }

    case "nexuspay_send_payment": {
      const tx = await api("/transactions", "POST", {
        fromAgentId: args.fromAgentId,
        toAddress:   args.toAddress,
        amountUsdc:  args.amountUsdc,
        category:    args.category,
        memo:        args.memo,
      }) as { id: string; status: string; amountUsdc: number; txHash?: string };
      return text({
        success: true,
        transactionId: tx.id,
        status: tx.status,
        amountUsdc: tx.amountUsdc,
        txHash: tx.txHash,
        message: `Payment of $${tx.amountUsdc} USDC sent. Status: ${tx.status}.`,
      });
    }

    case "nexuspay_p2p_transfer": {
      const tx = await api("/p2p", "POST", {
        fromAgentId: args.fromAgentId,
        toAgentId:   args.toAgentId,
        amountUsdc:  args.amountUsdc,
        memo:        args.memo,
      }) as { id: string; amountUsdc: number };
      return text({
        success: true,
        transactionId: tx.id,
        amountUsdc: tx.amountUsdc,
        message: `Transferred $${tx.amountUsdc} USDC from ${args.fromAgentId} to ${args.toAgentId} instantly.`,
      });
    }

    case "nexuspay_pay_x402": {
      const result = await api("/x402", "POST", {
        path:    args.path,
        agentId: args.agentId,
      }) as { access: boolean; charged: number; endpoint: string };
      return text({
        success: true,
        access:    result.access,
        charged:   result.charged,
        endpoint:  result.endpoint,
        message: `Access granted to ${args.path}. Charged $${result.charged} USDC.`,
      });
    }

    case "nexuspay_list_transactions": {
      const params = new URLSearchParams();
      if (args.agentId)  params.set("agentId", String(args.agentId));
      if (args.status)   params.set("status", String(args.status));
      if (args.category) params.set("category", String(args.category));
      if (args.limit)    params.set("limit", String(args.limit));
      const result = await api(`/transactions?${params}`) as { items: unknown[]; total: number };
      return text(result);
    }

    case "nexuspay_check_policies": {
      const params = args.agentId ? `?agentId=${args.agentId}` : "";
      const policies = await api(`/policies${params}`);
      return text(policies);
    }

    case "nexuspay_create_policy": {
      const policy = await api("/policies", "POST", {
        agentId:           args.agentId,
        maxPerTransaction: args.maxPerTransaction,
        dailyLimit:        args.dailyLimit,
        monthlyLimit:      args.monthlyLimit,
        tier:              args.tier ?? "CUSTOM",
        allowedCategories: args.allowedCategories ?? [],
        requireApproval:   args.requireApproval ?? false,
      }) as { id: string; agentId: string; tier: string; maxPerTransaction: number; dailyLimit: number };
      return text({
        success: true,
        policyId: policy.id,
        agentId:  policy.agentId,
        tier:     policy.tier,
        limits: {
          perTransaction: `$${policy.maxPerTransaction}`,
          daily:          `$${policy.dailyLimit}`,
        },
        message: `Spending policy created for ${policy.agentId}.`,
      });
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/* ─── Server ─────────────────────────────────────────── */

const server = new Server(
  { name: "nexuspay-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    return await handleTool(name, args as Record<string, unknown>);
  } catch (e) {
    return errorText(e);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

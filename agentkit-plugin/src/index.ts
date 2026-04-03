import "reflect-metadata";
import { ActionProvider, CreateAction, Network, WalletProvider } from "@coinbase/agentkit";
import { z } from "zod";
import NexusPay from "nexuspay-sdk";

/* ─── Config ─────────────────────────────────────────── */

export interface NexusPayPluginConfig {
  /** Your NexusPay deployment URL, e.g. https://your-nexuspay.vercel.app */
  baseUrl: string;
  /** API key created in the NexusPay dashboard under API Keys */
  apiKey: string;
}

/* ─── Schemas ────────────────────────────────────────── */

const GetBalanceSchema = z.object({
  agentId: z.string().describe("The agent ID to check the USDC balance for"),
});

const ListWalletsSchema = z.object({});

const CreateWalletSchema = z.object({
  agentId: z.string().describe("Unique identifier for the new agent wallet, e.g. 'agent-researcher'"),
});

const SendPaymentSchema = z.object({
  fromAgentId: z.string().describe("Agent ID of the wallet to send from"),
  toAddress: z.string().describe("Recipient wallet address on Base (0x...)"),
  amountUsdc: z.number().positive().describe("Amount of USDC to send, e.g. 1.50"),
  category: z.enum(["compute", "storage", "api", "data", "inference", "other"]).optional()
    .describe("Payment category for policy enforcement and analytics"),
  memo: z.string().optional().describe("Optional note to attach to the transaction"),
});

const P2PTransferSchema = z.object({
  fromAgentId: z.string().describe("Agent ID sending the funds"),
  toAgentId: z.string().describe("Agent ID receiving the funds"),
  amountUsdc: z.number().positive().describe("Amount of USDC to transfer"),
  memo: z.string().optional().describe("Optional note, e.g. 'Tool access fee'"),
});

const PayX402Schema = z.object({
  endpointPath: z.string().describe("The x402 paywall endpoint path to access, e.g. /api/premium/inference"),
  payingAgentId: z.string().describe("Agent ID that will pay for access"),
});

const ListTransactionsSchema = z.object({
  agentId: z.string().optional().describe("Filter transactions by agent ID. Omit to list all."),
  limit: z.number().int().min(1).max(100).optional().describe("Number of transactions to return (default 20, max 100)"),
});

const CheckPoliciesSchema = z.object({
  agentId: z.string().describe("Agent ID to check spending policies for"),
});

const CreatePolicySchema = z.object({
  agentId: z.string().describe("Agent ID this policy applies to"),
  tier: z.enum(["CONSERVATIVE", "MODERATE", "AGGRESSIVE", "CUSTOM"]).optional().describe("Policy strictness tier"),
  maxPerTransaction: z.number().positive().describe("Maximum USDC allowed per single transaction"),
  dailyLimit: z.number().positive().describe("Maximum USDC allowed per day"),
  monthlyLimit: z.number().positive().optional().describe("Maximum USDC allowed per month"),
  allowedCategories: z.array(z.string()).optional().describe("Whitelist of payment categories. Empty means all allowed."),
});

/* ─── Action Provider ────────────────────────────────── */

class NexusPayActionProvider extends ActionProvider<WalletProvider> {
  private readonly nexus: NexusPay;

  constructor(config: NexusPayPluginConfig) {
    super("nexuspay", []);
    this.nexus = new NexusPay({ baseUrl: config.baseUrl, apiKey: config.apiKey });
  }

  // ── Wallets ────────────────────────────────────────────

  @CreateAction({
    name: "nexuspay_get_balance",
    description:
      "Get the USDC balance of a NexusPay agent wallet on Base. Use this to check how much an agent can spend before attempting a payment.",
    schema: GetBalanceSchema,
  })
  async getBalance(args: z.infer<typeof GetBalanceSchema>): Promise<string> {
    try {
      const wallet = await this.nexus.wallets.get(args.agentId);
      return JSON.stringify({
        success: true,
        agentId: wallet.agentId,
        balanceUsdc: wallet.balanceUsdc,
        address: wallet.address,
        status: wallet.status,
      });
    } catch (e: any) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }

  @CreateAction({
    name: "nexuspay_list_wallets",
    description: "List all agent wallets managed by this NexusPay instance, including their USDC balances and statuses.",
    schema: ListWalletsSchema,
  })
  async listWallets(_args: z.infer<typeof ListWalletsSchema>): Promise<string> {
    try {
      const wallets = await this.nexus.wallets.list();
      return JSON.stringify({
        success: true,
        count: wallets.length,
        wallets: wallets.map((w) => ({
          agentId: w.agentId,
          balanceUsdc: w.balanceUsdc,
          status: w.status,
          address: w.address,
        })),
      });
    } catch (e: any) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }

  @CreateAction({
    name: "nexuspay_create_wallet",
    description:
      "Create a new Coinbase CDP-backed USDC wallet for an AI agent on Base. Each agent should have a unique agentId.",
    schema: CreateWalletSchema,
  })
  async createWallet(args: z.infer<typeof CreateWalletSchema>): Promise<string> {
    try {
      const wallet = await this.nexus.wallets.create({ agentId: args.agentId });
      return JSON.stringify({
        success: true,
        agentId: wallet.agentId,
        address: wallet.address,
        balanceUsdc: wallet.balanceUsdc,
        message: `Wallet created. Fund it by sending USDC to ${wallet.address} on Base.`,
      });
    } catch (e: any) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }

  // ── Payments ───────────────────────────────────────────

  @CreateAction({
    name: "nexuspay_send_payment",
    description:
      "Send USDC from an agent wallet to any address on Base. The payment is policy-checked before settlement. Use this for paying external services, APIs, or other recipients.",
    schema: SendPaymentSchema,
  })
  async sendPayment(args: z.infer<typeof SendPaymentSchema>): Promise<string> {
    try {
      const tx = await this.nexus.transactions.send({
        fromAgentId: args.fromAgentId,
        toAddress: args.toAddress,
        amountUsdc: args.amountUsdc,
        category: args.category,
        memo: args.memo,
      });
      return JSON.stringify({
        success: true,
        transactionId: tx.id,
        status: tx.status,
        amountUsdc: tx.amountUsdc,
        txHash: tx.txHash,
        message: `Payment of $${args.amountUsdc} USDC sent. Status: ${tx.status}.`,
      });
    } catch (e: any) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }

  @CreateAction({
    name: "nexuspay_p2p_transfer",
    description:
      "Instantly transfer USDC between two NexusPay agent wallets. Zero gas, no on-chain settlement needed — balances swap atomically. Use this when paying another agent for a service.",
    schema: P2PTransferSchema,
  })
  async p2pTransfer(args: z.infer<typeof P2PTransferSchema>): Promise<string> {
    try {
      const result = await this.nexus.p2p.transfer({
        fromAgentId: args.fromAgentId,
        toAgentId: args.toAgentId,
        amountUsdc: args.amountUsdc,
        memo: args.memo,
      });
      return JSON.stringify({
        success: true,
        fromBalance: result.from.balanceUsdc,
        toBalance: result.to.balanceUsdc,
        amountUsdc: result.amount,
        isP2P: true,
        message: `Transferred $${args.amountUsdc} USDC from ${args.fromAgentId} to ${args.toAgentId} instantly.`,
      });
    } catch (e: any) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }

  @CreateAction({
    name: "nexuspay_pay_x402",
    description:
      "Pay a NexusPay x402 paywall endpoint to gain access. Use this when an API returns HTTP 402 Payment Required. The agent's balance is debited and access is granted.",
    schema: PayX402Schema,
  })
  async payX402(args: z.infer<typeof PayX402Schema>): Promise<string> {
    try {
      const result = await this.nexus.x402.pay({
        path: args.endpointPath,
        agentId: args.payingAgentId,
      });
      return JSON.stringify({
        success: true,
        endpointPath: args.endpointPath,
        amountPaid: result.charged,
        access: result.access,
        message: `Access granted to ${args.endpointPath}. Paid $${result.charged} USDC.`,
      });
    } catch (e: any) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }

  // ── Transactions ───────────────────────────────────────

  @CreateAction({
    name: "nexuspay_list_transactions",
    description:
      "List recent transactions for one or all agent wallets. Use this to audit spending, check payment status, or review what an agent has paid for.",
    schema: ListTransactionsSchema,
  })
  async listTransactions(args: z.infer<typeof ListTransactionsSchema>): Promise<string> {
    try {
      const result = await this.nexus.transactions.list({
        agentId: args.agentId,
      });
      // result may be paginated — handle both shapes
      const items = Array.isArray(result) ? result : (result as any).items ?? [];
      const summary = items.slice(0, args.limit ?? 20).map((t: any) => ({
        id: t.id,
        from: t.fromAgentId,
        to: t.toAgentId || t.toAddress,
        amountUsdc: t.amountUsdc,
        status: t.status,
        category: t.category,
        isP2P: t.isP2P,
        createdAt: t.createdAt,
      }));
      return JSON.stringify({ success: true, count: summary.length, transactions: summary });
    } catch (e: any) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }

  // ── Policies ───────────────────────────────────────────

  @CreateAction({
    name: "nexuspay_check_policies",
    description:
      "Check the spending policies for an agent wallet — including per-transaction limits, daily/monthly caps, and allowed payment categories.",
    schema: CheckPoliciesSchema,
  })
  async checkPolicies(args: z.infer<typeof CheckPoliciesSchema>): Promise<string> {
    try {
      const policies = await this.nexus.policies.list({ agentId: args.agentId });
      if (policies.length === 0) {
        return JSON.stringify({
          success: true,
          agentId: args.agentId,
          policies: [],
          message: "No spending policies set — this agent has no limits.",
        });
      }
      return JSON.stringify({
        success: true,
        agentId: args.agentId,
        policies: policies.map((p) => ({
          id: p.id,
          tier: p.tier,
          maxPerTransaction: p.maxPerTransaction,
          dailyLimit: p.dailyLimit,
          monthlyLimit: p.monthlyLimit,
          allowedCategories: p.allowedCategories,
        })),
      });
    } catch (e: any) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }

  @CreateAction({
    name: "nexuspay_create_policy",
    description:
      "Create a spending policy for an agent wallet to enforce limits on how much it can spend per transaction, per day, or per month.",
    schema: CreatePolicySchema,
  })
  async createPolicy(args: z.infer<typeof CreatePolicySchema>): Promise<string> {
    try {
      const policy = await this.nexus.policies.create({
        agentId: args.agentId,
        tier: args.tier,
        maxPerTransaction: args.maxPerTransaction,
        dailyLimit: args.dailyLimit,
        monthlyLimit: args.monthlyLimit,
        allowedCategories: args.allowedCategories,
      });
      return JSON.stringify({
        success: true,
        policyId: policy.id,
        agentId: policy.agentId,
        tier: policy.tier,
        message: `Spending policy created for ${args.agentId}.`,
      });
    } catch (e: any) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }

  supportsNetwork = (_network: Network): boolean => true;
}

/* ─── Export ─────────────────────────────────────────── */

/**
 * Create a NexusPay action provider for Coinbase AgentKit.
 *
 * @example
 * ```typescript
 * import { AgentKit } from "@coinbase/agentkit";
 * import { nexusPayActionProvider } from "nexuspay-agentkit";
 *
 * const agentKit = await AgentKit.from({
 *   cdpApiKeyName: process.env.CDP_API_KEY_NAME,
 *   cdpApiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY,
 *   actionProviders: [
 *     nexusPayActionProvider({
 *       baseUrl: process.env.NEXUSPAY_URL,
 *       apiKey: process.env.NEXUSPAY_API_KEY,
 *     }),
 *   ],
 * });
 * ```
 */
export function nexusPayActionProvider(config: NexusPayPluginConfig): NexusPayActionProvider {
  return new NexusPayActionProvider(config);
}

export type { NexusPayPluginConfig as NexusPayConfig };

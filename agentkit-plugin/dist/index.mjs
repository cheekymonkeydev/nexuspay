var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};

// src/index.ts
import "reflect-metadata";
import { ActionProvider, CreateAction } from "@coinbase/agentkit";
import { z } from "zod";
import NexusPay from "nexuspay-sdk";
var GetBalanceSchema = z.object({
  agentId: z.string().describe("The agent ID to check the USDC balance for")
});
var ListWalletsSchema = z.object({});
var CreateWalletSchema = z.object({
  agentId: z.string().describe("Unique identifier for the new agent wallet, e.g. 'agent-researcher'")
});
var SendPaymentSchema = z.object({
  fromAgentId: z.string().describe("Agent ID of the wallet to send from"),
  toAddress: z.string().describe("Recipient wallet address on Base (0x...)"),
  amountUsdc: z.number().positive().describe("Amount of USDC to send, e.g. 1.50"),
  category: z.enum(["compute", "storage", "api", "data", "inference", "other"]).optional().describe("Payment category for policy enforcement and analytics"),
  memo: z.string().optional().describe("Optional note to attach to the transaction")
});
var P2PTransferSchema = z.object({
  fromAgentId: z.string().describe("Agent ID sending the funds"),
  toAgentId: z.string().describe("Agent ID receiving the funds"),
  amountUsdc: z.number().positive().describe("Amount of USDC to transfer"),
  memo: z.string().optional().describe("Optional note, e.g. 'Tool access fee'")
});
var PayX402Schema = z.object({
  endpointPath: z.string().describe("The x402 paywall endpoint path to access, e.g. /api/premium/inference"),
  payingAgentId: z.string().describe("Agent ID that will pay for access")
});
var ListTransactionsSchema = z.object({
  agentId: z.string().optional().describe("Filter transactions by agent ID. Omit to list all."),
  limit: z.number().int().min(1).max(100).optional().describe("Number of transactions to return (default 20, max 100)")
});
var CheckPoliciesSchema = z.object({
  agentId: z.string().describe("Agent ID to check spending policies for")
});
var CreatePolicySchema = z.object({
  agentId: z.string().describe("Agent ID this policy applies to"),
  tier: z.enum(["CONSERVATIVE", "MODERATE", "AGGRESSIVE", "CUSTOM"]).optional().describe("Policy strictness tier"),
  maxPerTransaction: z.number().positive().describe("Maximum USDC allowed per single transaction"),
  dailyLimit: z.number().positive().describe("Maximum USDC allowed per day"),
  monthlyLimit: z.number().positive().optional().describe("Maximum USDC allowed per month"),
  allowedCategories: z.array(z.string()).optional().describe("Whitelist of payment categories. Empty means all allowed.")
});
var NexusPayActionProvider = class extends ActionProvider {
  constructor(config) {
    super("nexuspay", []);
    this.supportsNetwork = (_network) => true;
    this.nexus = new NexusPay({ baseUrl: config.baseUrl, apiKey: config.apiKey });
  }
  async getBalance(args) {
    try {
      const wallet = await this.nexus.wallets.get(args.agentId);
      return JSON.stringify({
        success: true,
        agentId: wallet.agentId,
        balanceUsdc: wallet.balanceUsdc,
        address: wallet.address,
        status: wallet.status
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }
  async listWallets(_args) {
    try {
      const wallets = await this.nexus.wallets.list();
      return JSON.stringify({
        success: true,
        count: wallets.length,
        wallets: wallets.map((w) => ({
          agentId: w.agentId,
          balanceUsdc: w.balanceUsdc,
          status: w.status,
          address: w.address
        }))
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }
  async createWallet(args) {
    try {
      const wallet = await this.nexus.wallets.create({ agentId: args.agentId });
      return JSON.stringify({
        success: true,
        agentId: wallet.agentId,
        address: wallet.address,
        balanceUsdc: wallet.balanceUsdc,
        message: `Wallet created. Fund it by sending USDC to ${wallet.address} on Base.`
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }
  async sendPayment(args) {
    try {
      const tx = await this.nexus.transactions.send({
        fromAgentId: args.fromAgentId,
        toAddress: args.toAddress,
        amountUsdc: args.amountUsdc,
        category: args.category,
        memo: args.memo
      });
      return JSON.stringify({
        success: true,
        transactionId: tx.id,
        status: tx.status,
        amountUsdc: tx.amountUsdc,
        txHash: tx.txHash,
        message: `Payment of $${args.amountUsdc} USDC sent. Status: ${tx.status}.`
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }
  async p2pTransfer(args) {
    try {
      const result = await this.nexus.p2p.transfer({
        fromAgentId: args.fromAgentId,
        toAgentId: args.toAgentId,
        amountUsdc: args.amountUsdc,
        memo: args.memo
      });
      return JSON.stringify({
        success: true,
        fromBalance: result.from.balanceUsdc,
        toBalance: result.to.balanceUsdc,
        amountUsdc: result.amount,
        isP2P: true,
        message: `Transferred $${args.amountUsdc} USDC from ${args.fromAgentId} to ${args.toAgentId} instantly.`
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }
  async payX402(args) {
    try {
      const result = await this.nexus.x402.pay({
        path: args.endpointPath,
        agentId: args.payingAgentId
      });
      return JSON.stringify({
        success: true,
        endpointPath: args.endpointPath,
        amountPaid: result.charged,
        access: result.access,
        message: `Access granted to ${args.endpointPath}. Paid $${result.charged} USDC.`
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }
  async listTransactions(args) {
    try {
      const result = await this.nexus.transactions.list({
        agentId: args.agentId
      });
      const items = Array.isArray(result) ? result : result.items ?? [];
      const summary = items.slice(0, args.limit ?? 20).map((t) => ({
        id: t.id,
        from: t.fromAgentId,
        to: t.toAgentId || t.toAddress,
        amountUsdc: t.amountUsdc,
        status: t.status,
        category: t.category,
        isP2P: t.isP2P,
        createdAt: t.createdAt
      }));
      return JSON.stringify({ success: true, count: summary.length, transactions: summary });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }
  async checkPolicies(args) {
    try {
      const policies = await this.nexus.policies.list({ agentId: args.agentId });
      if (policies.length === 0) {
        return JSON.stringify({
          success: true,
          agentId: args.agentId,
          policies: [],
          message: "No spending policies set \u2014 this agent has no limits."
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
          allowedCategories: p.allowedCategories
        }))
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }
  async createPolicy(args) {
    try {
      const policy = await this.nexus.policies.create({
        agentId: args.agentId,
        tier: args.tier,
        maxPerTransaction: args.maxPerTransaction,
        dailyLimit: args.dailyLimit,
        monthlyLimit: args.monthlyLimit,
        allowedCategories: args.allowedCategories
      });
      return JSON.stringify({
        success: true,
        policyId: policy.id,
        agentId: policy.agentId,
        tier: policy.tier,
        message: `Spending policy created for ${args.agentId}.`
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }
};
__decorateClass([
  CreateAction({
    name: "nexuspay_get_balance",
    description: "Get the USDC balance of a NexusPay agent wallet on Base. Use this to check how much an agent can spend before attempting a payment.",
    schema: GetBalanceSchema
  })
], NexusPayActionProvider.prototype, "getBalance", 1);
__decorateClass([
  CreateAction({
    name: "nexuspay_list_wallets",
    description: "List all agent wallets managed by this NexusPay instance, including their USDC balances and statuses.",
    schema: ListWalletsSchema
  })
], NexusPayActionProvider.prototype, "listWallets", 1);
__decorateClass([
  CreateAction({
    name: "nexuspay_create_wallet",
    description: "Create a new Coinbase CDP-backed USDC wallet for an AI agent on Base. Each agent should have a unique agentId.",
    schema: CreateWalletSchema
  })
], NexusPayActionProvider.prototype, "createWallet", 1);
__decorateClass([
  CreateAction({
    name: "nexuspay_send_payment",
    description: "Send USDC from an agent wallet to any address on Base. The payment is policy-checked before settlement. Use this for paying external services, APIs, or other recipients.",
    schema: SendPaymentSchema
  })
], NexusPayActionProvider.prototype, "sendPayment", 1);
__decorateClass([
  CreateAction({
    name: "nexuspay_p2p_transfer",
    description: "Instantly transfer USDC between two NexusPay agent wallets. Zero gas, no on-chain settlement needed \u2014 balances swap atomically. Use this when paying another agent for a service.",
    schema: P2PTransferSchema
  })
], NexusPayActionProvider.prototype, "p2pTransfer", 1);
__decorateClass([
  CreateAction({
    name: "nexuspay_pay_x402",
    description: "Pay a NexusPay x402 paywall endpoint to gain access. Use this when an API returns HTTP 402 Payment Required. The agent's balance is debited and access is granted.",
    schema: PayX402Schema
  })
], NexusPayActionProvider.prototype, "payX402", 1);
__decorateClass([
  CreateAction({
    name: "nexuspay_list_transactions",
    description: "List recent transactions for one or all agent wallets. Use this to audit spending, check payment status, or review what an agent has paid for.",
    schema: ListTransactionsSchema
  })
], NexusPayActionProvider.prototype, "listTransactions", 1);
__decorateClass([
  CreateAction({
    name: "nexuspay_check_policies",
    description: "Check the spending policies for an agent wallet \u2014 including per-transaction limits, daily/monthly caps, and allowed payment categories.",
    schema: CheckPoliciesSchema
  })
], NexusPayActionProvider.prototype, "checkPolicies", 1);
__decorateClass([
  CreateAction({
    name: "nexuspay_create_policy",
    description: "Create a spending policy for an agent wallet to enforce limits on how much it can spend per transaction, per day, or per month.",
    schema: CreatePolicySchema
  })
], NexusPayActionProvider.prototype, "createPolicy", 1);
function nexusPayActionProvider(config) {
  return new NexusPayActionProvider(config);
}
export {
  nexusPayActionProvider
};

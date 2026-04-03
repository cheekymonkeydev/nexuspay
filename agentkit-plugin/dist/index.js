"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};

// src/index.ts
var index_exports = {};
__export(index_exports, {
  nexusPayActionProvider: () => nexusPayActionProvider
});
module.exports = __toCommonJS(index_exports);
var import_reflect_metadata = require("reflect-metadata");
var import_agentkit = require("@coinbase/agentkit");
var import_zod = require("zod");
var import_nexuspay_sdk = __toESM(require("nexuspay-sdk"));
var GetBalanceSchema = import_zod.z.object({
  agentId: import_zod.z.string().describe("The agent ID to check the USDC balance for")
});
var ListWalletsSchema = import_zod.z.object({});
var CreateWalletSchema = import_zod.z.object({
  agentId: import_zod.z.string().describe("Unique identifier for the new agent wallet, e.g. 'agent-researcher'")
});
var SendPaymentSchema = import_zod.z.object({
  fromAgentId: import_zod.z.string().describe("Agent ID of the wallet to send from"),
  toAddress: import_zod.z.string().describe("Recipient wallet address on Base (0x...)"),
  amountUsdc: import_zod.z.number().positive().describe("Amount of USDC to send, e.g. 1.50"),
  category: import_zod.z.enum(["compute", "storage", "api", "data", "inference", "other"]).optional().describe("Payment category for policy enforcement and analytics"),
  memo: import_zod.z.string().optional().describe("Optional note to attach to the transaction")
});
var P2PTransferSchema = import_zod.z.object({
  fromAgentId: import_zod.z.string().describe("Agent ID sending the funds"),
  toAgentId: import_zod.z.string().describe("Agent ID receiving the funds"),
  amountUsdc: import_zod.z.number().positive().describe("Amount of USDC to transfer"),
  memo: import_zod.z.string().optional().describe("Optional note, e.g. 'Tool access fee'")
});
var PayX402Schema = import_zod.z.object({
  endpointPath: import_zod.z.string().describe("The x402 paywall endpoint path to access, e.g. /api/premium/inference"),
  payingAgentId: import_zod.z.string().describe("Agent ID that will pay for access")
});
var ListTransactionsSchema = import_zod.z.object({
  agentId: import_zod.z.string().optional().describe("Filter transactions by agent ID. Omit to list all."),
  limit: import_zod.z.number().int().min(1).max(100).optional().describe("Number of transactions to return (default 20, max 100)")
});
var CheckPoliciesSchema = import_zod.z.object({
  agentId: import_zod.z.string().describe("Agent ID to check spending policies for")
});
var CreatePolicySchema = import_zod.z.object({
  agentId: import_zod.z.string().describe("Agent ID this policy applies to"),
  tier: import_zod.z.enum(["CONSERVATIVE", "MODERATE", "AGGRESSIVE", "CUSTOM"]).optional().describe("Policy strictness tier"),
  maxPerTransaction: import_zod.z.number().positive().describe("Maximum USDC allowed per single transaction"),
  dailyLimit: import_zod.z.number().positive().describe("Maximum USDC allowed per day"),
  monthlyLimit: import_zod.z.number().positive().optional().describe("Maximum USDC allowed per month"),
  allowedCategories: import_zod.z.array(import_zod.z.string()).optional().describe("Whitelist of payment categories. Empty means all allowed.")
});
var NexusPayActionProvider = class extends import_agentkit.ActionProvider {
  constructor(config) {
    super("nexuspay", []);
    this.supportsNetwork = (_network) => true;
    this.nexus = new import_nexuspay_sdk.default({ baseUrl: config.baseUrl, apiKey: config.apiKey });
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
  (0, import_agentkit.CreateAction)({
    name: "nexuspay_get_balance",
    description: "Get the USDC balance of a NexusPay agent wallet on Base. Use this to check how much an agent can spend before attempting a payment.",
    schema: GetBalanceSchema
  })
], NexusPayActionProvider.prototype, "getBalance", 1);
__decorateClass([
  (0, import_agentkit.CreateAction)({
    name: "nexuspay_list_wallets",
    description: "List all agent wallets managed by this NexusPay instance, including their USDC balances and statuses.",
    schema: ListWalletsSchema
  })
], NexusPayActionProvider.prototype, "listWallets", 1);
__decorateClass([
  (0, import_agentkit.CreateAction)({
    name: "nexuspay_create_wallet",
    description: "Create a new Coinbase CDP-backed USDC wallet for an AI agent on Base. Each agent should have a unique agentId.",
    schema: CreateWalletSchema
  })
], NexusPayActionProvider.prototype, "createWallet", 1);
__decorateClass([
  (0, import_agentkit.CreateAction)({
    name: "nexuspay_send_payment",
    description: "Send USDC from an agent wallet to any address on Base. The payment is policy-checked before settlement. Use this for paying external services, APIs, or other recipients.",
    schema: SendPaymentSchema
  })
], NexusPayActionProvider.prototype, "sendPayment", 1);
__decorateClass([
  (0, import_agentkit.CreateAction)({
    name: "nexuspay_p2p_transfer",
    description: "Instantly transfer USDC between two NexusPay agent wallets. Zero gas, no on-chain settlement needed \u2014 balances swap atomically. Use this when paying another agent for a service.",
    schema: P2PTransferSchema
  })
], NexusPayActionProvider.prototype, "p2pTransfer", 1);
__decorateClass([
  (0, import_agentkit.CreateAction)({
    name: "nexuspay_pay_x402",
    description: "Pay a NexusPay x402 paywall endpoint to gain access. Use this when an API returns HTTP 402 Payment Required. The agent's balance is debited and access is granted.",
    schema: PayX402Schema
  })
], NexusPayActionProvider.prototype, "payX402", 1);
__decorateClass([
  (0, import_agentkit.CreateAction)({
    name: "nexuspay_list_transactions",
    description: "List recent transactions for one or all agent wallets. Use this to audit spending, check payment status, or review what an agent has paid for.",
    schema: ListTransactionsSchema
  })
], NexusPayActionProvider.prototype, "listTransactions", 1);
__decorateClass([
  (0, import_agentkit.CreateAction)({
    name: "nexuspay_check_policies",
    description: "Check the spending policies for an agent wallet \u2014 including per-transaction limits, daily/monthly caps, and allowed payment categories.",
    schema: CheckPoliciesSchema
  })
], NexusPayActionProvider.prototype, "checkPolicies", 1);
__decorateClass([
  (0, import_agentkit.CreateAction)({
    name: "nexuspay_create_policy",
    description: "Create a spending policy for an agent wallet to enforce limits on how much it can spend per transaction, per day, or per month.",
    schema: CreatePolicySchema
  })
], NexusPayActionProvider.prototype, "createPolicy", 1);
function nexusPayActionProvider(config) {
  return new NexusPayActionProvider(config);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  nexusPayActionProvider
});

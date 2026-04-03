// ─── Wallets ────────────────────────────────────────────────────────────────

export type WalletStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

export interface AgentWallet {
  id: string;
  agentId: string;
  address: string;
  balanceUsdc: number;
  status: WalletStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWalletOptions {
  agentId: string;
  initialFunding?: number;
  metadata?: Record<string, unknown>;
}

// ─── Transactions ────────────────────────────────────────────────────────────

export type TransactionStatus = "PENDING" | "CONFIRMED" | "FAILED" | "REJECTED";

export interface Transaction {
  id: string;
  fromAgentId: string;
  toAddress: string;
  amountUsdc: number;
  status: TransactionStatus;
  txHash: string | null;
  category: string | null;
  memo: string | null;
  isP2P: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SendTransactionOptions {
  fromAgentId: string;
  toAddress: string;
  amountUsdc: number;
  category?: string;
  memo?: string;
}

export interface ListTransactionsOptions {
  agentId?: string;
  status?: TransactionStatus;
  category?: string;
}

// ─── P2P ─────────────────────────────────────────────────────────────────────

export interface P2PTransferOptions {
  fromAgentId: string;
  toAgentId: string;
  amountUsdc: number;
  memo?: string;
}

export interface P2PTransferResult {
  from: AgentWallet;
  to: AgentWallet;
  amount: number;
}

// ─── Policies ────────────────────────────────────────────────────────────────

export type PolicyTier = "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" | "CUSTOM";

export interface SpendingPolicy {
  id: string;
  agentId: string;
  tier: PolicyTier;
  maxPerTransaction: number;
  dailyLimit: number;
  monthlyLimit: number | null;
  allowedRecipients: string[];
  blockedMerchants: string[];
  allowedCategories: string[];
  requireApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePolicyOptions {
  agentId: string;
  tier?: PolicyTier;
  maxPerTransaction: number;
  dailyLimit: number;
  monthlyLimit?: number;
  allowedRecipients?: string[];
  blockedMerchants?: string[];
  allowedCategories?: string[];
  requireApproval?: boolean;
}

// ─── x402 Paywalls ───────────────────────────────────────────────────────────

export interface PaywallEndpoint {
  id: string;
  path: string;
  priceUsdc: number;
  description: string | null;
  isActive: boolean;
  hitCount: number;
  totalPaid: number;
  createdAt: string;
}

export interface RegisterEndpointOptions {
  path: string;
  priceUsdc: number;
  description?: string;
}

export interface PayEndpointOptions {
  path: string;
  agentId: string;
}

export interface PayEndpointResult {
  access: boolean;
  charged: number;
  endpoint: string;
}

// ─── Identity & Credentials ──────────────────────────────────────────────────

export interface AgentCredential {
  id: string;
  agentId: string;
  label: string;
  did: string;
  jwt: string;
  publicKey: string;
  createdAt: string;
}

export interface RegisterCredentialOptions {
  agentId: string;
  label: string;
  publicKey: string;
}

// ─── API Keys ────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyOptions {
  name: string;
  scopes?: string[];
}

export interface CreateApiKeyResult {
  key: string;
  prefix: string;
  name: string;
  scopes: string[];
}

// ─── SDK Config ──────────────────────────────────────────────────────────────

export interface NexusPayConfig {
  /** Base URL of your NexusPay deployment, e.g. https://nexuspay.finance */
  baseUrl: string;
  /** API key for programmatic access (X-Api-Key header) */
  apiKey?: string;
  /** Optional fetch override (e.g. for custom retry logic) */
  fetch?: typeof fetch;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class NexusPayError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message);
    this.name = "NexusPayError";
  }
}

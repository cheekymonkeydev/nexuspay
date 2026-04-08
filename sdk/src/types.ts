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

// ─── MPP (Machine Payments Protocol) ─────────────────────────────────────────

export interface MppEndpoint {
  id: string;
  path: string;
  priceUsdc: number;
  description: string | null;
  intent: "charge" | "session";
  isActive: boolean;
  hitCount: number;
  totalPaid: number;
  createdAt: string;
}

export interface RegisterMppEndpointOptions {
  path: string;
  priceUsdc: number;
  description?: string;
  intent?: "charge" | "session";
}

/** Pay any MPP-protected URL via the NexusPay proxy (handles 402→pay→retry) */
export interface MppPayOptions {
  agentId: string;
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: string;
  maxAmount?: number;
}

export interface MppPayResult {
  status: number;
  body: string;
  receipt?: string;
  transactionId?: string;
  amountPaid: number;
  remainingBalance?: number;
  mppHandled: boolean;
}

/** Fulfill a NexusPay-hosted MPP challenge directly (without proxy) */
export interface MppFulfillOptions {
  agentId: string;
  challengeId: string;
  request: string;
  realm: string;
  method: string;
  intent?: "charge" | "session";
}

export interface MppFulfillResult {
  credential: string;
  receipt: string;
  transactionId: string;
  amountPaid: number;
  remainingBalance: number;
}

// ─── Marketplace ─────────────────────────────────────────────────────────────

export type ServiceType = "DATA_FEED" | "AI_MODEL" | "API_GATEWAY" | "COMPUTE" | "STORAGE" | "AGENT_SKILL" | "COMMUNICATION";
export type PaymentProtocol = "X402" | "MPP" | "P2P";
export type ListingStatus = "DRAFT" | "ACTIVE" | "SUSPENDED" | "DEPRECATED";
export type PricingModel = "per-call" | "per-month" | "per-token" | "metered" | "free";

export interface MarketplaceListing {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDesc: string;
  logoUrl?: string;
  category: ServiceType;
  tags: string[];
  providerAgentId?: string;
  providerName: string;
  providerUrl?: string;
  priceUsdc: number;
  pricingModel: PricingModel;
  protocol: PaymentProtocol;
  endpointPath?: string;
  externalUrl?: string;
  capabilities: Record<string, unknown>;
  slaUptime?: number;
  avgLatencyMs?: number;
  totalRevenue: number;
  totalPurchases: number;
  avgRating?: number;
  reviewCount: number;
  status: ListingStatus;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServicePurchase {
  id: string;
  listingId: string;
  buyerAgentId: string;
  transactionId?: string;
  amountUsdc: number;
  protocol: PaymentProtocol;
  accessToken?: string;
  accessExpiresAt?: string;
  createdAt: string;
}

export interface ServiceReview {
  id: string;
  listingId: string;
  reviewerAgentId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface CreateListingOptions {
  slug: string;
  name: string;
  description: string;
  shortDesc: string;
  logoUrl?: string;
  category: ServiceType;
  tags?: string[];
  providerAgentId?: string;
  providerName: string;
  providerUrl?: string;
  priceUsdc: number;
  pricingModel?: PricingModel;
  protocol: PaymentProtocol;
  endpointPath?: string;
  externalUrl?: string;
  capabilities?: Record<string, unknown>;
  slaUptime?: number;
  avgLatencyMs?: number;
}

export interface MarketplaceSearchOptions {
  category?: ServiceType;
  protocol?: PaymentProtocol;
  q?: string;
  maxPrice?: number;
  sort?: "rating" | "price_asc" | "price_desc" | "purchases" | "newest";
  verified?: boolean;
  page?: number;
  limit?: number;
}

export interface MarketplacePurchaseResult {
  purchaseId: string;
  transactionId?: string;
  amountPaid: number;
  protocol: string;
  accessToken?: string;
  accessExpiresAt?: string;
  paymentInstructions?: { protocol: string; url?: string; sdkCall?: string };
  responseBody?: unknown;
}

// ─── x402 Client ─────────────────────────────────────────────────────────────

export interface X402FetchOptions {
  /** Agent wallet that pays for the request */
  agentId: string;
  /** Target URL to fetch (may or may not be x402-protected) */
  url: string;
  /** HTTP method (default: GET) */
  method?: string;
  /** Request body */
  body?: unknown;
  /** Additional request headers */
  headers?: Record<string, string>;
  /** Maximum USDC willing to pay if a 402 is encountered (default: 1.00) */
  maxAmountUsdc?: number;
}

export interface X402FetchResult {
  /** HTTP status from the target server */
  status: number;
  /** Response body from the target server */
  body: unknown;
  /** USDC charged (0 if the endpoint was not paywalled) */
  amountPaid: number;
  /** NexusPay transaction ID (present when a payment was made) */
  transactionId?: string;
  /** Whether a 402 Payment Required was encountered and automatically paid */
  paywalled: boolean;
  /** NexusPay operator wallet address that made the on-chain payment */
  operatorAddress: string;
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

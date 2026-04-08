import { z } from "zod";

// --- Wallet ---
export const CreateWalletInput = z.object({
  agentId: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateWalletInput = z.infer<typeof CreateWalletInput>;

// --- Policy ---
export const CreatePolicyInput = z.object({
  agentId: z.string().min(1),
  tier: z.enum(["CONSERVATIVE", "MODERATE", "AGGRESSIVE", "CUSTOM"]).default("CUSTOM"),
  maxPerTransaction: z.number().positive(),
  dailyLimit: z.number().positive(),
  monthlyLimit: z.number().positive().optional(),
  allowedRecipients: z.array(z.string()).default([]),
  blockedMerchants: z.array(z.string()).default([]),
  allowedCategories: z.array(z.string()).default([]),
  requireApproval: z.boolean().default(false),
});
export type CreatePolicyInput = z.infer<typeof CreatePolicyInput>;

// --- Transaction ---
export const SendTransactionInput = z.object({
  fromAgentId: z.string().min(1),
  toAddress: z.string().min(1),
  amountUsdc: z.number().positive(),
  category: z.string().optional(),
  memo: z.string().optional(),
});
export type SendTransactionInput = z.infer<typeof SendTransactionInput>;

// --- P2P Transfer ---
export const P2PTransferInput = z.object({
  fromAgentId: z.string().min(1),
  toAgentId: z.string().min(1),
  amountUsdc: z.number().positive(),
  memo: z.string().optional(),
});
export type P2PTransferInput = z.infer<typeof P2PTransferInput>;

// --- Identity ---
export const RegisterCredentialInput = z.object({
  agentId: z.string().min(1),
  label: z.string().min(1),
  publicKey: z.string().min(1),
});
export type RegisterCredentialInput = z.infer<typeof RegisterCredentialInput>;

// --- x402 Paywall ---
export const RegisterPaywallInput = z.object({
  path: z.string().min(1),
  priceUsdc: z.number().positive(),
  description: z.string().optional(),
});
export type RegisterPaywallInput = z.infer<typeof RegisterPaywallInput>;

export const PaywallPaymentInput = z.object({
  path: z.string().min(1),
  agentId: z.string().min(1),
});
export type PaywallPaymentInput = z.infer<typeof PaywallPaymentInput>;

// --- API Key ---
export const CreateApiKeyInput = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).default(["read", "write"]),
});
export type CreateApiKeyInput = z.infer<typeof CreateApiKeyInput>;

// --- Marketplace ---
export const SERVICE_TYPES = ["DATA_FEED", "AI_MODEL", "API_GATEWAY", "COMPUTE", "STORAGE", "AGENT_SKILL", "COMMUNICATION"] as const;
export const PAYMENT_PROTOCOLS = ["X402", "MPP", "P2P"] as const;
export const LISTING_STATUSES = ["DRAFT", "ACTIVE", "SUSPENDED", "DEPRECATED"] as const;

export const CreateListingInput = z.object({
  slug:           z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  name:           z.string().min(1).max(120),
  description:    z.string().min(1),
  shortDesc:      z.string().min(1).max(160),
  logoUrl:        z.string().url().optional(),
  category:       z.enum(SERVICE_TYPES),
  tags:           z.array(z.string()).default([]),
  providerAgentId: z.string().optional(),
  providerName:   z.string().min(1),
  providerUrl:    z.string().url().optional(),
  priceUsdc:      z.number().min(0),
  pricingModel:   z.enum(["per-call", "per-month", "per-token", "metered", "free"]).default("per-call"),
  protocol:       z.enum(PAYMENT_PROTOCOLS),
  endpointPath:   z.string().optional(),
  externalUrl:    z.string().url().optional(),
  capabilities:   z.record(z.unknown()).default({}),
  slaUptime:      z.number().min(0).max(100).optional(),
  avgLatencyMs:   z.number().int().positive().optional(),
});
export type CreateListingInput = z.infer<typeof CreateListingInput>;

export const PurchaseListingInput = z.object({
  agentId:      z.string().min(1),
  maxAmountUsdc: z.number().positive().optional(),
});
export type PurchaseListingInput = z.infer<typeof PurchaseListingInput>;

export const CreateReviewInput = z.object({
  reviewerAgentId: z.string().min(1),
  rating:          z.number().int().min(1).max(5),
  comment:         z.string().max(1000).optional(),
});
export type CreateReviewInput = z.infer<typeof CreateReviewInput>;

// --- Response wrappers ---
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

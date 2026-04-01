import { z } from "zod";

// --- Wallet ---
export const CreateWalletInput = z.object({
  agentId: z.string().min(1),
  initialFunding: z.number().min(0).default(10),
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

// --- Response wrappers ---
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

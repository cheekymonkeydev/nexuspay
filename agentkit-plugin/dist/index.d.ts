import { ActionProvider, WalletProvider, Network } from '@coinbase/agentkit';
import { z } from 'zod';

interface NexusPayPluginConfig {
    /** Your NexusPay deployment URL, e.g. https://your-nexuspay.vercel.app */
    baseUrl: string;
    /** API key created in the NexusPay dashboard under API Keys */
    apiKey: string;
}
declare const GetBalanceSchema: z.ZodObject<{
    agentId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    agentId: string;
}, {
    agentId: string;
}>;
declare const ListWalletsSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
declare const CreateWalletSchema: z.ZodObject<{
    agentId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    agentId: string;
}, {
    agentId: string;
}>;
declare const SendPaymentSchema: z.ZodObject<{
    fromAgentId: z.ZodString;
    toAddress: z.ZodString;
    amountUsdc: z.ZodNumber;
    category: z.ZodOptional<z.ZodEnum<["compute", "storage", "api", "data", "inference", "other"]>>;
    memo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    fromAgentId: string;
    toAddress: string;
    amountUsdc: number;
    category?: "compute" | "storage" | "api" | "data" | "inference" | "other" | undefined;
    memo?: string | undefined;
}, {
    fromAgentId: string;
    toAddress: string;
    amountUsdc: number;
    category?: "compute" | "storage" | "api" | "data" | "inference" | "other" | undefined;
    memo?: string | undefined;
}>;
declare const P2PTransferSchema: z.ZodObject<{
    fromAgentId: z.ZodString;
    toAgentId: z.ZodString;
    amountUsdc: z.ZodNumber;
    memo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    fromAgentId: string;
    amountUsdc: number;
    toAgentId: string;
    memo?: string | undefined;
}, {
    fromAgentId: string;
    amountUsdc: number;
    toAgentId: string;
    memo?: string | undefined;
}>;
declare const PayX402Schema: z.ZodObject<{
    endpointPath: z.ZodString;
    payingAgentId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    endpointPath: string;
    payingAgentId: string;
}, {
    endpointPath: string;
    payingAgentId: string;
}>;
declare const ListTransactionsSchema: z.ZodObject<{
    agentId: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    agentId?: string | undefined;
    limit?: number | undefined;
}, {
    agentId?: string | undefined;
    limit?: number | undefined;
}>;
declare const CheckPoliciesSchema: z.ZodObject<{
    agentId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    agentId: string;
}, {
    agentId: string;
}>;
declare const CreatePolicySchema: z.ZodObject<{
    agentId: z.ZodString;
    tier: z.ZodOptional<z.ZodEnum<["CONSERVATIVE", "MODERATE", "AGGRESSIVE", "CUSTOM"]>>;
    maxPerTransaction: z.ZodNumber;
    dailyLimit: z.ZodNumber;
    monthlyLimit: z.ZodOptional<z.ZodNumber>;
    allowedCategories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    maxPerTransaction: number;
    dailyLimit: number;
    tier?: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" | "CUSTOM" | undefined;
    monthlyLimit?: number | undefined;
    allowedCategories?: string[] | undefined;
}, {
    agentId: string;
    maxPerTransaction: number;
    dailyLimit: number;
    tier?: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" | "CUSTOM" | undefined;
    monthlyLimit?: number | undefined;
    allowedCategories?: string[] | undefined;
}>;
declare class NexusPayActionProvider extends ActionProvider<WalletProvider> {
    private readonly nexus;
    constructor(config: NexusPayPluginConfig);
    getBalance(args: z.infer<typeof GetBalanceSchema>): Promise<string>;
    listWallets(_args: z.infer<typeof ListWalletsSchema>): Promise<string>;
    createWallet(args: z.infer<typeof CreateWalletSchema>): Promise<string>;
    sendPayment(args: z.infer<typeof SendPaymentSchema>): Promise<string>;
    p2pTransfer(args: z.infer<typeof P2PTransferSchema>): Promise<string>;
    payX402(args: z.infer<typeof PayX402Schema>): Promise<string>;
    listTransactions(args: z.infer<typeof ListTransactionsSchema>): Promise<string>;
    checkPolicies(args: z.infer<typeof CheckPoliciesSchema>): Promise<string>;
    createPolicy(args: z.infer<typeof CreatePolicySchema>): Promise<string>;
    supportsNetwork: (_network: Network) => boolean;
}
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
declare function nexusPayActionProvider(config: NexusPayPluginConfig): NexusPayActionProvider;

export { type NexusPayPluginConfig as NexusPayConfig, type NexusPayPluginConfig, nexusPayActionProvider };

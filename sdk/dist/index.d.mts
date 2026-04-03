type WalletStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";
interface AgentWallet {
    id: string;
    agentId: string;
    address: string;
    balanceUsdc: number;
    status: WalletStatus;
    createdAt: string;
    updatedAt: string;
}
interface CreateWalletOptions {
    agentId: string;
    initialFunding?: number;
    metadata?: Record<string, unknown>;
}
type TransactionStatus = "PENDING" | "CONFIRMED" | "FAILED" | "REJECTED";
interface Transaction {
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
interface SendTransactionOptions {
    fromAgentId: string;
    toAddress: string;
    amountUsdc: number;
    category?: string;
    memo?: string;
}
interface ListTransactionsOptions {
    agentId?: string;
    status?: TransactionStatus;
    category?: string;
}
interface P2PTransferOptions {
    fromAgentId: string;
    toAgentId: string;
    amountUsdc: number;
    memo?: string;
}
interface P2PTransferResult {
    from: AgentWallet;
    to: AgentWallet;
    amount: number;
}
type PolicyTier = "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" | "CUSTOM";
interface SpendingPolicy {
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
interface CreatePolicyOptions {
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
interface PaywallEndpoint {
    id: string;
    path: string;
    priceUsdc: number;
    description: string | null;
    isActive: boolean;
    hitCount: number;
    totalPaid: number;
    createdAt: string;
}
interface RegisterEndpointOptions {
    path: string;
    priceUsdc: number;
    description?: string;
}
interface PayEndpointOptions {
    path: string;
    agentId: string;
}
interface PayEndpointResult {
    access: boolean;
    charged: number;
    endpoint: string;
}
interface AgentCredential {
    id: string;
    agentId: string;
    label: string;
    did: string;
    jwt: string;
    publicKey: string;
    createdAt: string;
}
interface RegisterCredentialOptions {
    agentId: string;
    label: string;
    publicKey: string;
}
interface ApiKey {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    isActive: boolean;
    lastUsedAt: string | null;
    createdAt: string;
}
interface CreateApiKeyOptions {
    name: string;
    scopes?: string[];
}
interface CreateApiKeyResult {
    key: string;
    prefix: string;
    name: string;
    scopes: string[];
}
interface NexusPayConfig {
    /** Base URL of your NexusPay deployment, e.g. https://nexuspay.finance */
    baseUrl: string;
    /** API key for programmatic access (X-Api-Key header) */
    apiKey?: string;
    /** Optional fetch override (e.g. for custom retry logic) */
    fetch?: typeof fetch;
}
declare class NexusPayError extends Error {
    readonly status: number;
    readonly body: unknown;
    constructor(message: string, status: number, body: unknown);
}

declare class NexusPay {
    private readonly baseUrl;
    private readonly headers;
    private readonly _fetch;
    constructor(config: NexusPayConfig);
    private request;
    readonly wallets: {
        /** Create a new agent wallet */
        create: (opts: CreateWalletOptions) => Promise<AgentWallet>;
        /** List all wallets */
        list: () => Promise<AgentWallet[]>;
        /** Get a single wallet by agentId */
        get: (agentId: string) => Promise<AgentWallet>;
        /** Suspend or reactivate a wallet */
        setStatus: (agentId: string, status: WalletStatus) => Promise<AgentWallet>;
    };
    readonly transactions: {
        /** Send an on-chain USDC transaction */
        send: (opts: SendTransactionOptions) => Promise<Transaction>;
        /** List transactions with optional filters */
        list: (opts?: ListTransactionsOptions) => Promise<Transaction[]>;
    };
    readonly p2p: {
        /** Transfer USDC between two agent wallets (off-chain, instant) */
        transfer: (opts: P2PTransferOptions) => Promise<P2PTransferResult>;
    };
    readonly policies: {
        /** Create a spending policy for an agent */
        create: (opts: CreatePolicyOptions) => Promise<SpendingPolicy>;
        /** List policies (optionally filtered by agentId or tier) */
        list: (opts?: {
            agentId?: string;
            tier?: string;
        }) => Promise<SpendingPolicy[]>;
    };
    readonly x402: {
        /** Register a new paywall endpoint */
        register: (opts: RegisterEndpointOptions) => Promise<PaywallEndpoint>;
        /** Pay to access a paywall endpoint */
        pay: (opts: PayEndpointOptions) => Promise<PayEndpointResult>;
        /** List all paywall endpoints */
        list: () => Promise<PaywallEndpoint[]>;
    };
    readonly identity: {
        /** Register a DID credential for an agent */
        register: (opts: RegisterCredentialOptions) => Promise<AgentCredential>;
        /** List credentials (optionally filtered by agentId) */
        list: (agentId?: string) => Promise<AgentCredential[]>;
    };
    readonly keys: {
        /** Create a new API key */
        create: (opts: CreateApiKeyOptions) => Promise<CreateApiKeyResult>;
        /** List all API keys (hashed — raw key shown only on creation) */
        list: () => Promise<ApiKey[]>;
    };
}

export { type AgentCredential, type AgentWallet, type ApiKey, type CreateApiKeyOptions, type CreateApiKeyResult, type CreatePolicyOptions, type CreateWalletOptions, type ListTransactionsOptions, NexusPay, type NexusPayConfig, NexusPayError, type P2PTransferOptions, type P2PTransferResult, type PayEndpointOptions, type PayEndpointResult, type PaywallEndpoint, type PolicyTier, type RegisterCredentialOptions, type RegisterEndpointOptions, type SendTransactionOptions, type SpendingPolicy, type Transaction, type TransactionStatus, type WalletStatus, NexusPay as default };

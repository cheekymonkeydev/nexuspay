export interface MppAdapterConfig {
    /** Price in USDC, e.g. 0.10 */
    price: number;
    /** Human-readable realm shown in the challenge.
     *  Defaults to NEXUSPAY_MPP_REALM env → NEXT_PUBLIC_APP_URL hostname → "localhost" */
    realm?: string;
    /** Challenge TTL in milliseconds. Default: 300_000 (5 minutes) */
    challengeTtlMs?: number;
    /** Optional safety cap — throws at decoration time if price > maxPrice */
    maxPrice?: number;
    /** Override the NexusPay base URL (default: NEXUSPAY_URL env var) */
    nexuspayUrl?: string;
    /** Override the NexusPay API key (default: NEXUSPAY_API_KEY env var) */
    apiKey?: string;
}
export interface MppChallengeData {
    amount: string;
    currency: "usdc";
    endpointPath: string;
    expires: number;
}
export interface MppChallenge {
    id: string;
    realm: string;
    method: "nexuspay";
    intent: "charge";
    request: string;
}
export interface MppCredential {
    challenge: {
        id: string;
    };
    source: string;
    payload: {
        transactionId: string;
    };
}
export interface NexusPayTransaction {
    id: string;
    fromAgentId: string;
    toAddress: string;
    amountUsdc: number;
    status: "PENDING" | "CONFIRMED" | "FAILED" | "REJECTED";
    category?: string;
    memo?: string;
    createdAt: string;
}
export interface NexusPayApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
export type VerifyResult = {
    ok: true;
    transactionId: string;
    agentId: string;
    amountUsdc: number;
} | {
    ok: false;
    status: number;
    problem: string;
    detail: string;
};
export interface ReceiptData {
    method: "nexuspay";
    reference: string;
    timestamp: string;
    agentId: string;
    amountUsdc: number;
}

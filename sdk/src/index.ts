export * from "./types";
import type {
  NexusPayConfig,
  AgentWallet,
  CreateWalletOptions,
  WalletStatus,
  Transaction,
  SendTransactionOptions,
  ListTransactionsOptions,
  P2PTransferOptions,
  P2PTransferResult,
  SpendingPolicy,
  CreatePolicyOptions,
  PaywallEndpoint,
  RegisterEndpointOptions,
  PayEndpointOptions,
  PayEndpointResult,
  AgentCredential,
  RegisterCredentialOptions,
  ApiKey,
  CreateApiKeyOptions,
  CreateApiKeyResult,
  MppEndpoint,
  RegisterMppEndpointOptions,
  MppPayOptions,
  MppPayResult,
  MppFulfillOptions,
  MppFulfillResult,
} from "./types";
import { NexusPayError } from "./types";

export class NexusPay {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly _fetch: typeof fetch;

  constructor(config: NexusPayConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.headers = { "Content-Type": "application/json" };
    if (config.apiKey) this.headers["X-Api-Key"] = config.apiKey;
    this._fetch = config.fetch ?? globalThis.fetch;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (query) {
      const params = new URLSearchParams(
        Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== ""))
      );
      if (params.size > 0) url += `?${params}`;
    }

    const res = await this._fetch(url, {
      method,
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const json = (await res.json()) as { data?: T; error?: string };

    if (!res.ok) {
      throw new NexusPayError(
        json.error ?? `HTTP ${res.status}`,
        res.status,
        json
      );
    }

    return json.data as T;
  }

  // ─── Wallets ───────────────────────────────────────────────────────────────

  readonly wallets = {
    /** Create a new agent wallet */
    create: (opts: CreateWalletOptions): Promise<AgentWallet> =>
      this.request("POST", "/api/wallets", opts),

    /** List all wallets */
    list: (): Promise<AgentWallet[]> =>
      this.request("GET", "/api/wallets"),

    /** Get a single wallet by agentId */
    get: (agentId: string): Promise<AgentWallet> =>
      this.request("GET", `/api/wallets/${agentId}`),

    /** Suspend or reactivate a wallet */
    setStatus: (agentId: string, status: WalletStatus): Promise<AgentWallet> =>
      this.request("PATCH", `/api/wallets/${agentId}`, { status }),
  };

  // ─── Transactions ──────────────────────────────────────────────────────────

  readonly transactions = {
    /** Send an on-chain USDC transaction */
    send: (opts: SendTransactionOptions): Promise<Transaction> =>
      this.request("POST", "/api/transactions", opts),

    /** List transactions with optional filters */
    list: (opts: ListTransactionsOptions = {}): Promise<Transaction[]> =>
      this.request("GET", "/api/transactions", undefined, {
        agentId: opts.agentId ?? "",
        status: opts.status ?? "",
        category: opts.category ?? "",
      }),

    /** Get a single transaction by ID */
    get: (id: string): Promise<Transaction> =>
      this.request("GET", `/api/transactions/${id}`),
  };

  // ─── P2P ──────────────────────────────────────────────────────────────────

  readonly p2p = {
    /** Transfer USDC between two agent wallets (off-chain, instant) */
    transfer: (opts: P2PTransferOptions): Promise<P2PTransferResult> =>
      this.request("POST", "/api/p2p", opts),
  };

  // ─── Policies ─────────────────────────────────────────────────────────────

  readonly policies = {
    /** Create a spending policy for an agent */
    create: (opts: CreatePolicyOptions): Promise<SpendingPolicy> =>
      this.request("POST", "/api/policies", opts),

    /** List policies (optionally filtered by agentId or tier) */
    list: (opts: { agentId?: string; tier?: string } = {}): Promise<SpendingPolicy[]> =>
      this.request("GET", "/api/policies", undefined, {
        agentId: opts.agentId ?? "",
        tier: opts.tier ?? "",
      }),
  };

  // ─── x402 Paywalls ────────────────────────────────────────────────────────

  readonly x402 = {
    /** Register a new paywall endpoint */
    register: (opts: RegisterEndpointOptions): Promise<PaywallEndpoint> =>
      this.request("POST", "/api/x402", opts),

    /** Pay to access a paywall endpoint */
    pay: (opts: PayEndpointOptions): Promise<PayEndpointResult> =>
      this.request("POST", "/api/x402", opts),

    /** List all paywall endpoints */
    list: (): Promise<PaywallEndpoint[]> =>
      this.request("GET", "/api/x402"),
  };

  // ─── Identity ─────────────────────────────────────────────────────────────

  readonly identity = {
    /** Register a DID credential for an agent */
    register: (opts: RegisterCredentialOptions): Promise<AgentCredential> =>
      this.request("POST", "/api/identity", opts),

    /** List credentials (optionally filtered by agentId) */
    list: (agentId?: string): Promise<AgentCredential[]> =>
      this.request("GET", "/api/identity", undefined, { agentId: agentId ?? "" }),
  };

  // ─── API Keys ─────────────────────────────────────────────────────────────

  readonly keys = {
    /** Create a new API key */
    create: (opts: CreateApiKeyOptions): Promise<CreateApiKeyResult> =>
      this.request("POST", "/api/keys", { name: opts.name, scopes: opts.scopes ?? ["*"] }),

    /** List all API keys (hashed — raw key shown only on creation) */
    list: (): Promise<ApiKey[]> =>
      this.request("GET", "/api/keys"),
  };

  // ─── MPP (Machine Payments Protocol) ──────────────────────────────────────

  readonly mpp = {
    /**
     * Register a new MPP paywall endpoint on NexusPay.
     * Once registered, it's accessible at /api/mpp/gateway{path}.
     */
    register: (opts: RegisterMppEndpointOptions): Promise<MppEndpoint> =>
      this.request("POST", "/api/mpp", opts),

    /** List all registered MPP endpoints */
    list: (): Promise<MppEndpoint[]> =>
      this.request("GET", "/api/mpp"),

    /** Toggle an endpoint active or inactive */
    toggle: (id: string, isActive: boolean): Promise<MppEndpoint> =>
      this.request("PATCH", `/api/mpp/${id}`, { isActive }),

    /** Delete an endpoint */
    delete: (id: string): Promise<void> =>
      this.request("DELETE", `/api/mpp/${id}`),

    /**
     * Pay any MPP-protected URL via the NexusPay proxy.
     * Works for both NexusPay-hosted endpoints AND external apps using
     * nexuspay-mpp-adapter. Handles the full 402 → pay → retry cycle.
     *
     * @example
     * const result = await client.mpp.pay({
     *   agentId: "my-agent",
     *   url: "https://api.example.com/premium-data",
     *   maxAmount: 1.00,
     * });
     */
    pay: (opts: MppPayOptions): Promise<MppPayResult> =>
      this.request("POST", "/api/mpp/pay", opts),

    /**
     * Fulfill a NexusPay-hosted MPP challenge directly (low-level).
     * Use mpp.pay() instead unless you're implementing a custom MPP client
     * and are handling the HTTP cycle yourself.
     *
     * ⚠ Only works for challenges issued by THIS NexusPay instance.
     * For external apps using nexuspay-mpp-adapter, use mpp.pay() instead.
     */
    fulfill: (opts: MppFulfillOptions): Promise<MppFulfillResult> =>
      this.request("POST", "/api/mpp/fulfill", opts),
  };
}

export default NexusPay;

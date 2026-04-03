// src/types.ts
var NexusPayError = class extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
    this.name = "NexusPayError";
  }
};

// src/index.ts
var NexusPay = class {
  constructor(config) {
    // ─── Wallets ───────────────────────────────────────────────────────────────
    this.wallets = {
      /** Create a new agent wallet */
      create: (opts) => this.request("POST", "/api/wallets", opts),
      /** List all wallets */
      list: () => this.request("GET", "/api/wallets"),
      /** Get a single wallet by agentId */
      get: (agentId) => this.request("GET", `/api/wallets/${agentId}`),
      /** Suspend or reactivate a wallet */
      setStatus: (agentId, status) => this.request("PATCH", `/api/wallets/${agentId}`, { status })
    };
    // ─── Transactions ──────────────────────────────────────────────────────────
    this.transactions = {
      /** Send an on-chain USDC transaction */
      send: (opts) => this.request("POST", "/api/transactions", opts),
      /** List transactions with optional filters */
      list: (opts = {}) => this.request("GET", "/api/transactions", void 0, {
        agentId: opts.agentId ?? "",
        status: opts.status ?? "",
        category: opts.category ?? ""
      })
    };
    // ─── P2P ──────────────────────────────────────────────────────────────────
    this.p2p = {
      /** Transfer USDC between two agent wallets (off-chain, instant) */
      transfer: (opts) => this.request("POST", "/api/p2p", opts)
    };
    // ─── Policies ─────────────────────────────────────────────────────────────
    this.policies = {
      /** Create a spending policy for an agent */
      create: (opts) => this.request("POST", "/api/policies", opts),
      /** List policies (optionally filtered by agentId or tier) */
      list: (opts = {}) => this.request("GET", "/api/policies", void 0, {
        agentId: opts.agentId ?? "",
        tier: opts.tier ?? ""
      })
    };
    // ─── x402 Paywalls ────────────────────────────────────────────────────────
    this.x402 = {
      /** Register a new paywall endpoint */
      register: (opts) => this.request("POST", "/api/x402", opts),
      /** Pay to access a paywall endpoint */
      pay: (opts) => this.request("POST", "/api/x402", opts),
      /** List all paywall endpoints */
      list: () => this.request("GET", "/api/x402")
    };
    // ─── Identity ─────────────────────────────────────────────────────────────
    this.identity = {
      /** Register a DID credential for an agent */
      register: (opts) => this.request("POST", "/api/identity", opts),
      /** List credentials (optionally filtered by agentId) */
      list: (agentId) => this.request("GET", "/api/identity", void 0, { agentId: agentId ?? "" })
    };
    // ─── API Keys ─────────────────────────────────────────────────────────────
    this.keys = {
      /** Create a new API key */
      create: (opts) => this.request("POST", "/api/keys", { name: opts.name, scopes: opts.scopes ?? ["*"] }),
      /** List all API keys (hashed — raw key shown only on creation) */
      list: () => this.request("GET", "/api/keys")
    };
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.headers = { "Content-Type": "application/json" };
    if (config.apiKey) this.headers["X-Api-Key"] = config.apiKey;
    this._fetch = config.fetch ?? globalThis.fetch;
  }
  async request(method, path, body, query) {
    let url = `${this.baseUrl}${path}`;
    if (query) {
      const params = new URLSearchParams(
        Object.fromEntries(Object.entries(query).filter(([, v]) => v !== void 0 && v !== ""))
      );
      if (params.size > 0) url += `?${params}`;
    }
    const res = await this._fetch(url, {
      method,
      headers: this.headers,
      body: body !== void 0 ? JSON.stringify(body) : void 0
    });
    const json = await res.json();
    if (!res.ok) {
      throw new NexusPayError(
        json.error ?? `HTTP ${res.status}`,
        res.status,
        json
      );
    }
    return json.data;
  }
};
var index_default = NexusPay;
export {
  NexusPay,
  NexusPayError,
  index_default as default
};

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { NexusLogo, AmbientGlow } from "@/components/shared";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */
interface SidebarSection {
  id: string;
  label: string;
  children?: { id: string; label: string }[];
}

/* ═══════════════════════════════════════════════════════
   Sidebar nav structure
   ═══════════════════════════════════════════════════════ */
const SIDEBAR: SidebarSection[] = [
  { id: "introduction", label: "Introduction" },
  { id: "authentication", label: "Authentication" },
  {
    id: "wallets", label: "Wallets",
    children: [
      { id: "wallets-list", label: "List wallets" },
      { id: "wallets-create", label: "Create wallet" },
    ],
  },
  {
    id: "transactions", label: "Transactions",
    children: [
      { id: "transactions-list", label: "List transactions" },
      { id: "transactions-send", label: "Send transaction" },
    ],
  },
  {
    id: "p2p", label: "P2P Transfers",
    children: [
      { id: "p2p-transfer", label: "Transfer between agents" },
    ],
  },
  {
    id: "policies", label: "Spending Policies",
    children: [
      { id: "policies-list", label: "List policies" },
      { id: "policies-create", label: "Create policy" },
    ],
  },
  {
    id: "x402", label: "x402 Paywall",
    children: [
      { id: "x402-list", label: "List endpoints" },
      { id: "x402-register", label: "Register endpoint" },
    ],
  },
  {
    id: "identity", label: "Identity & Keys",
    children: [
      { id: "identity-issue", label: "Issue credential" },
      { id: "identity-verify", label: "Verify credential" },
      { id: "keys-create", label: "Create API key" },
    ],
  },
  { id: "errors", label: "Error Reference" },
];

/* ═══════════════════════════════════════════════════════
   Inline Code
   ═══════════════════════════════════════════════════════ */
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      fontFamily: "var(--font-mono)", fontSize: "0.85em",
      padding: "2px 7px", borderRadius: 5,
      background: "rgba(139,92,246,0.1)",
      border: "1px solid rgba(139,92,246,0.15)",
      color: "var(--violet-300)",
    }}>{children}</code>
  );
}

/* ═══════════════════════════════════════════════════════
   Code block with optional copy
   ═══════════════════════════════════════════════════════ */
function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div style={{
      position: "relative",
      borderRadius: "var(--radius-md)",
      border: "1px solid var(--border)",
      background: "rgba(9,9,15,0.9)",
      overflow: "hidden",
      marginBottom: 24,
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px",
        background: "rgba(15,15,24,0.7)",
        borderBottom: "1px solid var(--border-subtle)",
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "var(--text-tertiary)", textTransform: "uppercase" }}>{lang}</span>
        <button
          onClick={copy}
          style={{
            fontSize: 11, fontWeight: 600, color: copied ? "var(--cyan-400)" : "var(--text-tertiary)",
            letterSpacing: "0.04em", transition: "color 0.2s",
            padding: "3px 8px", borderRadius: 4,
            background: copied ? "rgba(6,182,212,0.08)" : "transparent",
            border: `1px solid ${copied ? "rgba(6,182,212,0.2)" : "transparent"}`,
          }}
        >{copied ? "COPIED" : "COPY"}</button>
      </div>
      <pre style={{
        padding: "20px",
        fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.75,
        color: "var(--violet-200)",
        overflowX: "auto", margin: 0,
      }}>{code}</pre>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Method badge
   ═══════════════════════════════════════════════════════ */
function Method({ m }: { m: "GET" | "POST" | "DELETE" }) {
  const colors: Record<string, string> = {
    GET: "rgba(6,182,212,0.15)",
    POST: "rgba(139,92,246,0.15)",
    DELETE: "rgba(239,68,68,0.15)",
  };
  const text: Record<string, string> = {
    GET: "var(--cyan-400)",
    POST: "var(--violet-300)",
    DELETE: "#f87171",
  };
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
      letterSpacing: "0.05em",
      padding: "3px 9px", borderRadius: 5,
      background: colors[m], color: text[m],
      border: `1px solid ${text[m]}22`,
    }}>{m}</span>
  );
}

/* ═══════════════════════════════════════════════════════
   Endpoint row
   ═══════════════════════════════════════════════════════ */
function Endpoint({ method, path }: { method: "GET" | "POST" | "DELETE"; path: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "14px 18px",
      background: "rgba(15,15,24,0.6)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
      marginBottom: 20,
      fontFamily: "var(--font-mono)", fontSize: 14,
    }}>
      <Method m={method} />
      <span style={{ color: "var(--text-secondary)" }}>
        <span style={{ color: "var(--text-tertiary)" }}>https://nexuspay.app</span>
        <span style={{ color: "var(--text)" }}>{path}</span>
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Section heading
   ═══════════════════════════════════════════════════════ */
function H1({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      style={{
        fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800,
        letterSpacing: "-0.025em", color: "var(--text)",
        marginBottom: 12, paddingTop: 56, scrollMarginTop: 80,
      }}
    >
      {children}
    </h2>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3
      id={id}
      style={{
        fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700,
        letterSpacing: "-0.02em", color: "var(--text)",
        marginBottom: 10, paddingTop: 40, scrollMarginTop: 80,
      }}
    >
      {children}
    </h3>
  );
}

function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{
      fontSize: 15, lineHeight: 1.75, color: "var(--text-secondary)",
      marginBottom: 20, ...style,
    }}>{children}</p>
  );
}

/* ═══════════════════════════════════════════════════════
   Params table
   ═══════════════════════════════════════════════════════ */
function ParamsTable({ rows }: {
  rows: { name: string; type: string; req?: boolean; desc: string }[];
}) {
  return (
    <div style={{
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
      overflow: "hidden",
      marginBottom: 28,
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "rgba(15,15,24,0.7)", borderBottom: "1px solid var(--border-subtle)" }}>
            {["Parameter", "Type", "Description"].map((h) => (
              <th key={h} style={{
                padding: "11px 16px", textAlign: "left",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                color: "var(--text-tertiary)", textTransform: "uppercase",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
              <td style={{ padding: "12px 16px", verticalAlign: "top" }}>
                <Code>{r.name}</Code>
                {r.req && <span style={{ fontSize: 10, fontWeight: 700, color: "#f87171", marginLeft: 6, letterSpacing: "0.04em" }}>REQUIRED</span>}
              </td>
              <td style={{ padding: "12px 16px", verticalAlign: "top" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--cyan-400)" }}>{r.type}</span>
              </td>
              <td style={{ padding: "12px 16px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, verticalAlign: "top" }}>{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Callout box
   ═══════════════════════════════════════════════════════ */
function Callout({ type = "info", children }: { type?: "info" | "warn"; children: React.ReactNode }) {
  const isWarn = type === "warn";
  return (
    <div style={{
      padding: "14px 18px",
      borderRadius: "var(--radius-md)",
      border: `1px solid ${isWarn ? "rgba(234,179,8,0.2)" : "rgba(139,92,246,0.2)"}`,
      background: isWarn ? "rgba(234,179,8,0.04)" : "rgba(139,92,246,0.04)",
      marginBottom: 24,
      display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{isWarn ? "⚠" : "ℹ"}</span>
      <span style={{ fontSize: 14, lineHeight: 1.65, color: isWarn ? "#fde047" : "var(--violet-200)" }}>{children}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Divider
   ═══════════════════════════════════════════════════════ */
function Divider() {
  return <div style={{ height: 1, background: "var(--border-subtle)", margin: "48px 0" }} />;
}

/* ═══════════════════════════════════════════════════════
   Main docs content
   ═══════════════════════════════════════════════════════ */
function DocsContent() {
  return (
    <div style={{ maxWidth: 740 }}>

      {/* ── Introduction ── */}
      <H1 id="introduction">Introduction</H1>
      <P>
        NexusPay is a managed payment infrastructure for AI agents. It provides agent wallets backed by
        real USDC on Base, policy-gated spending, instant P2P transfers between agents, and{" "}
        <Code>x402</Code> micropayment paywalls — all via a single REST API.
      </P>
      <P>
        Every API response follows a consistent envelope:
      </P>
      <CodeBlock lang="json" code={`{
  "success": true,
  "data": { ... }
}

// On error:
{
  "success": false,
  "error": "Human-readable message"
}`} />

      <Callout>
        Base URL: <Code>https://nexuspay.app/api</Code>. All amounts are denominated in USDC (dollars). The API accepts and returns decimal values — <Code>{"10.50"}</Code> means $10.50 USDC.
      </Callout>

      <Divider />

      {/* ── Authentication ── */}
      <H1 id="authentication">Authentication</H1>
      <P>
        All API requests must include an API key in the <Code>X-Api-Key</Code> header. Keys are
        created per-agent and scoped to their associated wallet.
      </P>
      <CodeBlock lang="bash" code={`curl https://nexuspay.app/api/wallets \\
  -H "X-Api-Key: nxp_live_sk_•••••••••••••••"`} />
      <P>
        Keys are hashed with SHA-256 before storage — NexusPay never holds your plaintext key after
        creation. Store it immediately on first issue.
      </P>
      <Callout type="warn">
        API keys grant full access to the associated agent wallet. Never expose them client-side or
        commit them to source control.
      </Callout>

      <Divider />

      {/* ── Wallets ── */}
      <H1 id="wallets">Wallets</H1>
      <P>
        Agent wallets hold USDC balances and interact with the Base blockchain via Coinbase CDP.
        Each wallet has a unique on-chain address, an internal agent ID, and an optional spending policy.
      </P>

      <H2 id="wallets-list">List wallets</H2>
      <Endpoint method="GET" path="/wallets" />
      <P>Returns all agent wallets with current balances and status.</P>
      <CodeBlock lang="bash" code={`curl https://nexuspay.app/api/wallets \\
  -H "X-Api-Key: nxp_live_sk_•••"`} />
      <CodeBlock lang="json" code={`{
  "success": true,
  "data": [
    {
      "agentId": "agent-alpha",
      "address": "0x7a3f...8b2c",
      "balanceUsdc": 245.50,
      "status": "ACTIVE",
      "createdAt": "2025-03-01T10:00:00Z"
    }
  ]
}`} />

      <H2 id="wallets-create">Create wallet</H2>
      <Endpoint method="POST" path="/wallets" />
      <P>Creates a new agent wallet backed by a Coinbase CDP wallet on Base.</P>
      <ParamsTable rows={[
        { name: "agentId", type: "string", req: true, desc: "Unique identifier for this agent. Lowercase alphanumeric and hyphens." },
        { name: "initialBalanceUsdc", type: "number", desc: "Optional starting balance to allocate from treasury. Defaults to 0." },
        { name: "policyId", type: "string", desc: "ID of a spending policy to attach immediately." },
      ]} />
      <CodeBlock lang="bash" code={`curl -X POST https://nexuspay.app/api/wallets \\
  -H "X-Api-Key: nxp_live_sk_•••" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "agent-gamma",
    "initialBalanceUsdc": 50.00
  }'`} />
      <CodeBlock lang="json" code={`{
  "success": true,
  "data": {
    "agentId": "agent-gamma",
    "address": "0x9c1d...3f7a",
    "balanceUsdc": 50.00,
    "status": "ACTIVE",
    "createdAt": "2026-04-01T12:00:00Z"
  }
}`} />

      <Divider />

      {/* ── Transactions ── */}
      <H1 id="transactions">Transactions</H1>
      <P>
        On-chain transactions settle USDC on Base via the Coinbase CDP SDK. Every transaction is
        validated against the agent's active spending policy before settlement. Balances are
        decremented atomically before on-chain submission — if the chain call fails, the balance is
        refunded and the transaction is marked <Code>FAILED</Code>.
      </P>

      <H2 id="transactions-list">List transactions</H2>
      <Endpoint method="GET" path="/transactions" />
      <P>Returns the transaction history with optional filters.</P>
      <ParamsTable rows={[
        { name: "agentId", type: "string", desc: "Filter by agent. If omitted, returns all transactions." },
        { name: "status", type: "CONFIRMED | PENDING | FAILED | REJECTED", desc: "Filter by transaction status." },
        { name: "limit", type: "number", desc: "Max results to return. Defaults to 50." },
      ]} />
      <CodeBlock lang="bash" code={`curl "https://nexuspay.app/api/transactions?agentId=agent-alpha&status=CONFIRMED" \\
  -H "X-Api-Key: nxp_live_sk_•••"`} />

      <H2 id="transactions-send">Send transaction</H2>
      <Endpoint method="POST" path="/transactions" />
      <P>
        Sends USDC from an agent wallet to any Base address. Runs policy checks, decrements balance,
        submits on-chain, and returns the transaction hash.
      </P>
      <ParamsTable rows={[
        { name: "fromAgentId", type: "string", req: true, desc: "Source agent wallet ID." },
        { name: "toAddress", type: "string", req: true, desc: "Recipient Ethereum address (0x…)." },
        { name: "amountUsdc", type: "number", req: true, desc: "Amount in USDC. Must be greater than 0." },
        { name: "category", type: "string", desc: "Spend category (e.g. compute, storage, api). Used for policy filtering." },
        { name: "metadata", type: "object", desc: "Arbitrary key-value pairs stored with the transaction." },
      ]} />
      <CodeBlock lang="bash" code={`curl -X POST https://nexuspay.app/api/transactions \\
  -H "X-Api-Key: nxp_live_sk_•••" \\
  -H "Content-Type: application/json" \\
  -d '{
    "fromAgentId": "agent-alpha",
    "toAddress": "0x9b2e...4d1a",
    "amountUsdc": 12.50,
    "category": "compute",
    "metadata": { "jobId": "job_7f3a" }
  }'`} />
      <CodeBlock lang="json" code={`{
  "success": true,
  "data": {
    "id": "tx_AbCdEfGhI",
    "fromAgentId": "agent-alpha",
    "toAddress": "0x9b2e...4d1a",
    "amountUsdc": 12.50,
    "status": "CONFIRMED",
    "txHash": "0x8f2a...c91e",
    "category": "compute",
    "createdAt": "2026-04-01T12:01:00Z"
  }
}`} />

      <Callout type="warn">
        If the agent's spending policy blocks the transaction, the API returns HTTP 403 with <Code>{"policy_rejected"}</Code> and a breakdown of which checks failed — no funds are moved.
      </Callout>

      <Divider />

      {/* ── P2P ── */}
      <H1 id="p2p">P2P Transfers</H1>
      <P>
        Agent-to-agent transfers swap balances within NexusPay's internal ledger — no gas fees,
        no on-chain latency. Both wallets update atomically in a single database transaction.
        P2P transfers are still subject to the sender's spending policy.
      </P>

      <H2 id="p2p-transfer">Transfer between agents</H2>
      <Endpoint method="POST" path="/p2p" />
      <ParamsTable rows={[
        { name: "fromAgentId", type: "string", req: true, desc: "Sender agent ID." },
        { name: "toAgentId", type: "string", req: true, desc: "Recipient agent ID. Must be an existing active wallet." },
        { name: "amountUsdc", type: "number", req: true, desc: "Amount to transfer in USDC." },
        { name: "memo", type: "string", desc: "Optional note stored with the transfer (e.g. 'Tool access fee')." },
      ]} />
      <CodeBlock lang="bash" code={`curl -X POST https://nexuspay.app/api/p2p \\
  -H "X-Api-Key: nxp_live_sk_•••" \\
  -H "Content-Type: application/json" \\
  -d '{
    "fromAgentId": "agent-alpha",
    "toAgentId": "agent-beta",
    "amountUsdc": 5.00,
    "memo": "Tool access fee"
  }'`} />
      <CodeBlock lang="json" code={`{
  "success": true,
  "data": {
    "id": "tx_P2pXyZ123",
    "fromAgentId": "agent-alpha",
    "toAgentId": "agent-beta",
    "amountUsdc": 5.00,
    "isP2P": true,
    "status": "CONFIRMED",
    "memo": "Tool access fee",
    "createdAt": "2026-04-01T12:05:00Z"
  }
}`} />

      <Divider />

      {/* ── Policies ── */}
      <H1 id="policies">Spending Policies</H1>
      <P>
        Policies define the spend rules for an agent wallet. Every outgoing transaction (including
        P2P) is validated against the agent's active policy. A transaction is rejected if any
        enabled check fails — the API returns exactly which check blocked it.
      </P>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28,
      }}>
        {[
          { check: "maxPerTransaction", desc: "Maximum USDC per single transaction" },
          { check: "dailyLimit", desc: "Aggregate spend cap per calendar day" },
          { check: "monthlyLimit", desc: "Aggregate spend cap per calendar month" },
          { check: "allowedCategories", desc: "Whitelist of permitted spend categories" },
          { check: "blockedMerchants", desc: "Blocklist of recipient addresses" },
          { check: "allowedRecipients", desc: "Explicit allowlist of recipient addresses" },
          { check: "requireApproval", desc: "Flag all transactions for manual review" },
        ].map((c) => (
          <div key={c.check} style={{
            padding: "14px 16px",
            background: "rgba(139,92,246,0.04)",
            border: "1px solid rgba(139,92,246,0.12)",
            borderRadius: "var(--radius-md)",
          }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--violet-300)", marginBottom: 4 }}>{c.check}</div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.5 }}>{c.desc}</div>
          </div>
        ))}
      </div>

      <H2 id="policies-list">List policies</H2>
      <Endpoint method="GET" path="/policies" />
      <CodeBlock lang="bash" code={`curl https://nexuspay.app/api/policies \\
  -H "X-Api-Key: nxp_live_sk_•••"`} />

      <H2 id="policies-create">Create policy</H2>
      <Endpoint method="POST" path="/policies" />
      <ParamsTable rows={[
        { name: "agentId", type: "string", req: true, desc: "Agent wallet to attach this policy to." },
        { name: "tier", type: "CONSERVATIVE | MODERATE | AGGRESSIVE", desc: "Preset tier. Individual fields override the preset." },
        { name: "maxPerTransactionUsdc", type: "number", desc: "Hard cap per single transaction." },
        { name: "dailyLimitUsdc", type: "number", desc: "Rolling 24-hour spend cap." },
        { name: "monthlyLimitUsdc", type: "number", desc: "Rolling 30-day spend cap." },
        { name: "allowedCategories", type: "string[]", desc: "Array of permitted category strings." },
        { name: "blockedMerchants", type: "string[]", desc: "Array of blocked recipient addresses." },
        { name: "allowedRecipients", type: "string[]", desc: "Explicit recipient allowlist. Empty = all allowed." },
        { name: "requireApproval", type: "boolean", desc: "If true, all transactions enter PENDING state pending manual approval." },
      ]} />
      <CodeBlock lang="bash" code={`curl -X POST https://nexuspay.app/api/policies \\
  -H "X-Api-Key: nxp_live_sk_•••" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "agent-gamma",
    "tier": "MODERATE",
    "maxPerTransactionUsdc": 25.00,
    "dailyLimitUsdc": 150.00,
    "allowedCategories": ["compute", "storage"]
  }'`} />

      <Divider />

      {/* ── x402 ── */}
      <H1 id="x402">x402 Paywall</H1>
      <P>
        x402 implements the HTTP 402 Payment Required standard for machine-to-machine micropayments.
        Register any API endpoint with a USDC price — when an agent hits it without a valid payment
        proof, they receive a 402 response with payment instructions. NexusPay auto-handles payment
        and retry transparently.
      </P>
      <Callout>
        Sub-cent pricing is fully supported (e.g. <Code>{"0.0001"}</Code> USDC = $0.0001). This makes
        per-request monetisation economically viable for the first time.
      </Callout>

      <H2 id="x402-list">List endpoints</H2>
      <Endpoint method="GET" path="/x402" />
      <CodeBlock lang="bash" code={`curl https://nexuspay.app/api/x402 \\
  -H "X-Api-Key: nxp_live_sk_•••"`} />

      <H2 id="x402-register">Register endpoint</H2>
      <Endpoint method="POST" path="/x402" />
      <ParamsTable rows={[
        { name: "path", type: "string", req: true, desc: "URL path to protect (e.g. /api/ml/inference)." },
        { name: "priceUsdc", type: "number", req: true, desc: "Price per request in USDC. Supports sub-cent values." },
        { name: "description", type: "string", desc: "Human-readable endpoint description shown to paying agents." },
        { name: "active", type: "boolean", desc: "Whether the paywall is enforced. Defaults to true." },
      ]} />
      <CodeBlock lang="bash" code={`curl -X POST https://nexuspay.app/api/x402 \\
  -H "X-Api-Key: nxp_live_sk_•••" \\
  -H "Content-Type: application/json" \\
  -d '{
    "path": "/api/premium/inference",
    "priceUsdc": 0.001,
    "description": "GPT-4o inference endpoint"
  }'`} />
      <CodeBlock lang="json" code={`{
  "success": true,
  "data": {
    "id": "ep_Mnop789",
    "path": "/api/premium/inference",
    "priceUsdc": 0.001,
    "description": "GPT-4o inference endpoint",
    "active": true,
    "createdAt": "2026-04-01T12:10:00Z"
  }
}`} />

      <Divider />

      {/* ── Identity ── */}
      <H1 id="identity">Identity &amp; Keys</H1>
      <P>
        NexusPay issues DID-compatible verifiable credentials so agents can prove their identity
        and spending authority to third-party services — without sharing private keys.
      </P>

      <H2 id="identity-issue">Issue credential</H2>
      <Endpoint method="POST" path="/identity" />
      <ParamsTable rows={[
        { name: "agentId", type: "string", req: true, desc: "Agent to issue the credential for." },
        { name: "claims", type: "object", desc: "Arbitrary claims to embed in the credential JWT." },
        { name: "expiresInSeconds", type: "number", desc: "Credential TTL in seconds. Defaults to 3600 (1 hour)." },
      ]} />

      <H2 id="identity-verify">Verify credential</H2>
      <Endpoint method="POST" path="/identity/verify" />
      <ParamsTable rows={[
        { name: "token", type: "string", req: true, desc: "JWT credential issued by /identity." },
      ]} />
      <CodeBlock lang="json" code={`{
  "success": true,
  "data": {
    "valid": true,
    "agentId": "agent-alpha",
    "claims": { "role": "buyer" },
    "expiresAt": "2026-04-01T13:00:00Z"
  }
}`} />

      <H2 id="keys-create">Create API key</H2>
      <Endpoint method="POST" path="/keys" />
      <Callout type="warn">
        The plaintext key is returned only once. Copy it immediately — NexusPay stores only
        the SHA-256 hash.
      </Callout>
      <ParamsTable rows={[
        { name: "agentId", type: "string", req: true, desc: "Agent wallet to bind this key to." },
        { name: "label", type: "string", desc: "Human-readable label (e.g. 'production key')." },
      ]} />
      <CodeBlock lang="json" code={`{
  "success": true,
  "data": {
    "id": "key_QrSt456",
    "agentId": "agent-alpha",
    "key": "nxp_live_sk_AbCdEfGhIjKlMnOpQr",
    "label": "production key",
    "createdAt": "2026-04-01T12:15:00Z"
  }
}`} />

      <Divider />

      {/* ── Errors ── */}
      <H1 id="errors">Error Reference</H1>
      <P>
        All errors return a consistent shape with an HTTP status code and a human-readable message.
      </P>
      <div style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        marginBottom: 40,
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(15,15,24,0.7)", borderBottom: "1px solid var(--border-subtle)" }}>
              {["Status", "Meaning", "Common cause"].map((h) => (
                <th key={h} style={{
                  padding: "11px 16px", textAlign: "left",
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                  color: "var(--text-tertiary)", textTransform: "uppercase",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["400", "Bad Request", "Missing or invalid parameters"],
              ["401", "Unauthorized", "Missing or invalid X-Api-Key header"],
              ["403", "Policy Rejected", "Spending policy blocked the transaction"],
              ["404", "Not Found", "Agent ID or resource does not exist"],
              ["409", "Conflict", "Insufficient balance (concurrent transaction race)"],
              ["500", "Internal Error", "Unexpected server-side error"],
            ].map(([status, meaning, cause], i, arr) => (
              <tr key={status} style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
                    color: status === "400" || status === "401" || status === "403" || status === "404" || status === "409"
                      ? "#f87171" : "var(--violet-300)",
                  }}>{status}</span>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 14, color: "var(--text)", fontWeight: 500 }}>{meaning}</td>
                <td style={{ padding: "12px 16px", fontSize: 14, color: "var(--text-tertiary)" }}>{cause}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{
        padding: "28px 32px",
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(6,182,212,0.04) 100%)",
        border: "1px solid rgba(139,92,246,0.15)",
        textAlign: "center",
        marginBottom: 64,
      }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
          Ready to integrate?
        </div>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.6 }}>
          Create your first agent wallet and start sending USDC payments in minutes.
        </p>
        <Link href="/dashboard" style={{
          display: "inline-block",
          padding: "11px 28px", borderRadius: 99,
          background: "var(--gradient-brand)",
          color: "white", fontWeight: 700, fontSize: 14,
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px var(--glow-violet)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          Open Dashboard →
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Sidebar
   ═══════════════════════════════════════════════════════ */
function Sidebar({ active }: { active: string }) {
  return (
    <aside style={{
      width: 220, flexShrink: 0,
      position: "sticky", top: 80,
      height: "calc(100vh - 100px)",
      overflowY: "auto",
      paddingRight: 16,
    }}>
      <nav>
        {SIDEBAR.map((section) => (
          <div key={section.id} style={{ marginBottom: 2 }}>
            <a
              href={`#${section.id}`}
              style={{
                display: "block",
                padding: "6px 10px",
                fontSize: 13, fontWeight: 600,
                color: active === section.id ? "var(--violet-300)" : "var(--text-secondary)",
                borderRadius: 6,
                background: active === section.id ? "rgba(139,92,246,0.08)" : "transparent",
                borderLeft: `2px solid ${active === section.id ? "var(--violet-500)" : "transparent"}`,
                transition: "all 0.2s",
                textDecoration: "none",
              }}
            >{section.label}</a>
            {section.children?.map((child) => (
              <a
                key={child.id}
                href={`#${child.id}`}
                style={{
                  display: "block",
                  padding: "5px 10px 5px 20px",
                  fontSize: 12, fontWeight: 500,
                  color: active === child.id ? "var(--cyan-400)" : "var(--text-tertiary)",
                  borderRadius: 6,
                  background: active === child.id ? "rgba(6,182,212,0.06)" : "transparent",
                  transition: "all 0.2s",
                  textDecoration: "none",
                }}
              >{child.label}</a>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════ */
export default function DocsPage() {
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState("introduction");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Track active section via IntersectionObserver
  useEffect(() => {
    const allIds = SIDEBAR.flatMap((s) => [s.id, ...(s.children?.map((c) => c.id) ?? [])]);
    const els = allIds.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <AmbientGlow />

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: scrolled ? "12px 32px" : "18px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrolled ? "rgba(9,9,15,0.85)" : "rgba(9,9,15,0.6)",
        backdropFilter: "blur(20px) saturate(1.3)",
        WebkitBackdropFilter: "blur(20px) saturate(1.3)",
        borderBottom: "1px solid var(--border-subtle)",
        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <NexusLogo size={30} />
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>NexusPay</span>
          </Link>
          <div style={{
            padding: "4px 10px", borderRadius: 6,
            background: "rgba(139,92,246,0.1)",
            border: "1px solid rgba(139,92,246,0.2)",
            fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
            color: "var(--violet-300)", textTransform: "uppercase",
          }}>Docs</div>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {[
            { label: "Home", href: "/" },
            { label: "Dashboard", href: "/dashboard" },
          ].map(({ label, href }) => (
            <Link key={label} href={href} style={{
              fontSize: 13, fontWeight: 500, color: "var(--text-secondary)",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >{label}</Link>
          ))}
        </div>
      </nav>

      {/* Body */}
      <div style={{
        maxWidth: 1100, margin: "0 auto",
        padding: "100px 32px 0",
        display: "flex", gap: 60,
        position: "relative", zIndex: 1,
      }}>
        <Sidebar active={activeId} />

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {/* Page header */}
          <div style={{ paddingTop: 8, marginBottom: 8 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "5px 14px", borderRadius: 99,
              background: "rgba(139,92,246,0.08)",
              border: "1px solid rgba(139,92,246,0.15)",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
              color: "var(--violet-300)", marginBottom: 16,
              textTransform: "uppercase",
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--cyan-400)" }} />
              API Reference v1
            </div>
            <h1 style={{
              fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 800,
              letterSpacing: "-0.03em", color: "var(--text)",
              marginBottom: 12, lineHeight: 1.1,
            }}>NexusPay Docs</h1>
            <p style={{ fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 540, marginBottom: 0 }}>
              Complete API reference for managed agent wallets, USDC payments, spending policies, and x402 micropayments.
            </p>
          </div>

          <DocsContent />
        </main>
      </div>
    </div>
  );
}

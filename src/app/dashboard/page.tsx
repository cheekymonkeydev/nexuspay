"use client";

import { useState } from "react";
import { NexusLogo, HexGrid, GlassCard, useScrollReveal } from "@/components/shared";
import Link from "next/link";

/* ─── Mock data ─── */
const wallets = [
  { agentId: "agent-alpha", address: "0x7a3f...8b2c", balance: 245.50, status: "ACTIVE", txCount: 47, p2pCount: 12 },
  { agentId: "agent-beta", address: "0x9b2e...4d1a", balance: 128.75, status: "ACTIVE", txCount: 23, p2pCount: 8 },
  { agentId: "agent-gamma", address: "0x3c1d...7e9f", balance: 67.20, status: "ACTIVE", txCount: 15, p2pCount: 3 },
  { agentId: "agent-delta", address: "0x5e4a...2c8b", balance: 0, status: "SUSPENDED", txCount: 2, p2pCount: 0 },
];

const transactions = [
  { id: "tx_01", from: "agent-alpha", to: "0x9b2e...4d1a", amount: 25.00, status: "CONFIRMED", hash: "0x8f2a...3b1c", time: "2m ago", isP2P: false, category: "compute" },
  { id: "tx_02", from: "agent-beta", to: "agent-gamma", amount: 5.00, status: "CONFIRMED", hash: "—", time: "8m ago", isP2P: true, category: "p2p" },
  { id: "tx_03", from: "agent-alpha", to: "paywall:/api/data", amount: 0.001, status: "CONFIRMED", hash: "—", time: "12m ago", isP2P: false, category: "x402" },
  { id: "tx_04", from: "agent-gamma", to: "0x4f1c...8a2d", amount: 150.00, status: "REJECTED", hash: "—", time: "1h ago", isP2P: false, category: "transfer" },
  { id: "tx_05", from: "agent-alpha", to: "agent-beta", amount: 10.00, status: "CONFIRMED", hash: "—", time: "2h ago", isP2P: true, category: "p2p" },
  { id: "tx_06", from: "agent-beta", to: "0x7a3f...8b2c", amount: 32.50, status: "PENDING", hash: "0x1d3e...9f4a", time: "3h ago", isP2P: false, category: "service" },
];

const policies = [
  { agentId: "agent-alpha", tier: "MODERATE", maxPer: 100, daily: 500, monthly: 5000, recipients: 12, blocked: 3, approval: false },
  { agentId: "agent-beta", tier: "CONSERVATIVE", maxPer: 25, daily: 100, monthly: 1000, recipients: 4, blocked: 8, approval: true },
  { agentId: "agent-gamma", tier: "AGGRESSIVE", maxPer: 500, daily: 2000, monthly: 15000, recipients: 0, blocked: 0, approval: false },
];

const paywalls = [
  { path: "/api/premium/data", price: 0.001, hits: 1247, revenue: 1.25, active: true },
  { path: "/api/ml/inference", price: 0.01, hits: 89, revenue: 0.89, active: true },
  { path: "/api/search/deep", price: 0.005, hits: 423, revenue: 2.12, active: false },
];

const analytics = {
  volumeToday: 347.50,
  volumeWeek: 2150.80,
  txToday: 34,
  txWeek: 189,
  p2pToday: 8,
  p2pWeek: 42,
  failRate: 2.1,
  avgTxSize: 18.50,
};

type Tab = "overview" | "wallets" | "transactions" | "policies" | "p2p" | "x402" | "analytics";

const tabs: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "wallets", label: "Wallets" },
  { key: "transactions", label: "Transactions" },
  { key: "p2p", label: "P2P" },
  { key: "policies", label: "Policies" },
  { key: "x402", label: "x402" },
  { key: "analytics", label: "Analytics" },
];

const statusColor: Record<string, string> = {
  CONFIRMED: "#34d87a",
  PENDING: "#f59e0b",
  FAILED: "#ef4444",
  REJECTED: "#ef4444",
  ACTIVE: "#34d87a",
  SUSPENDED: "#ef4444",
};

function Badge({ label, color }: { label: string; color?: string }) {
  const c = color || statusColor[label] || "var(--text-muted)";
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 6,
      background: `${c}18`, color: c, fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
    }}>{label}</span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <GlassCard style={{ flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--green-300)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
    </GlassCard>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--border)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={{
                padding: "12px 16px", textAlign: "left", fontWeight: 600,
                color: "var(--text-muted)", borderBottom: "1px solid var(--border)",
                background: "rgba(5,15,10,0.5)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(52,216,122,0.03)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "12px 16px" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Tab content ─── */

function OverviewTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatCard label="Total Volume" value={`$${(wallets.reduce((s, w) => s + w.balance, 0) + analytics.volumeWeek).toFixed(0)}`} sub="All time" />
        <StatCard label="Active Wallets" value={`${wallets.filter((w) => w.status === "ACTIVE").length}`} sub={`${wallets.length} total`} />
        <StatCard label="Today" value={`$${analytics.volumeToday}`} sub={`${analytics.txToday} transactions`} />
        <StatCard label="P2P Transfers" value={`${analytics.p2pWeek}`} sub="This week" />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700 }}>Recent Transactions</h3>
      <Table
        headers={["ID", "From", "To", "Amount", "Type", "Status", "Time"]}
        rows={transactions.slice(0, 5).map((t) => [
          <span key="id" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{t.id}</span>,
          t.from,
          <span key="to" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{t.to}</span>,
          `$${t.amount.toFixed(t.amount < 0.01 ? 4 : 2)}`,
          <Badge key="type" label={t.isP2P ? "P2P" : t.category === "x402" ? "x402" : "ON-CHAIN"} color={t.isP2P ? "#8b5cf6" : t.category === "x402" ? "#3b82f6" : "var(--green-400)"} />,
          <Badge key="status" label={t.status} />,
          t.time,
        ])}
      />
    </div>
  );
}

function WalletsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Agent Wallets</h3>
        <button style={{
          padding: "8px 16px", borderRadius: 8,
          background: "linear-gradient(135deg, var(--green-600), var(--green-500))",
          color: "white", border: "none", fontSize: 13, fontWeight: 600,
        }}>+ Create Wallet</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {wallets.map((w) => (
          <GlassCard key={w.agentId}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 700 }}>{w.agentId}</span>
              <Badge label={w.status} />
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>{w.address}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--green-300)", marginBottom: 8 }}>${w.balance.toFixed(2)}</div>
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
              <span>{w.txCount} txns</span>
              <span>{w.p2pCount} P2P</span>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function TransactionsTab() {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>All Transactions</h3>
      <Table
        headers={["ID", "From", "To", "Amount", "Category", "Status", "Hash", "Time"]}
        rows={transactions.map((t) => [
          <span key="id" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{t.id}</span>,
          t.from,
          <span key="to" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{t.to}</span>,
          `$${t.amount.toFixed(t.amount < 0.01 ? 4 : 2)}`,
          <Badge key="cat" label={t.category.toUpperCase()} color="var(--text-muted)" />,
          <Badge key="status" label={t.status} />,
          <span key="hash" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>{t.hash}</span>,
          t.time,
        ])}
      />
    </div>
  );
}

function P2PTab() {
  const p2pTxns = transactions.filter((t) => t.isP2P);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatCard label="P2P Today" value={`${analytics.p2pToday}`} />
        <StatCard label="P2P This Week" value={`${analytics.p2pWeek}`} />
        <StatCard label="Avg P2P Size" value="$7.50" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Agent-to-Agent Transfers</h3>
        <button style={{
          padding: "8px 16px", borderRadius: 8,
          background: "linear-gradient(135deg, #7c3aed, #8b5cf6)",
          color: "white", border: "none", fontSize: 13, fontWeight: 600,
        }}>+ New P2P Transfer</button>
      </div>
      <Table
        headers={["ID", "From Agent", "To Agent", "Amount", "Status", "Time"]}
        rows={p2pTxns.map((t) => [
          <span key="id" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{t.id}</span>,
          t.from,
          t.to,
          `$${t.amount.toFixed(2)}`,
          <Badge key="s" label={t.status} />,
          t.time,
        ])}
      />
      <GlassCard>
        <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>P2P Network Graph</h4>
        <div style={{
          height: 200, borderRadius: 8,
          background: "rgba(5,15,10,0.5)", border: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-muted)", fontSize: 13,
        }}>
          Interactive agent network visualization — coming soon
        </div>
      </GlassCard>
    </div>
  );
}

function PoliciesTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Spending Policies</h3>
        <button style={{
          padding: "8px 16px", borderRadius: 8,
          background: "linear-gradient(135deg, var(--green-600), var(--green-500))",
          color: "white", border: "none", fontSize: 13, fontWeight: 600,
        }}>+ Add Policy</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        {policies.map((p) => (
          <GlassCard key={p.agentId}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontWeight: 700 }}>{p.agentId}</span>
              <Badge label={p.tier} color={p.tier === "CONSERVATIVE" ? "#3b82f6" : p.tier === "MODERATE" ? "#f59e0b" : "#ef4444"} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
              <div><span style={{ color: "var(--text-muted)" }}>Per tx:</span> ${p.maxPer}</div>
              <div><span style={{ color: "var(--text-muted)" }}>Daily:</span> ${p.daily}</div>
              <div><span style={{ color: "var(--text-muted)" }}>Monthly:</span> ${p.monthly.toLocaleString()}</div>
              <div><span style={{ color: "var(--text-muted)" }}>Recipients:</span> {p.recipients || "Any"}</div>
              <div><span style={{ color: "var(--text-muted)" }}>Blocked:</span> {p.blocked}</div>
              <div><span style={{ color: "var(--text-muted)" }}>Approval:</span> {p.approval ? "Required" : "Auto"}</div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function X402Tab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatCard label="Total Revenue" value={`$${paywalls.reduce((s, p) => s + p.revenue, 0).toFixed(2)}`} />
        <StatCard label="Total Hits" value={`${paywalls.reduce((s, p) => s + p.hits, 0).toLocaleString()}`} />
        <StatCard label="Active Endpoints" value={`${paywalls.filter((p) => p.active).length}`} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Paywall Endpoints</h3>
        <button style={{
          padding: "8px 16px", borderRadius: 8,
          background: "linear-gradient(135deg, #2563eb, #3b82f6)",
          color: "white", border: "none", fontSize: 13, fontWeight: 600,
        }}>+ Register Endpoint</button>
      </div>
      <Table
        headers={["Path", "Price", "Hits", "Revenue", "Status"]}
        rows={paywalls.map((p) => [
          <span key="path" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{p.path}</span>,
          `$${p.price.toFixed(4)}`,
          p.hits.toLocaleString(),
          `$${p.revenue.toFixed(2)}`,
          <Badge key="s" label={p.active ? "ACTIVE" : "DISABLED"} color={p.active ? "#34d87a" : "#6b7280"} />,
        ])}
      />
      <GlassCard>
        <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>x402 Flow</h4>
        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Register an endpoint with a USDC price. When an agent hits it without payment, return HTTP 402.
          The agent pays via NexusPay, receives access. Sub-cent micropayments on Base make this viable for every API call.
        </p>
      </GlassCard>
    </div>
  );
}

function AnalyticsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatCard label="Volume Today" value={`$${analytics.volumeToday}`} sub={`${analytics.txToday} txns`} />
        <StatCard label="Volume This Week" value={`$${analytics.volumeWeek}`} sub={`${analytics.txWeek} txns`} />
        <StatCard label="Failure Rate" value={`${analytics.failRate}%`} sub="Last 7 days" />
        <StatCard label="Avg Tx Size" value={`$${analytics.avgTxSize}`} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <GlassCard>
          <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Volume Over Time</h4>
          <div style={{
            height: 180, borderRadius: 8, background: "rgba(5,15,10,0.5)",
            border: "1px solid var(--border)",
            display: "flex", alignItems: "flex-end", padding: "16px 12px", gap: 8,
          }}>
            {[35, 52, 41, 67, 89, 72, 95].map((v, i) => (
              <div key={i} style={{
                flex: 1, borderRadius: "4px 4px 0 0",
                background: `linear-gradient(to top, var(--green-700), var(--green-500))`,
                height: `${v}%`, opacity: 0.7 + i * 0.04,
                transition: "height 0.5s",
              }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
        </GlassCard>
        <GlassCard>
          <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Transaction Types</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            {[
              { label: "On-chain", pct: 55, color: "var(--green-500)" },
              { label: "P2P", pct: 30, color: "#8b5cf6" },
              { label: "x402", pct: 15, color: "#3b82f6" },
            ].map((t) => (
              <div key={t.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span>{t.label}</span>
                  <span style={{ color: "var(--text-muted)" }}>{t.pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.05)" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: t.color, width: `${t.pct}%`, transition: "width 0.5s" }} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
      <GlassCard>
        <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Top Agents by Volume</h4>
        <Table
          headers={["Agent", "Volume", "Transactions", "P2P", "Avg Size"]}
          rows={wallets.filter((w) => w.status === "ACTIVE").map((w) => [
            <span key="a" style={{ fontWeight: 600 }}>{w.agentId}</span>,
            `$${(w.balance * 3.2).toFixed(0)}`,
            `${w.txCount}`,
            `${w.p2pCount}`,
            `$${(w.balance * 3.2 / w.txCount).toFixed(2)}`,
          ])}
        />
      </GlassCard>
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  useScrollReveal();

  const content: Record<Tab, React.ReactNode> = {
    overview: <OverviewTab />,
    wallets: <WalletsTab />,
    transactions: <TransactionsTab />,
    p2p: <P2PTab />,
    policies: <PoliciesTab />,
    x402: <X402Tab />,
    analytics: <AnalyticsTab />,
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <HexGrid opacity={0.2} />

      {/* ── Sidebar ── */}
      <aside style={{
        position: "fixed", left: 0, top: 0, bottom: 0, width: 220, zIndex: 50,
        background: "rgba(5, 10, 8, 0.9)", backdropFilter: "blur(16px)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", padding: "20px 0",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 20px", marginBottom: 32 }}>
          <NexusLogo size={32} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>NexusPay</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>v0.2.0</div>
          </div>
        </Link>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "10px 20px", border: "none", fontSize: 13,
                background: tab === t.key ? "rgba(52,216,122,0.1)" : "transparent",
                color: tab === t.key ? "var(--green-300)" : "var(--text-muted)",
                borderLeft: tab === t.key ? "2px solid var(--green-400)" : "2px solid transparent",
                fontWeight: tab === t.key ? 600 : 400,
                transition: "all 0.2s",
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div style={{
          margin: "0 16px", padding: "10px 12px", borderRadius: 8,
          background: "rgba(52,216,122,0.08)", border: "1px solid var(--border)",
          fontSize: 11, color: "var(--green-400)", textAlign: "center",
        }}>
          Base Sepolia
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ marginLeft: 220, flex: 1, padding: 32, position: "relative", zIndex: 2 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>{tabs.find((t) => t.key === tab)?.label}</h1>
        </div>
        {content[tab]}
      </main>
    </div>
  );
}

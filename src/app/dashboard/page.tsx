"use client";

import { useState } from "react";
import Link from "next/link";
import { NexusLogo, AmbientGlow, GlassCard, Badge, useScrollReveal } from "@/components/shared";

/* ═══ Mock data ═══ */
const wallets = [
  { agentId: "agent-alpha", address: "0x7a3f...8b2c", balance: 245.50, status: "ACTIVE", txCount: 47, p2pCount: 12 },
  { agentId: "agent-beta", address: "0x9b2e...4d1a", balance: 128.75, status: "ACTIVE", txCount: 23, p2pCount: 8 },
  { agentId: "agent-gamma", address: "0x3c1d...7e9f", balance: 67.20, status: "ACTIVE", txCount: 15, p2pCount: 3 },
  { agentId: "agent-delta", address: "0x5e4a...2c8b", balance: 0, status: "SUSPENDED", txCount: 2, p2pCount: 0 },
];

const txns = [
  { id: "tx_01", from: "agent-alpha", to: "0x9b2e...4d1a", amount: 25.00, status: "CONFIRMED", hash: "0x8f2a...3b1c", time: "2m ago", isP2P: false, cat: "compute" },
  { id: "tx_02", from: "agent-beta", to: "agent-gamma", amount: 5.00, status: "CONFIRMED", hash: "—", time: "8m ago", isP2P: true, cat: "p2p" },
  { id: "tx_03", from: "agent-alpha", to: "paywall:/api/data", amount: 0.001, status: "CONFIRMED", hash: "—", time: "12m ago", isP2P: false, cat: "x402" },
  { id: "tx_04", from: "agent-gamma", to: "0x4f1c...8a2d", amount: 150.00, status: "REJECTED", hash: "—", time: "1h ago", isP2P: false, cat: "transfer" },
  { id: "tx_05", from: "agent-alpha", to: "agent-beta", amount: 10.00, status: "CONFIRMED", hash: "—", time: "2h ago", isP2P: true, cat: "p2p" },
  { id: "tx_06", from: "agent-beta", to: "0x7a3f...8b2c", amount: 32.50, status: "PENDING", hash: "0x1d3e...9f4a", time: "3h ago", isP2P: false, cat: "service" },
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

/* ═══ Shared components ═══ */
type Tab = "overview" | "wallets" | "transactions" | "p2p" | "policies" | "x402" | "analytics";
const tabList: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "◎" },
  { key: "wallets", label: "Wallets", icon: "◈" },
  { key: "transactions", label: "Transactions", icon: "↗" },
  { key: "p2p", label: "P2P", icon: "⇄" },
  { key: "policies", label: "Policies", icon: "⊞" },
  { key: "x402", label: "x402", icon: "⚡" },
  { key: "analytics", label: "Analytics", icon: "◉" },
];

const statusVariant: Record<string, "success" | "warning" | "danger"> = {
  CONFIRMED: "success", PENDING: "warning", FAILED: "danger", REJECTED: "danger", ACTIVE: "success", SUSPENDED: "danger",
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <GlassCard style={{ flex: 1, minWidth: 160, padding: 22 }}>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>{sub}</div>}
    </GlassCard>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ overflowX: "auto", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={{
                padding: "12px 18px", textAlign: "left",
                fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase",
                color: "var(--text-tertiary)", borderBottom: "1px solid var(--border)",
                background: "rgba(15,15,24,0.5)",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}
              style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--border-subtle)" : "none", transition: "background 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139,92,246,0.02)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "14px 18px" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Btn({ children, variant = "primary", onClick }: { children: React.ReactNode; variant?: "primary" | "secondary"; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 18px", borderRadius: 99, fontSize: 13, fontWeight: 600,
      background: variant === "primary" ? "var(--gradient-brand)" : "transparent",
      border: variant === "primary" ? "none" : "1px solid var(--border-hover)",
      color: "white",
      transition: "transform 0.2s, box-shadow 0.2s",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; if (variant === "primary") e.currentTarget.style.boxShadow = "0 4px 16px var(--glow-violet)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >{children}</button>
  );
}

/* ═══ Tab content ═══ */
function Overview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Stat label="Total Volume" value="$2,592" sub="All time" />
        <Stat label="Active Wallets" value="3" sub="4 total" />
        <Stat label="Today" value="$347" sub="34 transactions" />
        <Stat label="P2P This Week" value="42" sub="$315 volume" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Recent Activity</h3>
      </div>
      <DataTable
        headers={["ID", "From", "To", "Amount", "Type", "Status", "Time"]}
        rows={txns.slice(0, 5).map((t) => [
          <span key="id" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>{t.id}</span>,
          <span key="from" style={{ fontWeight: 500 }}>{t.from}</span>,
          <span key="to" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>{t.to}</span>,
          <span key="amt" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>${t.amount < 0.01 ? t.amount.toFixed(4) : t.amount.toFixed(2)}</span>,
          <Badge key="type" variant={t.isP2P ? "violet" : t.cat === "x402" ? "cyan" : "default"}>{t.isP2P ? "P2P" : t.cat === "x402" ? "x402" : "ON-CHAIN"}</Badge>,
          <Badge key="st" variant={statusVariant[t.status]}>{t.status}</Badge>,
          <span key="time" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{t.time}</span>,
        ])}
      />
    </div>
  );
}

function Wallets() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Agent Wallets</h3>
        <Btn>+ Create Wallet</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {wallets.map((w) => (
          <GlassCard key={w.agentId} style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontFamily: "var(--font-display)", fontSize: 14 }}>{w.agentId}</span>
              <Badge variant={statusVariant[w.status]}>{w.status}</Badge>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 14 }}>{w.address}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 10 }}>
              ${w.balance.toFixed(2)}
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-tertiary)" }}>
              <span>{w.txCount} txns</span><span>{w.p2pCount} P2P</span>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function Transactions() {
  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)", marginBottom: 16 }}>All Transactions</h3>
      <DataTable
        headers={["ID", "From", "To", "Amount", "Category", "Status", "Hash", "Time"]}
        rows={txns.map((t) => [
          <span key="id" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>{t.id}</span>,
          t.from,
          <span key="to" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>{t.to}</span>,
          <span key="amt" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>${t.amount < 0.01 ? t.amount.toFixed(4) : t.amount.toFixed(2)}</span>,
          <Badge key="cat" variant="default">{t.cat.toUpperCase()}</Badge>,
          <Badge key="st" variant={statusVariant[t.status]}>{t.status}</Badge>,
          <span key="hash" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>{t.hash}</span>,
          <span key="time" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{t.time}</span>,
        ])}
      />
    </div>
  );
}

function P2P() {
  const p2p = txns.filter((t) => t.isP2P);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Stat label="P2P Today" value="8" />
        <Stat label="P2P This Week" value="42" />
        <Stat label="Avg Size" value="$7.50" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Agent-to-Agent</h3>
        <Btn>+ New Transfer</Btn>
      </div>
      <DataTable
        headers={["ID", "From", "To", "Amount", "Status", "Time"]}
        rows={p2p.map((t) => [
          <span key="id" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>{t.id}</span>,
          t.from, t.to,
          <span key="amt" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>${t.amount.toFixed(2)}</span>,
          <Badge key="st" variant={statusVariant[t.status]}>{t.status}</Badge>,
          <span key="time" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{t.time}</span>,
        ])}
      />
    </div>
  );
}

function Policies() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Spending Policies</h3>
        <Btn>+ Add Policy</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        {policies.map((p) => (
          <GlassCard key={p.agentId} style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontFamily: "var(--font-display)", fontSize: 14 }}>{p.agentId}</span>
              <Badge variant={p.tier === "CONSERVATIVE" ? "cyan" : p.tier === "MODERATE" ? "warning" : "danger"}>{p.tier}</Badge>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
              {[
                ["Per tx", `$${p.maxPer}`], ["Daily", `$${p.daily}`],
                ["Monthly", `$${p.monthly.toLocaleString()}`], ["Recipients", p.recipients || "Any"],
                ["Blocked", `${p.blocked}`], ["Approval", p.approval ? "Required" : "Auto"],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <span style={{ color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{k}</span>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function X402() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Stat label="Total Revenue" value={`$${paywalls.reduce((s, p) => s + p.revenue, 0).toFixed(2)}`} />
        <Stat label="Total Hits" value={paywalls.reduce((s, p) => s + p.hits, 0).toLocaleString()} />
        <Stat label="Active Endpoints" value={`${paywalls.filter((p) => p.active).length}`} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Paywall Endpoints</h3>
        <Btn>+ Register Endpoint</Btn>
      </div>
      <DataTable
        headers={["Path", "Price", "Hits", "Revenue", "Status"]}
        rows={paywalls.map((p) => [
          <span key="path" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{p.path}</span>,
          <span key="price" style={{ fontFamily: "var(--font-mono)" }}>${p.price.toFixed(4)}</span>,
          p.hits.toLocaleString(),
          <span key="rev" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>${p.revenue.toFixed(2)}</span>,
          <Badge key="st" variant={p.active ? "success" : "default"}>{p.active ? "ACTIVE" : "DISABLED"}</Badge>,
        ])}
      />
    </div>
  );
}

function Analytics() {
  const bars = [35, 52, 41, 67, 89, 72, 95];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Stat label="Volume Today" value="$347" sub="34 txns" />
        <Stat label="Volume This Week" value="$2,151" sub="189 txns" />
        <Stat label="Failure Rate" value="2.1%" sub="Last 7 days" />
        <Stat label="Avg Tx Size" value="$18.50" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <GlassCard style={{ padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", marginBottom: 16 }}>Weekly Volume</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 160 }}>
            {bars.map((v, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: "100%", borderRadius: "4px 4px 0 0",
                  height: `${v}%`,
                  background: "var(--gradient-brand)", opacity: 0.5 + i * 0.07,
                  transition: "height 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                }} />
                <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{days[i]}</span>
              </div>
            ))}
          </div>
        </GlassCard>
        <GlassCard style={{ padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", marginBottom: 16 }}>Transaction Breakdown</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
            {[
              { label: "On-chain", pct: 55, variant: "violet" as const },
              { label: "P2P", pct: 30, variant: "cyan" as const },
              { label: "x402", pct: 15, variant: "default" as const },
            ].map((t) => (
              <div key={t.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                  <span style={{ fontWeight: 500 }}>{t.label}</span>
                  <span style={{ color: "var(--text-tertiary)" }}>{t.pct}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.04)" }}>
                  <div style={{
                    height: "100%", borderRadius: 3, width: `${t.pct}%`,
                    background: t.variant === "violet" ? "var(--gradient-brand)" : t.variant === "cyan" ? "var(--cyan-500)" : "var(--text-tertiary)",
                    transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

/* ═══ MAIN DASHBOARD ═══ */
export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  useScrollReveal();

  const content: Record<Tab, React.ReactNode> = {
    overview: <Overview />, wallets: <Wallets />, transactions: <Transactions />,
    p2p: <P2P />, policies: <Policies />, x402: <X402 />, analytics: <Analytics />,
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <AmbientGlow />

      {/* ═══ Sidebar ═══ */}
      <aside style={{
        position: "fixed", left: 0, top: 0, bottom: 0, width: 230, zIndex: 50,
        background: "rgba(9, 9, 15, 0.92)",
        backdropFilter: "blur(20px) saturate(1.3)",
        WebkitBackdropFilter: "blur(20px) saturate(1.3)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex", flexDirection: "column",
        padding: "20px 0",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 20px", marginBottom: 36, textDecoration: "none" }}>
          <NexusLogo size={30} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>NexusPay</div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>v0.2.0</div>
          </div>
        </Link>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "0 8px" }}>
          {tabList.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", textAlign: "left",
                padding: "10px 14px", borderRadius: "var(--radius-sm)",
                fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
                background: tab === t.key ? "rgba(139,92,246,0.08)" : "transparent",
                color: tab === t.key ? "var(--violet-300)" : "var(--text-secondary)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => { if (tab !== t.key) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
              onMouseLeave={(e) => { if (tab !== t.key) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: 14, opacity: 0.7, width: 18, textAlign: "center" }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div style={{
          margin: "0 14px", padding: "10px 14px", borderRadius: "var(--radius-sm)",
          background: "rgba(139,92,246,0.06)",
          border: "1px solid rgba(139,92,246,0.1)",
          fontSize: 11, color: "var(--violet-300)", textAlign: "center",
          fontWeight: 600, fontFamily: "var(--font-mono)",
        }}>
          BASE SEPOLIA
        </div>
      </aside>

      {/* ═══ Main ═══ */}
      <main style={{ marginLeft: 230, flex: 1, padding: 32, position: "relative", zIndex: 2 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800,
            letterSpacing: "-0.02em",
          }}>
            {tabList.find((t) => t.key === tab)?.label}
          </h1>
        </div>
        {content[tab]}
      </main>
    </div>
  );
}

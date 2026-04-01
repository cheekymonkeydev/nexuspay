"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { NexusLogo, AmbientGlow, GlassCard, Badge, useScrollReveal } from "@/components/shared";
import { useApi } from "@/lib/hooks";
import { timeAgo } from "@/lib/utils";

/* ═══ Types for API responses ═══ */
interface Wallet {
  id: string; agentId: string; address: string; balanceUsdc: number;
  status: string; createdAt: string;
  _count?: { sentTransactions: number; policies: number };
}
interface Tx {
  id: string; fromAgentId: string; toAddress: string; toAgentId?: string;
  amountUsdc: number; status: string; txHash?: string; category?: string;
  memo?: string; isP2P: boolean; createdAt: string; failureReason?: string;
}
interface Policy {
  id: string; agentId: string; tier: string; maxPerTransaction: number;
  dailyLimit: number; monthlyLimit?: number; allowedRecipients: string[];
  blockedMerchants: string[]; allowedCategories: string[];
  requireApproval: boolean; isActive: boolean;
}
interface Paywall {
  id: string; path: string; priceUsdc: number; description?: string;
  isActive: boolean; totalPaid: number; hitCount: number;
}

/* ═══ Shared UI ═══ */
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

function Loader() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 20, color: "var(--text-tertiary)", fontSize: 13 }}>
      <div style={{
        width: 16, height: 16, borderRadius: "50%",
        border: "2px solid var(--border)", borderTopColor: "var(--violet-500)",
        animation: "spin 0.8s linear infinite",
      }} />
      Loading...
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorMsg({ message }: { message: string }) {
  return (
    <div style={{
      padding: "14px 18px", borderRadius: "var(--radius-md)",
      background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
      color: "#f87171", fontSize: 13,
    }}>
      {message}
    </div>
  );
}

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
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>No data yet</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i}
              style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--border-subtle)" : "none", transition: "background 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139,92,246,0.02)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {row.map((cell, j) => <td key={j} style={{ padding: "14px 18px" }}>{cell}</td>)}
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
      color: "white", transition: "transform 0.2s, box-shadow 0.2s",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
    >{children}</button>
  );
}

function MonoText({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>{children}</span>;
}

function truncAddr(addr: string) {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/* ═══ Tab content — all wired to real API ═══ */
function OverviewTab() {
  const { data: wallets, loading: wl } = useApi<Wallet[]>("/api/wallets");
  const { data: txns, loading: tl } = useApi<Tx[]>("/api/transactions");

  if (wl || tl) return <Loader />;

  const activeWallets = wallets?.filter((w) => w.status === "ACTIVE").length ?? 0;
  const totalBalance = wallets?.reduce((s, w) => s + w.balanceUsdc, 0) ?? 0;

  const now = Date.now();
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now - 7 * 86400_000);
  const todayTxns = txns?.filter((t) => new Date(t.createdAt) >= dayStart) ?? [];
  const todayVolume = todayTxns.filter((t) => t.status === "CONFIRMED").reduce((s, t) => s + t.amountUsdc, 0);
  const weekP2P = txns?.filter((t) => t.isP2P && new Date(t.createdAt) >= weekStart).length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Stat label="Total Balance" value={`$${totalBalance.toFixed(2)}`} sub={`${wallets?.length ?? 0} wallets`} />
        <Stat label="Active Wallets" value={`${activeWallets}`} sub={`${wallets?.length ?? 0} total`} />
        <Stat label="Today" value={`$${todayVolume.toFixed(2)}`} sub={`${todayTxns.length} transactions`} />
        <Stat label="P2P This Week" value={`${weekP2P}`} />
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Recent Activity</h3>
      <DataTable
        headers={["From", "To", "Amount", "Type", "Status", "Time"]}
        rows={(txns ?? []).slice(0, 6).map((t) => [
          <span key="f" style={{ fontWeight: 500 }}>{t.fromAgentId}</span>,
          <MonoText key="to">{truncAddr(t.toAgentId || t.toAddress)}</MonoText>,
          <span key="a" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>${t.amountUsdc < 0.01 ? t.amountUsdc.toFixed(4) : t.amountUsdc.toFixed(2)}</span>,
          <Badge key="type" variant={t.isP2P ? "violet" : t.category === "x402" ? "cyan" : "default"}>{t.isP2P ? "P2P" : t.category === "x402" ? "x402" : "ON-CHAIN"}</Badge>,
          <Badge key="st" variant={statusVariant[t.status] || "default"}>{t.status}</Badge>,
          <span key="time" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{timeAgo(t.createdAt)}</span>,
        ])}
      />
    </div>
  );
}

function WalletsTab() {
  const { data: wallets, loading, error, refetch } = useApi<Wallet[]>("/api/wallets");
  const { data: txns } = useApi<Tx[]>("/api/transactions");
  const [creating, setCreating] = useState(false);

  const createWallet = useCallback(async () => {
    const id = prompt("Enter agent ID (e.g. agent-echo):");
    if (!id) return;
    setCreating(true);
    try {
      await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: id, initialFunding: 10 }),
      });
      refetch();
    } finally { setCreating(false); }
  }, [refetch]);

  if (loading) return <Loader />;
  if (error) return <ErrorMsg message={error} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Agent Wallets</h3>
        <Btn onClick={createWallet}>{creating ? "Creating..." : "+ Create Wallet"}</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {(wallets ?? []).map((w) => {
          const txCount = txns?.filter((t) => t.fromAgentId === w.agentId).length ?? 0;
          const p2pCount = txns?.filter((t) => t.fromAgentId === w.agentId && t.isP2P).length ?? 0;
          return (
            <GlassCard key={w.agentId} style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontWeight: 700, fontFamily: "var(--font-display)", fontSize: 14 }}>{w.agentId}</span>
                <Badge variant={statusVariant[w.status] || "default"}>{w.status}</Badge>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 14 }}>{truncAddr(w.address)}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 10 }}>
                ${w.balanceUsdc.toFixed(2)}
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-tertiary)" }}>
                <span>{txCount} txns</span><span>{p2pCount} P2P</span>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

function TransactionsTab() {
  const { data: txns, loading, error } = useApi<Tx[]>("/api/transactions");

  if (loading) return <Loader />;
  if (error) return <ErrorMsg message={error} />;

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)", marginBottom: 16 }}>All Transactions</h3>
      <DataTable
        headers={["From", "To", "Amount", "Category", "Status", "Hash", "Time"]}
        rows={(txns ?? []).map((t) => [
          t.fromAgentId,
          <MonoText key="to">{truncAddr(t.toAgentId || t.toAddress)}</MonoText>,
          <span key="a" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>${t.amountUsdc < 0.01 ? t.amountUsdc.toFixed(4) : t.amountUsdc.toFixed(2)}</span>,
          <Badge key="cat" variant="default">{(t.category || "—").toUpperCase()}</Badge>,
          <Badge key="st" variant={statusVariant[t.status] || "default"}>{t.status}</Badge>,
          <MonoText key="hash">{t.txHash ? truncAddr(t.txHash) : "—"}</MonoText>,
          <span key="time" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{timeAgo(t.createdAt)}</span>,
        ])}
      />
    </div>
  );
}

function P2PTab() {
  const { data: txns, loading, error, refetch } = useApi<Tx[]>("/api/transactions");
  const p2p = (txns ?? []).filter((t) => t.isP2P);

  const sendP2P = useCallback(async () => {
    const from = prompt("From agent ID:");
    const to = prompt("To agent ID:");
    const amount = prompt("Amount (USDC):");
    if (!from || !to || !amount) return;
    await fetch("/api/p2p", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromAgentId: from, toAgentId: to, amountUsdc: parseFloat(amount) }),
    });
    refetch();
  }, [refetch]);

  if (loading) return <Loader />;
  if (error) return <ErrorMsg message={error} />;

  const total = p2p.reduce((s, t) => s + t.amountUsdc, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Stat label="Total P2P" value={`${p2p.length}`} />
        <Stat label="P2P Volume" value={`$${total.toFixed(2)}`} />
        <Stat label="Avg Size" value={p2p.length > 0 ? `$${(total / p2p.length).toFixed(2)}` : "$0"} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Agent-to-Agent</h3>
        <Btn onClick={sendP2P}>+ New Transfer</Btn>
      </div>
      <DataTable
        headers={["From", "To", "Amount", "Status", "Time"]}
        rows={p2p.map((t) => [
          t.fromAgentId,
          t.toAgentId || truncAddr(t.toAddress),
          <span key="a" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>${t.amountUsdc.toFixed(2)}</span>,
          <Badge key="st" variant={statusVariant[t.status] || "default"}>{t.status}</Badge>,
          <span key="time" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{timeAgo(t.createdAt)}</span>,
        ])}
      />
    </div>
  );
}

function PoliciesTab() {
  const { data: policies, loading, error } = useApi<Policy[]>("/api/policies");

  if (loading) return <Loader />;
  if (error) return <ErrorMsg message={error} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Spending Policies</h3>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        {(policies ?? []).map((p) => (
          <GlassCard key={p.id} style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontFamily: "var(--font-display)", fontSize: 14 }}>{p.agentId}</span>
              <Badge variant={p.tier === "CONSERVATIVE" ? "cyan" : p.tier === "MODERATE" ? "warning" : "danger"}>{p.tier}</Badge>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
              {[
                ["Per tx", `$${p.maxPerTransaction}`],
                ["Daily", `$${p.dailyLimit}`],
                ["Monthly", p.monthlyLimit ? `$${p.monthlyLimit.toLocaleString()}` : "—"],
                ["Recipients", p.allowedRecipients.length || "Any"],
                ["Blocked", `${p.blockedMerchants.length}`],
                ["Approval", p.requireApproval ? "Required" : "Auto"],
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

function X402Tab() {
  const { data: endpoints, loading, error } = useApi<Paywall[]>("/api/x402");

  if (loading) return <Loader />;
  if (error) return <ErrorMsg message={error} />;

  const totalRev = (endpoints ?? []).reduce((s, p) => s + p.totalPaid, 0);
  const totalHits = (endpoints ?? []).reduce((s, p) => s + p.hitCount, 0);
  const active = (endpoints ?? []).filter((p) => p.isActive).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Stat label="Total Revenue" value={`$${totalRev.toFixed(2)}`} />
        <Stat label="Total Hits" value={totalHits.toLocaleString()} />
        <Stat label="Active Endpoints" value={`${active}`} />
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Paywall Endpoints</h3>
      <DataTable
        headers={["Path", "Price", "Hits", "Revenue", "Status"]}
        rows={(endpoints ?? []).map((p) => [
          <MonoText key="path">{p.path}</MonoText>,
          <span key="price" style={{ fontFamily: "var(--font-mono)" }}>${p.priceUsdc.toFixed(4)}</span>,
          p.hitCount.toLocaleString(),
          <span key="rev" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>${p.totalPaid.toFixed(2)}</span>,
          <Badge key="st" variant={p.isActive ? "success" : "default"}>{p.isActive ? "ACTIVE" : "DISABLED"}</Badge>,
        ])}
      />
    </div>
  );
}

function AnalyticsTab() {
  const { data: txns, loading } = useApi<Tx[]>("/api/transactions");
  const { data: wallets } = useApi<Wallet[]>("/api/wallets");

  if (loading) return <Loader />;

  const all = txns ?? [];
  const now = Date.now();
  const dayMs = 86400_000;
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now - 7 * dayMs);

  const todayConf = all.filter((t) => t.status === "CONFIRMED" && new Date(t.createdAt) >= dayStart);
  const weekConf = all.filter((t) => t.status === "CONFIRMED" && new Date(t.createdAt) >= weekStart);
  const weekAll = all.filter((t) => new Date(t.createdAt) >= weekStart);
  const failed = weekAll.filter((t) => t.status === "FAILED" || t.status === "REJECTED").length;
  const failRate = weekAll.length > 0 ? ((failed / weekAll.length) * 100).toFixed(1) : "0";

  const todayVol = todayConf.reduce((s, t) => s + t.amountUsdc, 0);
  const weekVol = weekConf.reduce((s, t) => s + t.amountUsdc, 0);
  const avgSize = weekConf.length > 0 ? weekVol / weekConf.length : 0;

  // Weekly bars (last 7 days)
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dailyVols = Array(7).fill(0);
  weekConf.forEach((t) => {
    const day = new Date(t.createdAt).getDay();
    const idx = day === 0 ? 6 : day - 1; // Mon=0..Sun=6
    dailyVols[idx] += t.amountUsdc;
  });
  const maxVol = Math.max(...dailyVols, 1);

  // Type breakdown
  const onChain = weekConf.filter((t) => !t.isP2P && t.category !== "x402").length;
  const p2pCount = weekConf.filter((t) => t.isP2P).length;
  const x402Count = weekConf.filter((t) => t.category === "x402").length;
  const totalTypes = onChain + p2pCount + x402Count || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Stat label="Volume Today" value={`$${todayVol.toFixed(2)}`} sub={`${todayConf.length} txns`} />
        <Stat label="Volume This Week" value={`$${weekVol.toFixed(2)}`} sub={`${weekConf.length} txns`} />
        <Stat label="Failure Rate" value={`${failRate}%`} sub="Last 7 days" />
        <Stat label="Avg Tx Size" value={`$${avgSize.toFixed(2)}`} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <GlassCard style={{ padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", marginBottom: 16 }}>Weekly Volume</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 160 }}>
            {dailyVols.map((v, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: "100%", borderRadius: "4px 4px 0 0",
                  height: `${Math.max((v / maxVol) * 100, 2)}%`,
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
              { label: "On-chain", count: onChain, color: "var(--gradient-brand)" },
              { label: "P2P", count: p2pCount, color: "var(--cyan-500)" },
              { label: "x402", count: x402Count, color: "var(--violet-400)" },
            ].map((t) => {
              const pct = Math.round((t.count / totalTypes) * 100);
              return (
                <div key={t.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span style={{ fontWeight: 500 }}>{t.label}</span>
                    <span style={{ color: "var(--text-tertiary)" }}>{pct}% ({t.count})</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.04)" }}>
                    <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: t.color, transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
      {/* Top agents */}
      <GlassCard style={{ padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", marginBottom: 16 }}>Top Agents by Volume</div>
        <DataTable
          headers={["Agent", "Balance", "Transactions", "Volume"]}
          rows={(wallets ?? []).filter((w) => w.status === "ACTIVE").map((w) => {
            const agentTxns = weekConf.filter((t) => t.fromAgentId === w.agentId);
            const vol = agentTxns.reduce((s, t) => s + t.amountUsdc, 0);
            return [
              <span key="a" style={{ fontWeight: 600 }}>{w.agentId}</span>,
              <span key="b" style={{ fontFamily: "var(--font-mono)" }}>${w.balanceUsdc.toFixed(2)}</span>,
              `${agentTxns.length}`,
              <span key="v" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>${vol.toFixed(2)}</span>,
            ];
          })}
        />
      </GlassCard>
    </div>
  );
}

/* ═══ MAIN DASHBOARD ═══ */
export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  useScrollReveal();

  const content: Record<Tab, React.ReactNode> = {
    overview: <OverviewTab />, wallets: <WalletsTab />, transactions: <TransactionsTab />,
    p2p: <P2PTab />, policies: <PoliciesTab />, x402: <X402Tab />, analytics: <AnalyticsTab />,
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <AmbientGlow />

      {/* Sidebar */}
      <aside style={{
        position: "fixed", left: 0, top: 0, bottom: 0, width: 230, zIndex: 50,
        background: "rgba(9, 9, 15, 0.92)",
        backdropFilter: "blur(20px) saturate(1.3)",
        WebkitBackdropFilter: "blur(20px) saturate(1.3)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex", flexDirection: "column", padding: "20px 0",
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
            <button key={t.key} onClick={() => setTab(t.key)} style={{
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
          background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.1)",
          fontSize: 11, color: "var(--violet-300)", textAlign: "center",
          fontWeight: 600, fontFamily: "var(--font-mono)",
        }}>BASE SEPOLIA</div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 230, flex: 1, padding: 32, position: "relative", zIndex: 2 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {tabList.find((t) => t.key === tab)?.label}
          </h1>
        </div>
        {content[tab]}
      </main>
    </div>
  );
}

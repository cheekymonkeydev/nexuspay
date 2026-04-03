"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { NexusLogo, AmbientGlow, GlassCard, Badge, useScrollReveal } from "@/components/shared";
import { useApi } from "@/lib/hooks";
import { timeAgo } from "@/lib/utils";

/* ═══ Types ═══ */
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
interface ApiKey {
  id: string; name: string; prefix: string; scopes: string[];
  isActive: boolean; lastUsedAt: string | null; createdAt: string;
}

/* ═══ Constants ═══ */
type Tab = "overview" | "wallets" | "transactions" | "p2p" | "policies" | "x402" | "analytics" | "keys";
const tabList: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "◎" },
  { key: "wallets", label: "Wallets", icon: "◈" },
  { key: "transactions", label: "Transactions", icon: "↗" },
  { key: "p2p", label: "P2P", icon: "⇄" },
  { key: "policies", label: "Policies", icon: "⊞" },
  { key: "x402", label: "x402", icon: "⚡" },
  { key: "analytics", label: "Analytics", icon: "◉" },
  { key: "keys", label: "API Keys", icon: "⌗" },
];

const statusVariant: Record<string, "success" | "warning" | "danger"> = {
  CONFIRMED: "success", PENDING: "warning", FAILED: "danger", REJECTED: "danger", ACTIVE: "success", SUSPENDED: "danger",
};

/* ═══ Shared UI primitives ═══ */
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
    }}>{message}</div>
  );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 12 }}>
      <div style={{ fontSize: 40, opacity: 0.3 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-secondary)" }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", maxWidth: 280 }}>{sub}</div>
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
            <tr><td colSpan={headers.length} style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>No data yet</td></tr>
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

function Btn({ children, variant = "primary", onClick, disabled }: {
  children: React.ReactNode; variant?: "primary" | "secondary" | "danger" | "default";
  onClick?: () => void; disabled?: boolean;
}) {
  const bg = variant === "primary" ? "var(--gradient-brand)"
    : variant === "danger" ? "rgba(239,68,68,0.12)"
    : variant === "default" ? "rgba(139,92,246,0.08)"
    : "transparent";
  const border = variant === "secondary" ? "1px solid var(--border-hover)"
    : variant === "danger" ? "1px solid rgba(239,68,68,0.25)"
    : variant === "default" ? "1px solid rgba(139,92,246,0.2)"
    : "none";
  const color = variant === "danger" ? "#f87171" : variant === "default" ? "var(--violet-300)" : "white";

  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "8px 18px", borderRadius: 99, fontSize: 13, fontWeight: 600,
      background: bg, border, color,
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "transform 0.2s, box-shadow 0.2s",
    }}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.transform = "translateY(-1px)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
    >{children}</button>
  );
}

function MonoText({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>{children}</span>;
}

function truncAddr(addr: string) {
  if (!addr || addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button onClick={copy} style={{
      fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
      color: copied ? "var(--cyan-400)" : "var(--text-tertiary)",
      background: copied ? "rgba(6,182,212,0.08)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${copied ? "rgba(6,182,212,0.2)" : "var(--border)"}`,
      padding: "3px 9px", borderRadius: 5, transition: "all 0.2s",
      cursor: "pointer",
    }}>{copied ? "COPIED" : "COPY"}</button>
  );
}

/* ═══ Modal ═══ */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
    }} onClick={onClose}>
      <div style={{
        background: "rgba(13,13,20,0.98)", border: "1px solid var(--border-hover)",
        borderRadius: "var(--radius-lg)", padding: 28, width: 440, maxWidth: "92vw",
        boxShadow: "0 32px 100px rgba(0,0,0,0.7)",
        animation: "modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17 }}>{title}</span>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: "50%", fontSize: 18, lineHeight: 1,
            color: "var(--text-tertiary)", background: "rgba(255,255,255,0.05)",
            border: "1px solid var(--border)", transition: "all 0.15s", cursor: "pointer",
          }}>×</button>
        </div>
        {children}
      </div>
      <style>{`@keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "10px 14px",
        background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-hover)",
        borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 14,
        fontFamily: "var(--font-mono)",
        outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
      }}
      onFocus={(e) => (e.target.style.borderColor = "var(--violet-500)")}
      onBlur={(e) => (e.target.style.borderColor = "var(--border-hover)")}
    />
  );
}

/* ═══ Wallet Detail Drawer ═══ */
function WalletDrawer({ wallet, txns, policies, onClose, onUpdate }: {
  wallet: Wallet; txns: Tx[]; policies: Policy[]; onClose: () => void; onUpdate: () => void;
}) {
  const [localStatus, setLocalStatus] = useState(wallet.status);
  const [toggling, setToggling] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const syncBalance = async () => {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch("/api/wallets/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: wallet.agentId }),
      });
      const json = await res.json();
      if (json.data?.synced) {
        setSyncResult(`Synced: $${json.data.balanceUsdc.toFixed(2)}`);
        onUpdate();
      } else {
        setSyncResult(json.data?.reason ?? "Not synced");
      }
    } catch { setSyncResult("Sync failed"); }
    finally { setSyncing(false); }
  };

  const agentTxns = txns.filter((t) => t.fromAgentId === wallet.agentId || t.toAgentId === wallet.agentId);
  const sentTxns = agentTxns.filter((t) => t.fromAgentId === wallet.agentId && t.status === "CONFIRMED");
  const policy = policies.find((p) => p.agentId === wallet.agentId);

  const sparkData = Array(7).fill(0);
  const now = Date.now();
  sentTxns.forEach((t) => {
    const daysAgo = Math.floor((now - new Date(t.createdAt).getTime()) / 86_400_000);
    if (daysAgo < 7) sparkData[6 - daysAgo] += t.amountUsdc;
  });
  const sparkMax = Math.max(...sparkData, 0.01);

  const totalSent = sentTxns.reduce((s, t) => s + t.amountUsdc, 0);
  const received = agentTxns.filter((t) => t.toAgentId === wallet.agentId && t.status === "CONFIRMED").reduce((s, t) => s + t.amountUsdc, 0);
  const p2pCount = sentTxns.filter((t) => t.isP2P).length;

  const toggleStatus = async () => {
    const next = localStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setToggling(true);
    try {
      const res = await fetch(`/api/wallets/${wallet.agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (json.success) { setLocalStatus(next); onUpdate(); }
    } finally { setToggling(false); }
  };

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const dayLabels = ["6d", "5d", "4d", "3d", "2d", "1d", "now"];

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 151,
        width: 440, maxWidth: "100vw",
        background: "rgba(10,10,18,0.98)", backdropFilter: "blur(24px)",
        borderLeft: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        animation: "drawerIn 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          position: "sticky", top: 0, background: "rgba(10,10,18,0.98)", zIndex: 2,
        }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19, letterSpacing: "-0.02em", marginBottom: 4 }}>
              {wallet.agentId}
            </div>
            <Badge variant={statusVariant[localStatus] || "default"}>{localStatus}</Badge>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: "50%", fontSize: 18,
            color: "var(--text-tertiary)", background: "rgba(255,255,255,0.05)",
            border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.15s",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Balance */}
          <div style={{
            padding: "22px 24px",
            background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(6,182,212,0.04) 100%)",
            border: "1px solid rgba(139,92,246,0.15)",
            borderRadius: "var(--radius-md)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 6 }}>Current Balance</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 2 }}>
              ${wallet.balanceUsdc.toFixed(2)}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>USDC · Base Sepolia</div>
          </div>

          {/* Address */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 10 }}>Wallet Address</div>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px",
              background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
            }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, flex: 1, color: "var(--text-secondary)", wordBreak: "break-all" }}>
                {wallet.address || "—"}
              </span>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {wallet.address && <CopyBtn text={wallet.address} />}
                {wallet.address && (
                  <a
                    href={`https://sepolia.basescan.org/address/${wallet.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
                      color: "var(--cyan-400)", background: "rgba(6,182,212,0.08)",
                      border: "1px solid rgba(6,182,212,0.2)",
                      padding: "3px 9px", borderRadius: 5, transition: "all 0.2s",
                      textDecoration: "none",
                    }}
                  >↗ SCAN</a>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "Total Sent", value: `$${totalSent.toFixed(2)}` },
              { label: "Received", value: `$${received.toFixed(2)}` },
              { label: "P2P Txns", value: `${p2pCount}` },
            ].map(({ label, value }) => (
              <div key={label} style={{
                padding: "14px 12px", textAlign: "center",
                background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
              }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 3 }}>{value}</div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* 7-day Sparkline */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 12 }}>7-Day Spending</div>
            <div style={{
              padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 70 }}>
                {sparkData.map((v, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                    <div style={{
                      width: "100%", borderRadius: "3px 3px 0 0",
                      minHeight: 3,
                      height: `${Math.max((v / sparkMax) * 100, 4)}%`,
                      background: v > 0 ? "var(--gradient-brand)" : "rgba(255,255,255,0.06)",
                      transition: "height 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
                      position: "relative",
                    }}>
                      {v > 0 && (
                        <div style={{
                          position: "absolute", bottom: "calc(100% + 4px)", left: "50%",
                          transform: "translateX(-50%)",
                          fontSize: 9, color: "var(--violet-300)", whiteSpace: "nowrap",
                          fontFamily: "var(--font-mono)", fontWeight: 600,
                        }}>${v.toFixed(2)}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 9, color: "var(--text-tertiary)", letterSpacing: "0.03em" }}>{dayLabels[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Policy */}
          {policy && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 10 }}>Spending Policy</div>
              <div style={{
                padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{policy.tier} tier</span>
                  <Badge variant={policy.isActive ? "success" : "default"}>{policy.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
                  {[
                    ["Per tx limit", `$${policy.maxPerTransaction}`],
                    ["Daily cap", `$${policy.dailyLimit}`],
                    ["Monthly cap", policy.monthlyLimit ? `$${policy.monthlyLimit.toLocaleString()}` : "—"],
                    ["Approval", policy.requireApproval ? "Required" : "Auto"],
                    ["Categories", policy.allowedCategories.length ? policy.allowedCategories.join(", ") : "Any"],
                    ["Blocked", `${policy.blockedMerchants.length} merchants`],
                  ].map(([k, v]) => (
                    <div key={String(k)}>
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 2 }}>{k}</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recent transactions */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 10 }}>
              Recent Transactions ({agentTxns.length} total)
            </div>
            {agentTxns.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13, background: "rgba(255,255,255,0.02)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                No transactions yet
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {agentTxns.slice(0, 8).map((t) => {
                  const isSender = t.fromAgentId === wallet.agentId;
                  return (
                    <div key={t.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 14px",
                      background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      gap: 12,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: isSender ? "#f87171" : "var(--cyan-400)", fontSize: 10 }}>{isSender ? "▲ SENT" : "▼ RECV"}</span>
                          <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {isSender ? (t.toAgentId || truncAddr(t.toAddress)) : t.fromAgentId}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{timeAgo(t.createdAt)}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, color: isSender ? "#f87171" : "var(--cyan-400)" }}>
                          {isSender ? "-" : "+"}${t.amountUsdc < 0.01 ? t.amountUsdc.toFixed(4) : t.amountUsdc.toFixed(2)}
                        </div>
                        <Badge variant={statusVariant[t.status] || "default"}>{t.status}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          {wallet.status !== "REVOKED" && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 10 }}>Wallet Actions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Btn onClick={syncBalance} disabled={syncing} variant="default">
                  {syncing ? "Syncing…" : "Sync On-Chain Balance"}
                </Btn>
                {syncResult && <div style={{ fontSize: 12, color: "var(--cyan-400)", fontFamily: "var(--font-mono)" }}>{syncResult}</div>}
                <Btn
                  variant={localStatus === "ACTIVE" ? "danger" : "primary"}
                  onClick={toggleStatus}
                  disabled={toggling}
                >
                  {toggling ? "Updating…" : localStatus === "ACTIVE" ? "Suspend Wallet" : "Reactivate Wallet"}
                </Btn>
              </div>
            </div>
          )}

          {/* Meta */}
          <div style={{ paddingBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 10 }}>Details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Agent ID", wallet.agentId],
                ["Created", new Date(wallet.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })],
                ["Internal ID", wallet.id],
              ].map(([k, v]) => (
                <div key={String(k)} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--text-tertiary)" }}>{k}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes drawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  );
}

/* ═══ Tabs ═══ */
function OverviewTab() {
  const { data: wallets, loading: wl } = useApi<Wallet[]>("/api/wallets");
  const { data: txns, loading: tl } = useApi<Tx[]>("/api/transactions", 30_000);

  if (wl || tl) return <Loader />;

  const all = txns ?? [];
  const ws = wallets ?? [];
  const now = Date.now();
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now - 7 * 86_400_000);
  const prevWeekStart = new Date(now - 14 * 86_400_000);

  const confirmed = all.filter((t) => t.status === "CONFIRMED");
  const totalBalance = ws.reduce((s, w) => s + w.balanceUsdc, 0);
  const activeWallets = ws.filter((w) => w.status === "ACTIVE").length;

  const todayConf = confirmed.filter((t) => new Date(t.createdAt) >= dayStart);
  const todayVolume = todayConf.reduce((s, t) => s + t.amountUsdc, 0);

  const weekConf = confirmed.filter((t) => new Date(t.createdAt) >= weekStart);
  const weekVolume = weekConf.reduce((s, t) => s + t.amountUsdc, 0);
  const prevWeekConf = confirmed.filter((t) => {
    const d = new Date(t.createdAt);
    return d >= prevWeekStart && d < weekStart;
  });
  const prevWeekVolume = prevWeekConf.reduce((s, t) => s + t.amountUsdc, 0);
  const weekChange = prevWeekVolume > 0 ? ((weekVolume - prevWeekVolume) / prevWeekVolume * 100).toFixed(0) : null;

  const weekAll = all.filter((t) => new Date(t.createdAt) >= weekStart);
  const failCount = weekAll.filter((t) => t.status === "FAILED" || t.status === "REJECTED").length;
  const failRate = weekAll.length > 0 ? ((failCount / weekAll.length) * 100).toFixed(1) : "0";

  const agentVolumes = ws.map((w) => ({
    id: w.agentId,
    vol: confirmed.filter((t) => t.fromAgentId === w.agentId).reduce((s, t) => s + t.amountUsdc, 0),
  })).sort((a, b) => b.vol - a.vol);
  const topAgent = agentVolumes[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Stats row */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Stat label="Total Balance" value={`$${totalBalance.toFixed(2)}`} sub={`${ws.length} wallets · ${activeWallets} active`} />
        <Stat label="Volume Today" value={`$${todayVolume.toFixed(2)}`} sub={`${todayConf.length} confirmed txns`} />
        <Stat
          label="Volume This Week"
          value={`$${weekVolume.toFixed(2)}`}
          sub={weekChange !== null ? `${Number(weekChange) >= 0 ? "+" : ""}${weekChange}% vs last week` : `${weekConf.length} txns`}
        />
        <Stat label="Failure Rate" value={`${failRate}%`} sub="Last 7 days" />
      </div>

      {/* Top agent + breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <GlassCard style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 14 }}>Agent Activity</div>
          {agentVolumes.length === 0
            ? <EmptyState icon="◈" title="No agents yet" sub="Create a wallet to get started" />
            : agentVolumes.slice(0, 5).map((a, i) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", width: 14 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: a.id === topAgent?.id ? "var(--violet-300)" : "var(--text)" }}>{a.id}</span>
                <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 700 }}>${a.vol.toFixed(2)}</span>
              </div>
            ))
          }
        </GlassCard>

        <GlassCard style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 14 }}>Payment Mix (7d)</div>
          {weekConf.length === 0
            ? <EmptyState icon="↗" title="No transactions" sub="Transactions will appear here" />
            : (() => {
              const onChain = weekConf.filter((t) => !t.isP2P && t.category !== "x402").length;
              const p2p = weekConf.filter((t) => t.isP2P).length;
              const x402 = weekConf.filter((t) => t.category === "x402").length;
              const total = weekConf.length;
              return [
                { label: "On-Chain", count: onChain, color: "var(--cyan-400)" },
                { label: "P2P", count: p2p, color: "var(--violet-300)" },
                { label: "x402", count: x402, color: "#f59e0b" },
              ].map(({ label, count, color }) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                    <span style={{ fontWeight: 600 }}>{count} <span style={{ color: "var(--text-tertiary)" }}>({total > 0 ? ((count / total) * 100).toFixed(0) : 0}%)</span></span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)" }}>
                    <div style={{ height: 4, borderRadius: 2, background: color, width: `${total > 0 ? (count / total) * 100 : 0}%`, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              ));
            })()
          }
        </GlassCard>
      </div>

      {/* Recent activity */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)", marginBottom: 14 }}>Recent Activity</h3>
        {all.length === 0
          ? <EmptyState icon="↗" title="No transactions yet" sub="Send a transaction or create a wallet to get started" />
          : <DataTable
              headers={["From", "To", "Amount", "Type", "Status", "Time"]}
              rows={all.slice(0, 8).map((t) => [
                <span key="f" style={{ fontWeight: 500 }}>{t.fromAgentId}</span>,
                <MonoText key="to">{truncAddr(t.toAgentId || t.toAddress)}</MonoText>,
                <span key="a" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>${t.amountUsdc < 0.01 ? t.amountUsdc.toFixed(4) : t.amountUsdc.toFixed(2)}</span>,
                <Badge key="type" variant={t.isP2P ? "violet" : t.category === "x402" ? "cyan" : "default"}>{t.isP2P ? "P2P" : t.category === "x402" ? "x402" : "ON-CHAIN"}</Badge>,
                <Badge key="st" variant={statusVariant[t.status] || "default"}>{t.status}</Badge>,
                <span key="time" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{timeAgo(t.createdAt)}</span>,
              ])}
            />
        }
      </div>
    </div>
  );
}

function WalletsTab() {
  const { data: wallets, loading, error, refetch } = useApi<Wallet[]>("/api/wallets", 30_000);
  const { data: txns } = useApi<Tx[]>("/api/transactions", 30_000);
  const { data: policies } = useApi<Policy[]>("/api/policies");
  const [selected, setSelected] = useState<Wallet | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newId, setNewId] = useState("");
  const [newFunding, setNewFunding] = useState("10");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const createWallet = useCallback(async () => {
    if (!newId.trim()) { setCreateError("Agent ID is required"); return; }
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: newId.trim(), initialFunding: parseFloat(newFunding) || 0 }),
      });
      const json = await res.json();
      if (!json.success) { setCreateError(json.error || "Failed to create wallet"); return; }
      setShowCreate(false);
      setNewId("");
      setNewFunding("10");
      refetch();
    } catch {
      setCreateError("Network error");
    } finally {
      setCreating(false);
    }
  }, [newId, newFunding, refetch]);

  if (loading) return <Loader />;
  if (error) return <ErrorMsg message={error} />;

  const totalBalance = (wallets ?? []).reduce((s, w) => s + w.balanceUsdc, 0);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Agent Wallets</h3>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
              {wallets?.length ?? 0} wallets · ${totalBalance.toFixed(2)} total · click a card to inspect
            </p>
          </div>
          <Btn onClick={() => setShowCreate(true)}>+ Create Wallet</Btn>
        </div>

        {(wallets ?? []).length === 0 && <EmptyState icon="◈" title="No wallets yet" sub="Create your first agent wallet to get started" />}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {(wallets ?? []).map((w) => {
            const txCount = txns?.filter((t) => t.fromAgentId === w.agentId).length ?? 0;
            const p2pCount = txns?.filter((t) => t.fromAgentId === w.agentId && t.isP2P).length ?? 0;
            const sent = txns?.filter((t) => t.fromAgentId === w.agentId && t.status === "CONFIRMED").reduce((s, t) => s + t.amountUsdc, 0) ?? 0;
            return (
              <div
                key={w.agentId}
                onClick={() => setSelected(w)}
                style={{ cursor: "pointer", transition: "transform 0.2s", borderRadius: "var(--radius-md)" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <GlassCard style={{ padding: 24, height: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                    <span style={{ fontWeight: 700, fontFamily: "var(--font-display)", fontSize: 14 }}>{w.agentId}</span>
                    <Badge variant={statusVariant[w.status] || "default"}>{w.status}</Badge>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)", marginBottom: 14 }}>{truncAddr(w.address)}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 10 }}>
                    ${w.balanceUsdc.toFixed(2)}
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-tertiary)", marginBottom: 14 }}>
                    <span>{txCount} txns</span>
                    <span>{p2pCount} P2P</span>
                    <span>${sent.toFixed(2)} sent</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--violet-400)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    View details →
                  </div>
                </GlassCard>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create wallet modal */}
      {showCreate && (
        <Modal title="Create Agent Wallet" onClose={() => { setShowCreate(false); setCreateError(""); setNewId(""); }}>
          <Field label="Agent ID">
            <Input value={newId} onChange={setNewId} placeholder="e.g. agent-echo" />
          </Field>
          <Field label="Initial Funding (USDC)">
            <Input value={newFunding} onChange={setNewFunding} placeholder="10" type="number" />
          </Field>
          {createError && <div style={{ fontSize: 13, color: "#f87171", marginBottom: 14 }}>{createError}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Btn>
            <Btn onClick={createWallet} disabled={creating}>{creating ? "Creating..." : "Create Wallet"}</Btn>
          </div>
        </Modal>
      )}

      {/* Wallet detail drawer */}
      {selected && (
        <WalletDrawer
          wallet={selected}
          txns={txns ?? []}
          policies={policies ?? []}
          onClose={() => setSelected(null)}
          onUpdate={refetch}
        />
      )}
    </>
  );
}

function TransactionsTab() {
  const { data: txns, loading, error, refetch } = useApi<Tx[]>("/api/transactions", 30_000);
  const { data: wallets } = useApi<Wallet[]>("/api/wallets", 30_000);
  const [agentFilter, setAgentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showSend, setShowSend] = useState(false);
  const [fromAgent, setFromAgent] = useState("");
  const [toAddr, setToAddr] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("compute");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const agentIds = [...new Set((wallets ?? []).map((w) => w.agentId))];

  const sendTx = useCallback(async () => {
    if (!fromAgent || !toAddr || !amount) { setSendError("All fields required"); return; }
    setSending(true); setSendError("");
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromAgentId: fromAgent, toAddress: toAddr, amountUsdc: parseFloat(amount), category }),
      });
      const json = await res.json();
      if (!json.success) { setSendError(json.error || "Transaction failed"); return; }
      setShowSend(false); setFromAgent(""); setToAddr(""); setAmount(""); setCategory("compute");
      refetch();
    } catch { setSendError("Network error"); }
    finally { setSending(false); }
  }, [fromAgent, toAddr, amount, category, refetch]);

  if (loading) return <Loader />;
  if (error) return <ErrorMsg message={error} />;

  const filtered = (txns ?? []).filter((t) => {
    const matchAgent = agentFilter === "all" || t.fromAgentId === agentFilter || t.toAgentId === agentFilter;
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchAgent && matchStatus;
  });

  const filterBtnStyle = (active: boolean) => ({
    padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600,
    background: active ? "rgba(139,92,246,0.12)" : "transparent",
    border: `1px solid ${active ? "var(--violet-500)" : "var(--border)"}`,
    color: active ? "var(--violet-300)" : "var(--text-tertiary)",
    cursor: "pointer", transition: "all 0.15s",
  });

  const selectStyle = {
    width: "100%", padding: "10px 14px",
    background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-hover)",
    borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 14, outline: "none", boxSizing: "border-box" as const,
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Agent:</span>
            {["all", ...agentIds].map((id) => (
              <button key={id} style={filterBtnStyle(agentFilter === id)} onClick={() => setAgentFilter(id)}>
                {id === "all" ? "All" : id}
              </button>
            ))}
            <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Status:</span>
            {["all", "CONFIRMED", "PENDING", "FAILED", "REJECTED"].map((s) => (
              <button key={s} style={filterBtnStyle(statusFilter === s)} onClick={() => setStatusFilter(s)}>
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
          <Btn onClick={() => setShowSend(true)}>+ Send Transaction</Btn>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{filtered.length} of {txns?.length ?? 0} transactions</div>
        {filtered.length === 0
          ? <EmptyState icon="↗" title="No transactions found" sub="Try adjusting your filters, or send your first transaction" />
          : <DataTable
              headers={["From", "To", "Amount", "Category", "Status", "Hash", "Time"]}
              rows={filtered.map((t) => [
                <span key="f" style={{ fontWeight: 500 }}>{t.fromAgentId}</span>,
                <MonoText key="to">{truncAddr(t.toAgentId || t.toAddress)}</MonoText>,
                <span key="a" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>${t.amountUsdc < 0.01 ? t.amountUsdc.toFixed(4) : t.amountUsdc.toFixed(2)}</span>,
                <Badge key="cat" variant={t.isP2P ? "violet" : t.category === "x402" ? "cyan" : "default"}>{t.isP2P ? "P2P" : (t.category || "—").toUpperCase()}</Badge>,
                <Badge key="st" variant={statusVariant[t.status] || "default"}>{t.status}</Badge>,
                <MonoText key="hash">{t.txHash ? truncAddr(t.txHash) : "—"}</MonoText>,
                <span key="time" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{timeAgo(t.createdAt)}</span>,
              ])}
            />
        }
      </div>

      {showSend && (
        <Modal title="Send On-Chain Transaction" onClose={() => { setShowSend(false); setSendError(""); }}>
          <Field label="From Agent">
            <select value={fromAgent} onChange={(e) => setFromAgent(e.target.value)} style={selectStyle}>
              <option value="">Select agent…</option>
              {(wallets ?? []).filter((w) => w.status === "ACTIVE").map((w) => (
                <option key={w.agentId} value={w.agentId}>{w.agentId} (${w.balanceUsdc.toFixed(2)})</option>
              ))}
            </select>
          </Field>
          <Field label="To Address (0x…)">
            <Input value={toAddr} onChange={setToAddr} placeholder="0x742d35Cc6634C0532925a3b8D4C9B7..." />
          </Field>
          <Field label="Amount (USDC)">
            <Input value={amount} onChange={setAmount} placeholder="1.00" type="number" />
          </Field>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
              {["compute", "storage", "api", "data", "inference", "other"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          {sendError && <div style={{ fontSize: 13, color: "#f87171", marginBottom: 14 }}>{sendError}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowSend(false)}>Cancel</Btn>
            <Btn onClick={sendTx} disabled={sending}>{sending ? "Sending…" : "Send"}</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

function P2PTab() {
  const { data: txns, loading, error, refetch } = useApi<Tx[]>("/api/transactions", 30_000);
  const { data: wallets } = useApi<Wallet[]>("/api/wallets", 30_000);
  const [showModal, setShowModal] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const p2p = (txns ?? []).filter((t) => t.isP2P);
  const total = p2p.reduce((s, t) => s + t.amountUsdc, 0);
  const agentIds = (wallets ?? []).map((w) => w.agentId);

  // Compute top agent pairs by volume
  const pairMap: Record<string, { vol: number; count: number }> = {};
  p2p.filter((t) => t.status === "CONFIRMED").forEach((t) => {
    const key = `${t.fromAgentId} → ${t.toAgentId || truncAddr(t.toAddress)}`;
    if (!pairMap[key]) pairMap[key] = { vol: 0, count: 0 };
    pairMap[key].vol += t.amountUsdc;
    pairMap[key].count++;
  });
  const topPairs = Object.entries(pairMap).sort((a, b) => b[1].vol - a[1].vol).slice(0, 5);

  const sendP2P = useCallback(async () => {
    if (!from || !to || !amount) { setSendError("All fields required"); return; }
    if (from === to) { setSendError("Cannot transfer to same agent"); return; }
    setSending(true); setSendError("");
    try {
      const res = await fetch("/api/p2p", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromAgentId: from, toAgentId: to, amountUsdc: parseFloat(amount), memo }),
      });
      const json = await res.json();
      if (!json.success) { setSendError(json.error || "Transfer failed"); return; }
      setShowModal(false); setFrom(""); setTo(""); setAmount(""); setMemo("");
      refetch();
    } catch { setSendError("Network error"); }
    finally { setSending(false); }
  }, [from, to, amount, memo, refetch]);

  if (loading) return <Loader />;
  if (error) return <ErrorMsg message={error} />;

  const AgentSelect = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{
        width: "100%", padding: "10px 14px",
        background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-hover)",
        borderRadius: "var(--radius-sm)", color: value ? "var(--text)" : "var(--text-tertiary)",
        fontSize: 14, outline: "none", boxSizing: "border-box",
      }}>
        <option value="">Select agent…</option>
        {agentIds.map((id) => <option key={id} value={id}>{id}</option>)}
      </select>
    </Field>
  );

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Stat label="Total P2P" value={`${p2p.length}`} sub={`${p2p.filter(t => t.status === "CONFIRMED").length} confirmed`} />
          <Stat label="P2P Volume" value={`$${total.toFixed(2)}`} sub="All time" />
          <Stat label="Avg Transfer" value={p2p.length > 0 ? `$${(total / p2p.length).toFixed(2)}` : "$0"} />
          <Stat label="Unique Pairs" value={`${Object.keys(pairMap).length}`} sub="Agent combinations" />
        </div>

        {topPairs.length > 0 && (
          <GlassCard style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 14 }}>Top Agent Pairs by Volume</div>
            {topPairs.map(([pair, { vol, count }]) => (
              <div key={pair} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, fontSize: 13 }}>
                <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>{pair}</span>
                <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>{count}×</span>
                <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>${vol.toFixed(2)}</span>
              </div>
            ))}
          </GlassCard>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Agent-to-Agent Transfers</h3>
          <Btn onClick={() => setShowModal(true)}>+ New Transfer</Btn>
        </div>
        {p2p.length === 0
          ? <EmptyState icon="⇄" title="No P2P transfers yet" sub="Transfer USDC instantly between agent wallets with no gas fees" />
          : <DataTable
              headers={["From", "To", "Amount", "Memo", "Status", "Time"]}
              rows={p2p.map((t) => [
                <span key="f" style={{ fontWeight: 500 }}>{t.fromAgentId}</span>,
                <span key="to" style={{ fontWeight: 500 }}>{t.toAgentId || truncAddr(t.toAddress)}</span>,
                <span key="a" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>${t.amountUsdc.toFixed(2)}</span>,
                <span key="m" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{t.memo || "—"}</span>,
                <Badge key="st" variant={statusVariant[t.status] || "default"}>{t.status}</Badge>,
                <span key="time" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{timeAgo(t.createdAt)}</span>,
              ])}
            />
        }
      </div>

      {showModal && (
        <Modal title="New P2P Transfer" onClose={() => { setShowModal(false); setSendError(""); }}>
          <AgentSelect value={from} onChange={setFrom} label="From Agent" />
          <AgentSelect value={to} onChange={setTo} label="To Agent" />
          <Field label="Amount (USDC)">
            <Input value={amount} onChange={setAmount} placeholder="5.00" type="number" />
          </Field>
          <Field label="Memo (optional)">
            <Input value={memo} onChange={setMemo} placeholder="Tool access fee" />
          </Field>
          {sendError && <div style={{ fontSize: 13, color: "#f87171", marginBottom: 14 }}>{sendError}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn onClick={sendP2P} disabled={sending}>{sending ? "Sending..." : "Send Transfer"}</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

function PoliciesTab() {
  const { data: policies, loading, error, refetch } = useApi<Policy[]>("/api/policies");
  const { data: wallets } = useApi<Wallet[]>("/api/wallets");
  const [showCreate, setShowCreate] = useState(false);
  const [pAgent, setPAgent] = useState("");
  const [pTier, setPTier] = useState("MODERATE");
  const [pMaxTx, setPMaxTx] = useState("50");
  const [pDaily, setPDaily] = useState("500");
  const [pMonthly, setPMonthly] = useState("5000");
  const [pRequireApproval, setPRequireApproval] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  async function createPolicy() {
    if (!pAgent) { setCreateErr("Select an agent"); return; }
    setCreating(true); setCreateErr("");
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: pAgent,
          tier: pTier,
          maxPerTransaction: parseFloat(pMaxTx),
          dailyLimit: parseFloat(pDaily),
          monthlyLimit: parseFloat(pMonthly),
          requireApproval: pRequireApproval,
          allowedRecipients: [],
          blockedMerchants: [],
          allowedCategories: [],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setShowCreate(false);
      setPAgent(""); setPMaxTx("50"); setPDaily("500"); setPMonthly("5000"); setPRequireApproval(false);
      refetch();
    } catch (e: unknown) {
      setCreateErr(e instanceof Error ? e.message : "Error");
    } finally { setCreating(false); }
  }

  if (loading) return <Loader />;
  if (error) return <ErrorMsg message={error} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Spending Policies</h3>
        <button onClick={() => setShowCreate(true)} style={{ background: "var(--accent-primary)", color: "#000", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Create Policy
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        {(policies ?? []).map((p) => (
          <GlassCard key={p.id} style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontFamily: "var(--font-display)", fontSize: 14 }}>{p.agentId}</span>
              <Badge variant={p.tier === "CONSERVATIVE" ? "cyan" : p.tier === "MODERATE" ? "warning" : "danger"}>{p.tier}</Badge>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
              {([
                ["Per tx", `$${p.maxPerTransaction}`],
                ["Daily", `$${p.dailyLimit}`],
                ["Monthly", p.monthlyLimit ? `$${p.monthlyLimit.toLocaleString()}` : "—"],
                ["Recipients", String(p.allowedRecipients.length || "Any")],
                ["Blocked", `${p.blockedMerchants.length}`],
                ["Approval", p.requireApproval ? "Required" : "Auto"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}>
                  <span style={{ color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{k}</span>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        ))}
      </div>
      {showCreate && (
        <Modal title="Create Spending Policy" onClose={() => setShowCreate(false)}>
          <Field label="Agent">
            <select value={pAgent} onChange={(e) => setPAgent(e.target.value)} style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13 }}>
              <option value="">Select agent…</option>
              {(wallets ?? []).map((w) => <option key={w.agentId} value={w.agentId}>{w.agentId}</option>)}
            </select>
          </Field>
          <Field label="Tier">
            <select value={pTier} onChange={(e) => setPTier(e.target.value)} style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13 }}>
              <option value="CONSERVATIVE">Conservative</option>
              <option value="MODERATE">Moderate</option>
              <option value="AGGRESSIVE">Aggressive</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </Field>
          <Field label="Max per transaction ($)">
            <Input value={pMaxTx} onChange={setPMaxTx} type="number" placeholder="50" />
          </Field>
          <Field label="Daily limit ($)">
            <Input value={pDaily} onChange={setPDaily} type="number" placeholder="500" />
          </Field>
          <Field label="Monthly limit ($)">
            <Input value={pMonthly} onChange={setPMonthly} type="number" placeholder="5000" />
          </Field>
          <Field label="">
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={pRequireApproval} onChange={(e) => setPRequireApproval(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent-primary)" }} />
              <span>Require approval for all transactions</span>
            </label>
          </Field>
          {createErr && <div style={{ color: "#f87171", fontSize: 13 }}>{createErr}</div>}
          <button onClick={createPolicy} disabled={creating} style={{ width: "100%", background: "var(--accent-primary)", color: "#000", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 700, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1, marginTop: 4 }}>
            {creating ? "Creating…" : "Create Policy"}
          </button>
        </Modal>
      )}
    </div>
  );
}

function X402Tab() {
  const { data: endpoints, loading, error, refetch } = useApi<Paywall[]>("/api/x402");
  const [showRegister, setShowRegister] = useState(false);
  const [ePath, setEPath] = useState("");
  const [ePrice, setEPrice] = useState("0.01");
  const [eDesc, setEDesc] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registerErr, setRegisterErr] = useState("");

  async function registerEndpoint() {
    if (!ePath) { setRegisterErr("Path is required"); return; }
    setRegistering(true); setRegisterErr("");
    try {
      const res = await fetch("/api/x402", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: ePath, priceUsdc: parseFloat(ePrice), description: eDesc || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setShowRegister(false);
      setEPath(""); setEPrice("0.01"); setEDesc("");
      refetch();
    } catch (e: unknown) {
      setRegisterErr(e instanceof Error ? e.message : "Error");
    } finally { setRegistering(false); }
  }

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Paywall Endpoints</h3>
        <button onClick={() => setShowRegister(true)} style={{ background: "var(--accent-primary)", color: "#000", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Register Endpoint
        </button>
      </div>
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
      {showRegister && (
        <Modal title="Register x402 Endpoint" onClose={() => setShowRegister(false)}>
          <Field label="Path">
            <Input value={ePath} onChange={setEPath} placeholder="/api/your-endpoint" />
          </Field>
          <Field label="Price (USDC)">
            <Input value={ePrice} onChange={setEPrice} type="number" placeholder="0.01" />
          </Field>
          <Field label="Description (optional)">
            <Input value={eDesc} onChange={setEDesc} placeholder="What does this endpoint do?" />
          </Field>
          {registerErr && <div style={{ color: "#f87171", fontSize: 13 }}>{registerErr}</div>}
          <button onClick={registerEndpoint} disabled={registering} style={{ width: "100%", background: "var(--accent-primary)", color: "#000", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 700, cursor: registering ? "not-allowed" : "pointer", opacity: registering ? 0.7 : 1, marginTop: 4 }}>
            {registering ? "Registering…" : "Register Endpoint"}
          </button>
        </Modal>
      )}
    </div>
  );
}

function AnalyticsTab() {
  const { data: txns, loading } = useApi<Tx[]>("/api/transactions");
  const { data: wallets } = useApi<Wallet[]>("/api/wallets");

  if (loading) return <Loader />;

  const all = txns ?? [];
  const now = Date.now();
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now - 7 * 86_400_000);

  const todayConf = all.filter((t) => t.status === "CONFIRMED" && new Date(t.createdAt) >= dayStart);
  const weekConf = all.filter((t) => t.status === "CONFIRMED" && new Date(t.createdAt) >= weekStart);
  const weekAll = all.filter((t) => new Date(t.createdAt) >= weekStart);
  const failed = weekAll.filter((t) => t.status === "FAILED" || t.status === "REJECTED").length;
  const failRate = weekAll.length > 0 ? ((failed / weekAll.length) * 100).toFixed(1) : "0";

  const todayVol = todayConf.reduce((s, t) => s + t.amountUsdc, 0);
  const weekVol = weekConf.reduce((s, t) => s + t.amountUsdc, 0);
  const avgSize = weekConf.length > 0 ? weekVol / weekConf.length : 0;

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dailyVols = Array(7).fill(0);
  weekConf.forEach((t) => {
    const day = new Date(t.createdAt).getDay();
    const idx = day === 0 ? 6 : day - 1;
    dailyVols[idx] += t.amountUsdc;
  });
  const maxVol = Math.max(...dailyVols, 1);

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

/* ═══ API Keys Tab ═══ */
function ApiKeysTab() {
  const { data: keys, loading, error, refetch } = useApi<ApiKey[]>("/api/keys");
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function createKey() {
    if (!keyName.trim()) { setCreateErr("Name is required"); return; }
    setCreating(true); setCreateErr("");
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName.trim(), scopes: ["*"] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setNewKey(json.data.key);
      setKeyName("");
      refetch();
    } catch (e: unknown) {
      setCreateErr(e instanceof Error ? e.message : "Error");
    } finally { setCreating(false); }
  }

  async function revokeKey(id: string) {
    try {
      await fetch(`/api/keys/${id}`, { method: "DELETE" });
      refetch();
    } catch {}
  }

  function copyKey(val: string) {
    navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <Loader />;
  if (error) return <ErrorMsg message={error} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>API Keys</h3>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>Keys authenticate programmatic access via the <span style={{ fontFamily: "var(--font-mono)" }}>X-Api-Key</span> header.</p>
        </div>
        <button onClick={() => { setShowCreate(true); setNewKey(null); }} style={{ background: "var(--accent-primary)", color: "#000", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Create Key
        </button>
      </div>

      {newKey && (
        <GlassCard style={{ padding: 20, border: "1px solid rgba(6,182,212,0.3)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cyan-400)", marginBottom: 8, letterSpacing: "0.06em" }}>KEY CREATED — COPY NOW, IT WON&apos;T BE SHOWN AGAIN</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)", wordBreak: "break-all", flex: 1 }}>{newKey}</span>
            <button onClick={() => copyKey(newKey)} style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 6, padding: "6px 12px", color: "var(--cyan-400)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </GlassCard>
      )}

      <DataTable
        headers={["Name", "Prefix", "Scopes", "Last Used", "Status", ""]}
        rows={(keys ?? []).map((k) => [
          <span key="name" style={{ fontWeight: 600 }}>{k.name}</span>,
          <MonoText key="prefix">{k.prefix}…</MonoText>,
          <span key="scopes" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{k.scopes.join(", ")}</span>,
          <span key="used" style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{k.lastUsedAt ? timeAgo(k.lastUsedAt) : "Never"}</span>,
          <Badge key="status" variant={k.isActive ? "success" : "default"}>{k.isActive ? "ACTIVE" : "REVOKED"}</Badge>,
          k.isActive
            ? <button key="revoke" onClick={() => revokeKey(k.id)} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "4px 10px", color: "#f87171", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Revoke</button>
            : <span key="revoked" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>—</span>,
        ])}
      />

      {showCreate && !newKey && (
        <Modal title="Create API Key" onClose={() => setShowCreate(false)}>
          <Field label="Key name">
            <Input value={keyName} onChange={setKeyName} placeholder="e.g. production-agent" />
          </Field>
          <Field label="Scopes">
            <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", fontSize: 13, color: "var(--text-tertiary)" }}>
              Full access <span style={{ fontFamily: "var(--font-mono)", color: "var(--violet-300)" }}>["*"]</span>
            </div>
          </Field>
          {createErr && <div style={{ color: "#f87171", fontSize: 13 }}>{createErr}</div>}
          <button onClick={createKey} disabled={creating} style={{ width: "100%", background: "var(--accent-primary)", color: "#000", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 700, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1, marginTop: 4 }}>
            {creating ? "Creating…" : "Create Key"}
          </button>
        </Modal>
      )}
    </div>
  );
}

/* ═══ MAIN DASHBOARD ═══ */
export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const { data: system } = useApi<{ cdp: string; database: string; cdpNetwork: string }>("/api/system");
  useScrollReveal();

  const content: Record<Tab, React.ReactNode> = {
    overview: <OverviewTab />, wallets: <WalletsTab />, transactions: <TransactionsTab />,
    p2p: <P2PTab />, policies: <PoliciesTab />, x402: <X402Tab />, analytics: <AnalyticsTab />,
    keys: <ApiKeysTab />,
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <AmbientGlow />

      {/* Sidebar */}
      <aside style={{
        position: "fixed", left: 0, top: 0, bottom: 0, width: 230, zIndex: 50,
        background: "rgba(9,9,15,0.92)",
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
              transition: "all 0.2s ease", cursor: "pointer",
            }}
            onMouseEnter={(e) => { if (tab !== t.key) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
            onMouseLeave={(e) => { if (tab !== t.key) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: 14, opacity: 0.7, width: 18, textAlign: "center" }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {/* CDP status */}
        <div style={{ margin: "0 14px 8px", padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Network</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", color: "var(--violet-300)", fontFamily: "var(--font-mono)" }}>{(system?.cdpNetwork ?? "base-sepolia").toUpperCase()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>CDP</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: system?.cdp === "live" ? "var(--cyan-400)" : "#f59e0b", boxShadow: system?.cdp === "live" ? "0 0 6px var(--cyan-400)" : "0 0 6px #f59e0b" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: system?.cdp === "live" ? "var(--cyan-400)" : "#f59e0b", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                {system?.cdp === "live" ? "LIVE" : system ? "SIMULATED" : "…"}
              </span>
            </div>
          </div>
        </div>
        <Link href="/docs" style={{ margin: "0 14px", padding: "9px 14px", borderRadius: "var(--radius-sm)", display: "block", background: "transparent", border: "1px solid var(--border)", fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", fontWeight: 600, transition: "all 0.2s", textDecoration: "none" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.borderColor = "var(--border-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.borderColor = "var(--border)"; }}
        >API Docs →</Link>
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

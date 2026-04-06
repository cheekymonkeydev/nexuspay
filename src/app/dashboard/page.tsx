"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { NexusLogo, AmbientGlow, GlassCard, Badge, useScrollReveal } from "@/components/shared";
import { useApi } from "@/lib/hooks";
import { timeAgo } from "@/lib/utils";

/* ═══ Types ═══ */
interface Wallet {
  id: string; agentId: string; address: string; balanceUsdc: number;
  status: string; createdAt: string;
  autoTopUpEnabled?: boolean; topUpThreshold?: number | null; topUpAmount?: number | null;
  _count?: { sentTransactions: number; policies: number };
}
interface Tx {
  id: string; fromAgentId: string; toAddress: string; toAgentId?: string;
  amountUsdc: number; status: string; txHash?: string | null; category?: string;
  memo?: string; isP2P: boolean; createdAt: string; failureReason?: string | null;
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
interface Treasury {
  id: string; balanceUsdc: number; totalFunded: number; totalDisbursed: number; updatedAt: string;
}
interface ApiKey {
  id: string; name: string; prefix: string; scopes: string[];
  isActive: boolean; lastUsedAt: string | null; createdAt: string;
}

/* ═══ Wallet status (top-right header) ═══ */
function WalletStatus() {
  const [address, setAddress] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.address) setAddress(d.address);
    });
  }, []);

  const disconnect = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  // Open mode or not connected — show nothing
  if (!address) return null;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 16px", borderRadius: 99,
          background: "rgba(139,92,246,0.08)",
          border: "1px solid rgba(139,92,246,0.2)",
          color: "var(--violet-300)", fontSize: 13, fontWeight: 600,
          fontFamily: "var(--font-mono)", cursor: "pointer",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.14)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.08)"; }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--cyan-400)", boxShadow: "0 0 6px var(--cyan-400)" }} />
        {address.slice(0, 6)}…{address.slice(-4)}
        <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 100,
            background: "rgba(13,13,20,0.98)", border: "1px solid var(--border-hover)",
            borderRadius: "var(--radius-md)", padding: 6, minWidth: 180,
            boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
          }}>
            <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", borderBottom: "1px solid var(--border-subtle)", marginBottom: 4 }}>
              {address}
            </div>
            <button
              onClick={disconnect}
              style={{
                width: "100%", textAlign: "left", padding: "9px 12px",
                borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 500,
                color: "#f87171", background: "transparent", border: "none",
                cursor: "pointer", transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >Disconnect</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══ Constants ═══ */
type Tab = "overview" | "wallets" | "transactions" | "p2p" | "policies" | "x402" | "analytics" | "keys" | "webhooks" | "mpp";
const tabList: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "◎" },
  { key: "wallets", label: "Wallets", icon: "◈" },
  { key: "transactions", label: "Transactions", icon: "↗" },
  { key: "p2p", label: "P2P", icon: "⇄" },
  { key: "policies", label: "Policies", icon: "⊞" },
  { key: "x402", label: "x402", icon: "⚡" },
  { key: "mpp", label: "MPP", icon: "⬡" },
  { key: "analytics", label: "Analytics", icon: "◉" },
  { key: "keys", label: "API Keys", icon: "⌗" },
  { key: "webhooks", label: "Webhooks", icon: "⇡" },
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
/* ─── Fund Wallet Modal ───────────────────────────────── */
function FundModal({ wallet, network, onClose, onBalanceUpdate }: {
  wallet: Wallet; network: string; onClose: () => void; onBalanceUpdate: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [balance, setBalance] = useState(wallet.balanceUsdc);
  const [detected, setDetected] = useState(false);
  const prevBalanceRef = useRef(wallet.balanceUsdc);

  // Generate QR code on mount
  useEffect(() => {
    if (!wallet.address || !canvasRef.current) return;
    import("qrcode").then((QRCode) => {
      QRCode.toCanvas(canvasRef.current!, wallet.address, {
        width: 200, margin: 2,
        color: { dark: "#a78bfa", light: "#0a0a12" },
      });
    });
  }, [wallet.address]);

  // Poll balance every 5s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/wallets/${wallet.agentId}`);
        const json = await res.json();
        const newBal: number = json.data?.balanceUsdc ?? json.balanceUsdc ?? prevBalanceRef.current;
        if (newBal > prevBalanceRef.current) {
          setDetected(true);
          onBalanceUpdate();
        }
        prevBalanceRef.current = newBal;
        setBalance(newBal);
      } catch { /* ignore */ }
    };
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [wallet.agentId, onBalanceUpdate]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const basescanUrl = isMainnet(network)
    ? `https://basescan.org/address/${wallet.address}`
    : `https://sepolia.basescan.org/address/${wallet.address}`;

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} onClick={onClose} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        zIndex: 201, width: 400, maxWidth: "95vw",
        background: "rgba(10,10,18,0.99)", backdropFilter: "blur(24px)",
        border: "1px solid rgba(139,92,246,0.25)",
        borderRadius: "var(--radius-xl)",
        padding: 32,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
      }}>
        {/* Header */}
        <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, letterSpacing: "-0.02em" }}>Fund Wallet</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{wallet.agentId}</div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: "50%", fontSize: 18,
            color: "var(--text-tertiary)", background: "rgba(255,255,255,0.05)",
            border: "1px solid var(--border)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* QR Code */}
        <div style={{
          padding: 12, borderRadius: "var(--radius-md)",
          background: "#0a0a12", border: "1px solid rgba(139,92,246,0.2)",
        }}>
          <canvas ref={canvasRef} style={{ display: "block", borderRadius: 6 }} />
        </div>

        {/* Instruction */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Send <strong style={{ color: "var(--text)" }}>USDC</strong> on <strong style={{ color: "var(--violet-300)" }}>Base</strong> to this address.
            Balance updates automatically every 5 seconds.
          </div>
        </div>

        {/* Address */}
        <div style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "12px 14px",
          background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, flex: 1, color: "var(--text-secondary)", wordBreak: "break-all", lineHeight: 1.5 }}>
            {wallet.address}
          </span>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <CopyBtn text={wallet.address} />
            <a href={basescanUrl} target="_blank" rel="noopener noreferrer" style={{
              fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
              color: "var(--cyan-400)", background: "rgba(6,182,212,0.08)",
              border: "1px solid rgba(6,182,212,0.2)",
              padding: "3px 9px", borderRadius: 5, textDecoration: "none",
            }}>↗</a>
          </div>
        </div>

        {/* Live balance */}
        <div style={{
          width: "100%", padding: "16px 20px", borderRadius: "var(--radius-md)",
          background: detected
            ? "linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(139,92,246,0.06) 100%)"
            : "rgba(255,255,255,0.02)",
          border: `1px solid ${detected ? "rgba(6,182,212,0.35)" : "var(--border)"}`,
          transition: "all 0.4s ease",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 4 }}>
              Current Balance
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: detected ? "var(--cyan-400)" : "var(--text)" }}>
              ${balance.toFixed(2)}
            </div>
          </div>
          {detected ? (
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cyan-400)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16 }}>✓</span> Funds detected!
            </div>
          ) : (
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "var(--text-tertiary)",
                  animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", lineHeight: 1.5 }}>
          Only send USDC on Base. Other tokens or networks will be lost.
        </div>
      </div>
    </>
  );
}

function WalletDrawer({ wallet, txns, policies, network, onClose, onUpdate }: {
  wallet: Wallet; txns: Tx[]; policies: Policy[]; network: string; onClose: () => void; onUpdate: () => void;
}) {
  const [localStatus, setLocalStatus] = useState(wallet.status);
  const [toggling, setToggling] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [showFund, setShowFund] = useState(false);

  // Auto top-up state
  const [topUpEnabled, setTopUpEnabled] = useState(wallet.autoTopUpEnabled ?? false);
  const [topUpThreshold, setTopUpThreshold] = useState(wallet.topUpThreshold?.toString() ?? "");
  const [topUpAmount, setTopUpAmount] = useState(wallet.topUpAmount?.toString() ?? "");
  const [savingTopUp, setSavingTopUp] = useState(false);
  const [topUpResult, setTopUpResult] = useState<string | null>(null);

  const saveTopUp = async () => {
    setSavingTopUp(true); setTopUpResult(null);
    try {
      const res = await fetch(`/api/wallets/${wallet.agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoTopUpEnabled: topUpEnabled,
          topUpThreshold: topUpThreshold ? parseFloat(topUpThreshold) : null,
          topUpAmount: topUpAmount ? parseFloat(topUpAmount) : null,
        }),
      });
      const json = await res.json();
      if (json.success) { setTopUpResult("Saved"); onUpdate(); }
      else setTopUpResult(json.error || "Failed to save");
    } catch { setTopUpResult("Network error"); }
    finally { setSavingTopUp(false); }
  };

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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>USDC · {network}</div>
              {wallet.address && (
                <button
                  onClick={() => setShowFund(true)}
                  style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                    padding: "5px 12px", borderRadius: 99,
                    background: "rgba(6,182,212,0.12)",
                    border: "1px solid rgba(6,182,212,0.3)",
                    color: "var(--cyan-400)", cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(6,182,212,0.2)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(6,182,212,0.12)"; }}
                >
                  + Fund Wallet
                </button>
              )}
            </div>
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
                    href={basescanAddr(wallet.address, network)}
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

          {/* Auto Top-Up */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 10 }}>Auto Top-Up</div>
            <div style={{ padding: 16, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Enable auto top-up</span>
                <div
                  onClick={() => setTopUpEnabled((v) => !v)}
                  style={{
                    width: 36, height: 20, borderRadius: 10, cursor: "pointer", transition: "background 0.2s",
                    background: topUpEnabled ? "var(--violet-500)" : "rgba(255,255,255,0.1)",
                    position: "relative",
                  }}
                >
                  <div style={{
                    position: "absolute", top: 2, left: topUpEnabled ? 18 : 2,
                    width: 16, height: 16, borderRadius: "50%", background: "#fff",
                    transition: "left 0.2s",
                  }} />
                </div>
              </label>
              {topUpEnabled && (
                <>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                    When balance drops below the threshold, automatically pull the top-up amount from treasury.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>Threshold (USDC)</div>
                      <input
                        type="number" value={topUpThreshold} onChange={(e) => setTopUpThreshold(e.target.value)}
                        placeholder="e.g. 10"
                        style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-hover)", borderRadius: 6, color: "var(--text)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>Top-Up Amount (USDC)</div>
                      <input
                        type="number" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)}
                        placeholder="e.g. 50"
                        style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-hover)", borderRadius: 6, color: "var(--text)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                </>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={saveTopUp} disabled={savingTopUp}
                  style={{ padding: "7px 16px", borderRadius: 7, fontSize: 12, fontWeight: 700, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", color: "var(--violet-300)", cursor: "pointer", opacity: savingTopUp ? 0.6 : 1 }}
                >{savingTopUp ? "Saving…" : "Save"}</button>
                {topUpResult && <span style={{ fontSize: 12, color: topUpResult === "Saved" ? "var(--cyan-400)" : "#f87171" }}>{topUpResult}</span>}
              </div>
            </div>
          </div>

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
      <style>{`
        @keyframes drawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1); } }
      `}</style>
      {showFund && (
        <FundModal
          wallet={wallet}
          network={network}
          onClose={() => setShowFund(false)}
          onBalanceUpdate={onUpdate}
        />
      )}
    </>
  );
}

/* ═══ Tabs ═══ */
function OverviewTab() {
  const { data: wallets, loading: wl } = useApi<Wallet[]>("/api/wallets");
  const { data: txPage, loading: tl } = useApi<TxPage>("/api/transactions?limit=100", 30_000);
  const txns = txPage?.items;

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
  const { data: txPage } = useApi<TxPage>("/api/transactions?limit=100", 30_000);
  const txns = txPage?.items;
  const { data: policies } = useApi<Policy[]>("/api/policies");
  const { data: system } = useApi<{ cdpNetwork: string }>("/api/system");
  const [selected, setSelected] = useState<Wallet | null>(null);
  const [fundingWallet, setFundingWallet] = useState<Wallet | null>(null);
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--violet-400)", fontWeight: 600 }}>View details →</div>
                    {w.address && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setFundingWallet(w); }}
                        style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                          padding: "4px 10px", borderRadius: 99,
                          background: "rgba(6,182,212,0.08)",
                          border: "1px solid rgba(6,182,212,0.2)",
                          color: "var(--cyan-400)", cursor: "pointer",
                        }}
                      >+ Fund</button>
                    )}
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
          network={system?.cdpNetwork ?? "base-sepolia"}
          onClose={() => setSelected(null)}
          onUpdate={refetch}
        />
      )}
      {fundingWallet && (
        <FundModal
          wallet={fundingWallet}
          network={system?.cdpNetwork ?? "base-sepolia"}
          onClose={() => setFundingWallet(null)}
          onBalanceUpdate={refetch}
        />
      )}
    </>
  );
}

interface TxPage { items: Tx[]; total: number; page: number; limit: number; pages: number; }

function TransactionsTab() {
  const { data: wallets } = useApi<Wallet[]>("/api/wallets", 30_000);
  const { data: system } = useApi<{ cdpNetwork: string }>("/api/system");
  const [page, setPage] = useState(1);
  const [agentFilter, setAgentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTx, setSelectedTx] = useState<Tx | null>(null);
  const [showSend, setShowSend] = useState(false);
  const [fromAgent, setFromAgent] = useState("");
  const [toAddr, setToAddr] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("compute");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (agentFilter !== "all") params.set("agentId", agentFilter);
  if (statusFilter !== "all") params.set("status", statusFilter);
  const { data, loading, error, refetch } = useApi<TxPage>(`/api/transactions?${params}`, 30_000);

  const txns = data?.items ?? [];
  const agentIds = [...new Set((wallets ?? []).map((w) => w.agentId))];

  // Reset to page 1 when filters change
  const setAgent = (v: string) => { setAgentFilter(v); setPage(1); };
  const setStatus = (v: string) => { setStatusFilter(v); setPage(1); };

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
              <button key={id} style={filterBtnStyle(agentFilter === id)} onClick={() => setAgent(id)}>
                {id === "all" ? "All" : id}
              </button>
            ))}
            <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Status:</span>
            {["all", "CONFIRMED", "PENDING", "FAILED", "REJECTED"].map((s) => (
              <button key={s} style={filterBtnStyle(statusFilter === s)} onClick={() => setStatus(s)}>
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
          <Btn onClick={() => setShowSend(true)}>+ Send Transaction</Btn>
        </div>

        {/* Count + pagination row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            {data ? `${data.total} total · page ${data.page} of ${data.pages}` : "Loading…"}
          </div>
          {data && data.pages > 1 && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{
                padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: "transparent", border: "1px solid var(--border)",
                color: page === 1 ? "var(--text-tertiary)" : "var(--text)",
                cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1,
              }}>← Prev</button>
              {Array.from({ length: Math.min(data.pages, 7) }, (_, i) => {
                const p = data.pages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= data.pages - 3 ? data.pages - 6 + i : page - 3 + i;
                return (
                  <button key={p} onClick={() => setPage(p)} style={{
                    width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: p === page ? "rgba(139,92,246,0.12)" : "transparent",
                    border: `1px solid ${p === page ? "var(--violet-500)" : "var(--border)"}`,
                    color: p === page ? "var(--violet-300)" : "var(--text-tertiary)",
                    cursor: "pointer",
                  }}>{p}</button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages} style={{
                padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: "transparent", border: "1px solid var(--border)",
                color: page === data.pages ? "var(--text-tertiary)" : "var(--text)",
                cursor: page === data.pages ? "not-allowed" : "pointer", opacity: page === data.pages ? 0.4 : 1,
              }}>Next →</button>
            </div>
          )}
        </div>

        {loading ? <Loader /> : error ? <ErrorMsg message={error} /> : txns.length === 0
          ? <EmptyState icon="↗" title="No transactions found" sub="Try adjusting your filters, or send your first transaction" />
          : <DataTable
              headers={["From", "To", "Amount", "Category", "Status", "Hash", "Time"]}
              rows={txns.map((t) => [
                <span key="f" style={{ fontWeight: 500 }}>{t.fromAgentId}</span>,
                <MonoText key="to">{truncAddr(t.toAgentId || t.toAddress)}</MonoText>,
                <span key="a" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>${t.amountUsdc < 0.01 ? t.amountUsdc.toFixed(4) : t.amountUsdc.toFixed(2)}</span>,
                <Badge key="cat" variant={t.isP2P ? "violet" : t.category === "x402" ? "cyan" : "default"}>{t.isP2P ? "P2P" : (t.category || "—").toUpperCase()}</Badge>,
                <Badge key="st" variant={statusVariant[t.status] || "default"}>{t.status}</Badge>,
                <MonoText key="hash">{t.txHash ? truncAddr(t.txHash) : "—"}</MonoText>,
                <button key="time" onClick={() => setSelectedTx(t)} style={{ fontSize: 12, color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", textDecorationStyle: "dotted" }}>{timeAgo(t.createdAt)}</button>,
              ])}
            />
        }
        {selectedTx && <TxDetailModal tx={selectedTx} network={system?.cdpNetwork ?? "base-sepolia"} onClose={() => setSelectedTx(null)} />}
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
  const { data: txPage, loading, error, refetch } = useApi<TxPage>("/api/transactions?limit=100", 30_000);
  const txns = txPage?.items ?? [];
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

function PolicyForm({ initial, wallets, onSave, onClose, saving, err: formErr }: {
  initial?: Policy; wallets: Wallet[]; onSave: (d: Record<string, unknown>) => void;
  onClose: () => void; saving: boolean; err: string;
}) {
  const [pAgent, setPAgent] = useState(initial?.agentId ?? "");
  const [pTier, setPTier] = useState(initial?.tier ?? "MODERATE");
  const [pMaxTx, setPMaxTx] = useState(String(initial?.maxPerTransaction ?? "50"));
  const [pDaily, setPDaily] = useState(String(initial?.dailyLimit ?? "500"));
  const [pMonthly, setPMonthly] = useState(String(initial?.monthlyLimit ?? "5000"));
  const [pApproval, setPApproval] = useState(initial?.requireApproval ?? false);
  const selectStyle = { width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13 };
  return (
    <Modal title={initial ? "Edit Policy" : "Create Spending Policy"} onClose={onClose}>
      {!initial && (
        <Field label="Agent">
          <select value={pAgent} onChange={(e) => setPAgent(e.target.value)} style={selectStyle}>
            <option value="">Select agent…</option>
            {wallets.map((w) => <option key={w.agentId} value={w.agentId}>{w.agentId}</option>)}
          </select>
        </Field>
      )}
      <Field label="Tier">
        <select value={pTier} onChange={(e) => setPTier(e.target.value)} style={selectStyle}>
          {["CONSERVATIVE","MODERATE","AGGRESSIVE","CUSTOM"].map(t => <option key={t} value={t}>{t[0]+t.slice(1).toLowerCase()}</option>)}
        </select>
      </Field>
      <Field label="Max per transaction ($)"><Input value={pMaxTx} onChange={setPMaxTx} type="number" placeholder="50" /></Field>
      <Field label="Daily limit ($)"><Input value={pDaily} onChange={setPDaily} type="number" placeholder="500" /></Field>
      <Field label="Monthly limit ($)"><Input value={pMonthly} onChange={setPMonthly} type="number" placeholder="5000" /></Field>
      <Field label="">
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
          <input type="checkbox" checked={pApproval} onChange={(e) => setPApproval(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent-primary)" }} />
          <span>Require approval for all transactions</span>
        </label>
      </Field>
      {formErr && <div style={{ color: "#f87171", fontSize: 13 }}>{formErr}</div>}
      <button onClick={() => onSave({ agentId: pAgent, tier: pTier, maxPerTransaction: parseFloat(pMaxTx), dailyLimit: parseFloat(pDaily), monthlyLimit: parseFloat(pMonthly), requireApproval: pApproval, allowedRecipients: [], blockedMerchants: [], allowedCategories: [] })} disabled={saving} style={{ width: "100%", background: "var(--accent-primary)", color: "#000", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, marginTop: 4 }}>
        {saving ? "Saving…" : initial ? "Save Changes" : "Create Policy"}
      </button>
    </Modal>
  );
}

function PoliciesTab() {
  const { data: policies, loading, error, refetch } = useApi<Policy[]>("/api/policies");
  const { data: wallets } = useApi<Wallet[]>("/api/wallets");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  async function savePolicy(data: Record<string, unknown>) {
    if (!editing && !data.agentId) { setFormErr("Select an agent"); return; }
    setSaving(true); setFormErr("");
    try {
      const res = await fetch(editing ? `/api/policies/${editing.id}` : "/api/policies", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setShowCreate(false); setEditing(null); refetch();
    } catch (e: unknown) { setFormErr(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  async function deletePolicy(id: string) {
    if (!confirm("Delete this policy? This cannot be undone.")) return;
    await fetch(`/api/policies/${id}`, { method: "DELETE" });
    refetch();
  }

  if (loading) return <Loader />;
  if (error) return <ErrorMsg message={error} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Spending Policies</h3>
        <button onClick={() => setShowCreate(true)} style={{ background: "var(--accent-primary)", color: "#000", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Create Policy</button>
      </div>
      {(policies ?? []).length === 0 && <EmptyState icon="⊞" title="No policies yet" sub="Create a spending policy to control how agents spend USDC" />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        {(policies ?? []).map((p) => (
          <GlassCard key={p.id} style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontFamily: "var(--font-display)", fontSize: 14 }}>{p.agentId}</div>
                <Badge variant={p.tier === "CONSERVATIVE" ? "cyan" : p.tier === "MODERATE" ? "warning" : "danger"}>{p.tier}</Badge>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setEditing(p)} style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 6, padding: "4px 10px", color: "var(--violet-300)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                <button onClick={() => deletePolicy(p.id)} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "4px 10px", color: "#f87171", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Delete</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
              {([["Per tx", `$${p.maxPerTransaction}`], ["Daily", `$${p.dailyLimit}`], ["Monthly", p.monthlyLimit ? `$${p.monthlyLimit.toLocaleString()}` : "—"], ["Approval", p.requireApproval ? "Required" : "Auto"]] as [string,string][]).map(([k,v]) => (
                <div key={k}>
                  <span style={{ color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{k}</span>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        ))}
      </div>
      {showCreate && <PolicyForm wallets={wallets ?? []} onSave={savePolicy} onClose={() => setShowCreate(false)} saving={saving} err={formErr} />}
      {editing && <PolicyForm initial={editing} wallets={wallets ?? []} onSave={savePolicy} onClose={() => setEditing(null)} saving={saving} err={formErr} />}
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
      {(endpoints ?? []).length === 0 && <EmptyState icon="⚡" title="No endpoints yet" sub="Register a paywall endpoint to start earning per-request USDC" />}
      <DataTable
        headers={["Path", "Price", "Hits", "Revenue", "Status", ""]}
        rows={(endpoints ?? []).map((p) => [
          <MonoText key="path">{p.path}</MonoText>,
          <span key="price" style={{ fontFamily: "var(--font-mono)" }}>${p.priceUsdc.toFixed(4)}</span>,
          p.hitCount.toLocaleString(),
          <span key="rev" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>${p.totalPaid.toFixed(2)}</span>,
          <Badge key="st" variant={p.isActive ? "success" : "default"}>{p.isActive ? "ACTIVE" : "DISABLED"}</Badge>,
          <button key="toggle" onClick={async () => {
            await fetch(`/api/x402/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !p.isActive }) });
            refetch();
          }} style={{ background: p.isActive ? "rgba(239,68,68,0.08)" : "rgba(6,182,212,0.08)", border: `1px solid ${p.isActive ? "rgba(239,68,68,0.2)" : "rgba(6,182,212,0.2)"}`, borderRadius: 6, padding: "4px 10px", color: p.isActive ? "#f87171" : "var(--cyan-400)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            {p.isActive ? "Disable" : "Enable"}
          </button>,
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

interface AnalyticsData {
  period: { days: number; since: string };
  stats: {
    totalVolume: number; totalTxns: number; confirmedTxns: number;
    failedTxns: number; rejectedTxns: number; pendingTxns: number;
    failureRate: number; avgTxSize: number; todayVolume: number; todayTxns: number;
  };
  volumeByDay: { date: string; volume: number; count: number }[];
  byCategory: { category: string; volume: number; count: number }[];
  byType: {
    onChain: { count: number; volume: number };
    p2p: { count: number; volume: number };
    x402: { count: number; volume: number };
  };
  topAgents: { agentId: string; volume: number; count: number; balance: number; status: string }[];
}

const CATEGORY_COLORS = [
  "var(--gradient-brand)", "var(--cyan-400)", "var(--violet-400)",
  "#f59e0b", "#10b981", "#f87171", "#a78bfa", "#34d399",
];

function AnalyticsTab() {
  const [days, setDays] = useState(30);
  const { data, loading } = useApi<AnalyticsData>(`/api/analytics?days=${days}`, 0);

  if (loading || !data) return <Loader />;

  const { stats, volumeByDay, byCategory, byType, topAgents } = data;

  // Volume chart — show every Nth label so it doesn't overflow
  const maxVol = Math.max(...volumeByDay.map((d) => d.volume), 0.01);
  const labelStep = days <= 7 ? 1 : days <= 30 ? 5 : 10;

  // Status breakdown
  const totalForRate = stats.confirmedTxns + stats.failedTxns + stats.rejectedTxns;
  const statusRows = [
    { label: "Confirmed", count: stats.confirmedTxns, color: "var(--cyan-400)" },
    { label: "Failed", count: stats.failedTxns, color: "#f87171" },
    { label: "Rejected", count: stats.rejectedTxns, color: "#f59e0b" },
  ];

  // Type breakdown totals
  const totalTypeVol = byType.onChain.volume + byType.p2p.volume + byType.x402.volume || 1;
  const typeRows = [
    { label: "On-chain", ...byType.onChain, color: "var(--gradient-brand)" },
    { label: "P2P", ...byType.p2p, color: "var(--cyan-400)" },
    { label: "x402", ...byType.x402, color: "var(--violet-400)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Time range selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Analytics</h3>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>All data from live transactions</p>
        </div>
        <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
              background: days === d ? "rgba(139,92,246,0.2)" : "transparent",
              border: days === d ? "1px solid rgba(139,92,246,0.35)" : "1px solid transparent",
              color: days === d ? "var(--violet-300)" : "var(--text-tertiary)",
              cursor: "pointer", transition: "all 0.15s",
            }}>{d}d</button>
          ))}
        </div>
      </div>

      {/* KPI stats */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Stat label="Total Volume" value={`$${stats.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub={`${stats.confirmedTxns} confirmed`} />
        <Stat label="Today" value={`$${stats.todayVolume.toFixed(2)}`} sub={`${stats.todayTxns} txns`} />
        <Stat label="Avg Tx Size" value={`$${stats.avgTxSize.toFixed(2)}`} sub="Confirmed only" />
        <Stat label="Failure Rate" value={`${stats.failureRate.toFixed(1)}%`} sub={`${stats.failedTxns + stats.rejectedTxns} of ${stats.totalTxns}`} />
      </div>

      {/* Volume chart */}
      <GlassCard style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)" }}>Volume — Last {days} Days</div>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>
            ${stats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })} total
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: days > 30 ? 2 : days > 14 ? 4 : 6, height: 140 }}>
          {volumeByDay.map((d, i) => {
            const pct = Math.max((d.volume / maxVol) * 100, d.volume > 0 ? 3 : 1);
            const showLabel = i % labelStep === 0 || i === volumeByDay.length - 1;
            const label = new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
            return (
              <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, position: "relative" }}>
                <div
                  title={`${label}: $${d.volume.toFixed(2)} (${d.count} txns)`}
                  style={{
                    width: "100%", borderRadius: "3px 3px 0 0",
                    height: `${pct}%`,
                    background: d.volume > 0 ? "var(--gradient-brand)" : "rgba(255,255,255,0.04)",
                    transition: "height 0.5s cubic-bezier(0.16,1,0.3,1)",
                    cursor: "default",
                  }}
                />
                {showLabel && (
                  <span style={{ fontSize: 9, color: "var(--text-tertiary)", whiteSpace: "nowrap", letterSpacing: "0.02em" }}>
                    {new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Middle row — status breakdown + type breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <GlassCard style={{ padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", marginBottom: 18 }}>Success vs Failure</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {statusRows.map(({ label, count, color }) => {
              const pct = totalForRate > 0 ? Math.round((count / totalForRate) * 100) : 0;
              return (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}>{label}</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>{pct}% · {count}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.05)" }}>
                    <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: color, transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard style={{ padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", marginBottom: 18 }}>Payment Type</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {typeRows.map(({ label, volume, count, color }) => {
              const pct = Math.round((volume / totalTypeVol) * 100);
              return (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}>{label}</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>${volume.toFixed(2)} · {count}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.05)" }}>
                    <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: color, transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* Category breakdown */}
      {byCategory.length > 0 && (
        <GlassCard style={{ padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", marginBottom: 18 }}>Spending by Category</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {byCategory.map(({ category, volume, count }, i) => {
              const maxCatVol = byCategory[0].volume || 1;
              const pct = Math.round((volume / maxCatVol) * 100);
              const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
              return (
                <div key={category}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-secondary)", textTransform: "capitalize" }}>{category}</span>
                    <span style={{ color: "var(--text-tertiary)" }}>${volume.toFixed(2)} · {count} txns</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.05)" }}>
                    <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: color, transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Top agents */}
      <GlassCard style={{ padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", marginBottom: 16 }}>Top Agents by Volume</div>
        {topAgents.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "16px 0" }}>No transactions in this period</div>
        ) : (
          <DataTable
            headers={["Agent", "Volume", "Txns", "Avg Size", "Balance", "Status"]}
            rows={topAgents.map((a) => [
              <span key="id" style={{ fontWeight: 600 }}>{a.agentId}</span>,
              <MonoText key="vol">${a.volume.toFixed(2)}</MonoText>,
              <span key="cnt">{a.count}</span>,
              <MonoText key="avg">${a.count > 0 ? (a.volume / a.count).toFixed(2) : "0.00"}</MonoText>,
              <MonoText key="bal">${a.balance.toFixed(2)}</MonoText>,
              <Badge key="st" variant={statusVariant[a.status] || "default"}>{a.status}</Badge>,
            ])}
          />
        )}
      </GlassCard>
    </div>
  );
}

/* ═══ API Keys Tab ═══ */
const SCOPE_GROUPS = [
  { label: "Wallets", scopes: ["wallets:read", "wallets:write"] },
  { label: "Transactions", scopes: ["transactions:read", "transactions:write"] },
  { label: "Policies", scopes: ["policies:read", "policies:write"] },
  { label: "Webhooks", scopes: ["webhooks:read", "webhooks:write"] },
  { label: "x402 Paywalls", scopes: ["x402:read", "x402:write"] },
  { label: "Analytics", scopes: ["analytics:read"] },
  { label: "API Keys", scopes: ["keys:read", "keys:write"] },
];

function ApiKeysTab() {
  const { data: keys, loading, error, refetch } = useApi<ApiKey[]>("/api/keys");
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [fullAccess, setFullAccess] = useState(true);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(SCOPE_GROUPS.flatMap((g) => g.scopes));
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleScope(scope: string) {
    setSelectedScopes((prev) => prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]);
  }

  async function createKey() {
    if (!keyName.trim()) { setCreateErr("Name is required"); return; }
    const scopes = fullAccess ? ["*"] : selectedScopes;
    if (!fullAccess && scopes.length === 0) { setCreateErr("Select at least one scope"); return; }
    setCreating(true); setCreateErr("");
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName.trim(), scopes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setNewKey(json.data.key);
      setKeyName("");
      setFullAccess(true);
      setSelectedScopes(SCOPE_GROUPS.flatMap((g) => g.scopes));
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
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>Create a key to connect AI agents or external services to NexusPay. Pass it in every request as <span style={{ fontFamily: "var(--font-mono)", color: "var(--violet-300)" }}>X-Api-Key: nxp_…</span></p>
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

      {(keys ?? []).length === 0 && !newKey && (
        <EmptyState icon="⌗" title="No API keys yet" sub='Click "+ Create Key" to generate your first key and connect an agent or service' />
      )}

      <GlassCard style={{ padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 12 }}>How to connect</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "1. Create a key above, copy it immediately", code: null },
            { label: "2. Pass it in every API request header:", code: "X-Api-Key: nxp_your_key_here" },
            { label: "3. Or use the TypeScript SDK:", code: `new NexusPay({ baseUrl: "https://nexuspay.finance", apiKey: "nxp_…" })` },
          ].map(({ label, code }) => (
            <div key={label}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: code ? 4 : 0 }}>{label}</div>
              {code && (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, padding: "8px 12px", borderRadius: 6, background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.12)", color: "var(--violet-300)", wordBreak: "break-all" }}>
                  {code}
                </div>
              )}
            </div>
          ))}
        </div>
      </GlassCard>

      {showCreate && !newKey && (
        <Modal title="Create API Key" onClose={() => setShowCreate(false)}>
          <Field label="Key name">
            <Input value={keyName} onChange={setKeyName} placeholder="e.g. production-agent" />
          </Field>
          <Field label="Permissions">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Full access toggle */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 12px", borderRadius: 7, background: fullAccess ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${fullAccess ? "rgba(139,92,246,0.3)" : "var(--border)"}`, transition: "all 0.15s" }}>
                <input type="checkbox" checked={fullAccess} onChange={(e) => setFullAccess(e.target.checked)} style={{ accentColor: "var(--violet-400)", width: 14, height: 14 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: fullAccess ? "var(--violet-300)" : "var(--text)" }}>Full access <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>[*]</span></div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>All current and future permissions</div>
                </div>
              </label>
              {/* Granular scopes */}
              {!fullAccess && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", borderRadius: 7, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                  {SCOPE_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 5 }}>{group.label}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {group.scopes.map((scope) => (
                          <label key={scope} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "4px 10px", borderRadius: 99, background: selectedScopes.includes(scope) ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${selectedScopes.includes(scope) ? "rgba(139,92,246,0.3)" : "var(--border)"}`, transition: "all 0.15s" }}>
                            <input type="checkbox" checked={selectedScopes.includes(scope)} onChange={() => toggleScope(scope)} style={{ accentColor: "var(--violet-400)", width: 12, height: 12 }} />
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: selectedScopes.includes(scope) ? "var(--violet-300)" : "var(--text-tertiary)" }}>{scope}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

/* ═══ Webhooks Tab ═══ */
interface WebhookDelivery { id: string; event: string; success: boolean; statusCode: number | null; error: string | null; createdAt: string; }
interface WebhookItem { id: string; url: string; events: string[]; description: string | null; isActive: boolean; createdAt: string; secret?: string; _count: { deliveries: number }; deliveries: WebhookDelivery[]; }

const ALL_EVENTS = ["transaction.confirmed", "transaction.failed", "transaction.rejected", "wallet.created", "wallet.suspended"];

function WebhooksTab() {
  const { data: webhooks, loading, error, refetch } = useApi<WebhookItem[]>("/api/webhooks");
  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["transaction.confirmed", "transaction.failed", "transaction.rejected"]);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string }>>({});

  async function testWebhook(id: string) {
    setTesting(id);
    try {
      const res = await fetch(`/api/webhooks/${id}/test`, { method: "POST" });
      const json = await res.json();
      setTestResult((prev) => ({ ...prev, [id]: { success: json.data?.success ?? false, message: json.data?.message ?? "Unknown result" } }));
      setExpanded(id); // auto-expand logs so they see the result
      refetch();
    } catch {
      setTestResult((prev) => ({ ...prev, [id]: { success: false, message: "Network error" } }));
    } finally { setTesting(null); }
  }

  function toggleEvent(e: string) {
    setSelectedEvents((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);
  }

  async function createWebhook() {
    if (!url.trim()) { setCreateErr("URL is required"); return; }
    if (selectedEvents.length === 0) { setCreateErr("Select at least one event"); return; }
    setCreating(true); setCreateErr("");
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), events: selectedEvents, description: description.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create webhook");
      setNewSecret(json.data.secret);
      setUrl(""); setDescription(""); setSelectedEvents(["transaction.confirmed", "transaction.failed", "transaction.rejected"]);
      setShowCreate(false);
      refetch();
    } catch (e: unknown) {
      setCreateErr(e instanceof Error ? e.message : "Error");
    } finally { setCreating(false); }
  }

  async function toggleActive(id: string, current: boolean) {
    try {
      await fetch(`/api/webhooks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !current }) });
      refetch();
    } catch {}
  }

  async function deleteWebhook(id: string) {
    try {
      await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      refetch();
    } catch {}
  }

  function copySecret(s: string) {
    navigator.clipboard.writeText(s);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  }

  if (loading) return <Loader />;
  if (error) return <ErrorMsg message={error} />;

  const addBtn = (
    <button
      onClick={() => { setShowCreate(true); setNewSecret(null); }}
      style={{
        background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
        color: "#fff", border: "none", borderRadius: 8,
        padding: "9px 18px", fontSize: 13, fontWeight: 700,
        cursor: "pointer", whiteSpace: "nowrap",
        boxShadow: "0 0 16px rgba(139,92,246,0.35)",
        transition: "box-shadow 0.2s, transform 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 24px rgba(139,92,246,0.55)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 0 16px rgba(139,92,246,0.35)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      + Add Webhook
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Webhooks</h3>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4, maxWidth: 480 }}>
            Get notified instantly when payments happen — no polling required. NexusPay sends a secure HTTP request to your server the moment a transaction is confirmed, fails, or gets blocked.
          </p>
        </div>
        {(webhooks ?? []).length > 0 && addBtn}
      </div>

      {/* Secret reveal banner */}
      {newSecret && (
        <GlassCard style={{ padding: 20, border: "1px solid rgba(6,182,212,0.3)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cyan-400)", marginBottom: 4, letterSpacing: "0.06em" }}>WEBHOOK SECRET — COPY NOW, WON&apos;T BE SHOWN AGAIN</div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>Use this to verify that incoming requests are genuinely from NexusPay.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", wordBreak: "break-all", flex: 1 }}>{newSecret}</span>
            <button onClick={() => copySecret(newSecret)} style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 6, padding: "6px 12px", color: "var(--cyan-400)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              {secretCopied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.12)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.06em", marginBottom: 6 }}>VERIFY IN YOUR SERVER</div>
            <pre style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--violet-200)", margin: 0, overflowX: "auto", lineHeight: 1.7 }}>{`const sig = crypto.createHmac("sha256", secret)
  .update(rawBody).digest("hex");
const expected = \`sha256=\${sig}\`;
if (expected !== req.headers["x-nexuspay-signature"]) {
  return res.status(401).send("Invalid signature");
}`}</pre>
          </div>
        </GlassCard>
      )}

      {/* Empty / onboarding state */}
      {(webhooks ?? []).length === 0 && !newSecret ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Main CTA card */}
          <GlassCard style={{ padding: 36, textAlign: "center", border: "1px solid rgba(139,92,246,0.15)" }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>⇡</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>
              Get notified when payments happen
            </div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 420, margin: "0 auto 24px" }}>
              Connect any URL and NexusPay will instantly notify it when a transaction is confirmed, fails, or gets blocked. Works with your own server, Slack, Zapier, or any automation tool.
            </p>
            {addBtn}
          </GlassCard>

          {/* Use case examples */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { icon: "💬", title: "Slack alerts", desc: "Post a message to your team channel every time an agent spends money or a payment fails." },
              { icon: "🔁", title: "Trigger workflows", desc: "Kick off a Zapier or Make automation when a transaction is confirmed or rejected." },
              { icon: "🗃️", title: "Sync your database", desc: "Write every transaction to your own records in real time without polling the API." },
            ].map(({ icon, title, desc }) => (
              <GlassCard key={title} style={{ padding: 20 }}>
                <div style={{ fontSize: 22, marginBottom: 10 }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6 }}>{desc}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {(webhooks ?? []).map((wh) => (
            <GlassCard key={wh.id} style={{ padding: 0, overflow: "hidden" }}>
              {/* Header row */}
              <div style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--text)", wordBreak: "break-all" }}>{wh.url}</span>
                    <Badge variant={wh.isActive ? "success" : "default"}>{wh.isActive ? "ACTIVE" : "PAUSED"}</Badge>
                  </div>
                  {wh.description && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>{wh.description}</div>}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {wh.events.map((ev) => (
                      <span key={ev} style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "var(--violet-300)" }}>{ev}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={() => setExpanded(expanded === wh.id ? null : wh.id)} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-tertiary)", cursor: "pointer" }}>
                    {expanded === wh.id ? "Hide" : `Logs (${wh._count.deliveries})`}
                  </button>
                  <button
                    onClick={() => testWebhook(wh.id)}
                    disabled={testing === wh.id}
                    style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)", color: "var(--violet-300)", cursor: testing === wh.id ? "not-allowed" : "pointer", opacity: testing === wh.id ? 0.6 : 1 }}
                  >{testing === wh.id ? "Sending…" : "Send Test"}</button>
                  {testResult[wh.id] && (
                    <span style={{ fontSize: 11, color: testResult[wh.id].success ? "var(--cyan-400)" : "#f87171", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {testResult[wh.id].success ? "✓ Delivered" : "✗ Failed"}
                    </span>
                  )}
                  <button onClick={() => toggleActive(wh.id, wh.isActive)} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: wh.isActive ? "rgba(234,179,8,0.08)" : "rgba(6,182,212,0.08)", border: `1px solid ${wh.isActive ? "rgba(234,179,8,0.2)" : "rgba(6,182,212,0.2)"}`, color: wh.isActive ? "#fde047" : "var(--cyan-400)", cursor: "pointer" }}>
                    {wh.isActive ? "Pause" : "Enable"}
                  </button>
                  <button onClick={() => deleteWebhook(wh.id)} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", cursor: "pointer" }}>Delete</button>
                </div>
              </div>

              {/* Delivery logs */}
              {expanded === wh.id && (
                <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "12px 20px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 10 }}>Recent Deliveries</div>
                  {wh.deliveries.length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "12px 0" }}>No deliveries yet</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {wh.deliveries.map((d) => (
                        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}>
                          <span style={{ fontSize: 14 }}>{d.success ? "✓" : "✗"}</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: d.success ? "var(--cyan-400)" : "#f87171", flex: 1 }}>{d.event}</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>{d.statusCode ?? "—"}</span>
                          {d.error && <span style={{ fontSize: 11, color: "#f87171", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.error}</span>}
                          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{timeAgo(d.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal title="Add Webhook" onClose={() => { setShowCreate(false); setCreateErr(""); }}>
          <Field label="Endpoint URL">
            <Input value={url} onChange={setUrl} placeholder="https://your-server.com/webhooks/nexuspay" />
          </Field>
          <Field label="Description (optional)">
            <Input value={description} onChange={setDescription} placeholder="e.g. Notify Slack on payment" />
          </Field>
          <Field label="Events">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ALL_EVENTS.map((ev) => (
                <label key={ev} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 12px", borderRadius: 6, background: selectedEvents.includes(ev) ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${selectedEvents.includes(ev) ? "rgba(139,92,246,0.25)" : "var(--border)"}`, transition: "all 0.15s" }}>
                  <input type="checkbox" checked={selectedEvents.includes(ev)} onChange={() => toggleEvent(ev)} style={{ accentColor: "var(--violet-400)", width: 14, height: 14 }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: selectedEvents.includes(ev) ? "var(--violet-300)" : "var(--text-secondary)" }}>{ev}</span>
                </label>
              ))}
            </div>
          </Field>
          {createErr && <div style={{ fontSize: 13, color: "#f87171", marginBottom: 4 }}>{createErr}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Btn>
            <Btn onClick={createWebhook} disabled={creating}>{creating ? "Creating…" : "Create Webhook"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══ Treasury Tab ═══ */
function TreasuryTab() {
  const { data: treasury, loading, error } = useApi<Treasury>("/api/treasury", 30_000);
  const { data: wallets } = useApi<Wallet[]>("/api/wallets");

  if (loading) return <Loader />;
  if (error) return <ErrorMsg message={error} />;
  if (!treasury) return <EmptyState icon="◬" title="No treasury found" sub="Run the seed script to initialise the treasury" />;

  const totalWalletBalance = (wallets ?? []).reduce((s, w) => s + w.balanceUsdc, 0);
  const available = treasury.balanceUsdc;
  const utilizationPct = treasury.totalFunded > 0 ? ((treasury.totalDisbursed / treasury.totalFunded) * 100).toFixed(1) : "0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Stat label="Available Balance" value={`$${available.toFixed(2)}`} sub="Ready to fund new wallets" />
        <Stat label="Total Funded" value={`$${treasury.totalFunded.toLocaleString()}`} sub="All time disbursements" />
        <Stat label="Total Disbursed" value={`$${treasury.totalDisbursed.toFixed(2)}`} sub={`${utilizationPct}% utilization`} />
        <Stat label="In Agent Wallets" value={`$${totalWalletBalance.toFixed(2)}`} sub={`${wallets?.length ?? 0} wallets`} />
      </div>

      <GlassCard style={{ padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", marginBottom: 16 }}>Treasury Health</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: "var(--text-secondary)" }}>Funds disbursed</span>
              <span style={{ fontWeight: 600 }}>{utilizationPct}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
              <div style={{ height: 6, borderRadius: 3, background: "var(--gradient-brand)", width: `${Math.min(parseFloat(utilizationPct), 100)}%`, transition: "width 0.6s ease" }} />
            </div>
          </div>
          {[
            ["Treasury ID", treasury.id],
            ["Last Updated", new Date(treasury.updatedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })],
            ["Network", process.env.NEXT_PUBLIC_NETWORK ?? "base-sepolia"],
          ].map(([k, v]) => (
            <div key={String(k)} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-tertiary)" }}>{k}</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{v}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard style={{ padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", marginBottom: 16 }}>Agent Wallet Balances</div>
        {(wallets ?? []).length === 0
          ? <EmptyState icon="◈" title="No wallets" sub="Create a wallet to see balances here" />
          : <DataTable
              headers={["Agent", "Balance", "Status"]}
              rows={(wallets ?? []).map((w) => [
                <span key="a" style={{ fontWeight: 600 }}>{w.agentId}</span>,
                <span key="b" style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>${w.balanceUsdc.toFixed(2)}</span>,
                <Badge key="s" variant={statusVariant[w.status] || "default"}>{w.status}</Badge>,
              ])}
            />
        }
      </GlassCard>
    </div>
  );
}

function isMainnet(network: string) {
  return network === "base" || network === "base-mainnet";
}
function basescanTx(hash: string, network: string) {
  return isMainnet(network) ? `https://basescan.org/tx/${hash}` : `https://sepolia.basescan.org/tx/${hash}`;
}
function basescanAddr(addr: string, network: string) {
  return isMainnet(network) ? `https://basescan.org/address/${addr}` : `https://sepolia.basescan.org/address/${addr}`;
}

/* ═══ Transaction Detail Modal ═══ */
function TxDetailModal({ tx, network, onClose }: { tx: Tx; network: string; onClose: () => void }) {
  const basescanUrl = tx.txHash ? basescanTx(tx.txHash, network) : null;

  return (
    <Modal title="Transaction Details" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {[
          ["ID", tx.id],
          ["From Agent", tx.fromAgentId],
          ["To", tx.toAgentId || tx.toAddress],
          ["Amount", `$${tx.amountUsdc < 0.01 ? tx.amountUsdc.toFixed(6) : tx.amountUsdc.toFixed(2)} USDC`],
          ["Status", tx.status],
          ["Type", tx.isP2P ? "P2P Transfer" : tx.category === "x402" ? "x402 Payment" : "On-Chain"],
          ["Category", tx.category || "—"],
          ["Memo", tx.memo || "—"],
          ["Created", new Date(tx.createdAt).toLocaleString("en-GB")],
        ].map(([k, v]) => (
          <div key={String(k)} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 13, gap: 16 }}>
            <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>{k}</span>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)", textAlign: "right", wordBreak: "break-all" }}>{v}</span>
          </div>
        ))}
        {tx.txHash && (
          <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 13 }}>
            <div style={{ color: "var(--text-tertiary)", marginBottom: 4 }}>Tx Hash</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, wordBreak: "break-all", color: "var(--text)" }}>{tx.txHash}</div>
          </div>
        )}
        {tx.failureReason && (
          <div style={{ padding: "10px 0", fontSize: 13 }}>
            <div style={{ color: "#f87171", fontWeight: 600, marginBottom: 4 }}>Failure Reason</div>
            <div style={{ color: "#fca5a5", fontSize: 12 }}>{tx.failureReason}</div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        {basescanUrl && (
          <a href={basescanUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: "block", textAlign: "center", padding: "10px", borderRadius: 8, background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--cyan-400)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            View on Basescan ↗
          </a>
        )}
        <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 8, background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Close</button>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", marginTop: 4 }}>Network: {network === "base" ? "Base Mainnet" : "Base Sepolia"}</div>
    </Modal>
  );
}

/* ═══ MPP Tab ═══ */
interface MppEndpoint {
  id: string; path: string; priceUsdc: number; description: string | null;
  intent: string; isActive: boolean; totalPaid: number; hitCount: number; createdAt: string;
  _count: { payments: number };
}

function MppTab() {
  const { data: endpoints, loading, error, refetch } = useApi<MppEndpoint[]>("/api/mpp");
  const { data: wallets } = useApi<Wallet[]>("/api/wallets");
  const [showCreate, setShowCreate] = useState(false);
  const [path, setPath] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [intent, setIntent] = useState<"charge" | "session">("charge");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  // MPP Pay tester
  const [showTest, setShowTest] = useState(false);
  const [testAgent, setTestAgent] = useState("");
  const [testUrl, setTestUrl] = useState("");
  const [testMax, setTestMax] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; amountPaid: number; status: number; body: string; transactionId?: string } | null>(null);

  const selectStyle = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-hover)", borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 14, outline: "none", boxSizing: "border-box" as const };

  async function createEndpoint() {
    if (!path.trim().startsWith("/")) { setCreateErr("Path must start with /"); return; }
    if (!price || parseFloat(price) <= 0) { setCreateErr("Price must be greater than 0"); return; }
    setCreating(true); setCreateErr("");
    try {
      const res = await fetch("/api/mpp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path.trim(), priceUsdc: parseFloat(price), description: description.trim() || undefined, intent }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setShowCreate(false); setPath(""); setPrice(""); setDescription(""); setIntent("charge");
      refetch();
    } catch (e: unknown) { setCreateErr(e instanceof Error ? e.message : "Error"); }
    finally { setCreating(false); }
  }

  async function toggleEndpoint(id: string, current: boolean) {
    await fetch(`/api/mpp/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !current }) });
    refetch();
  }

  async function deleteEndpoint(id: string) {
    await fetch(`/api/mpp/${id}`, { method: "DELETE" });
    refetch();
  }

  async function runTest() {
    if (!testAgent || !testUrl) return;
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch("/api/mpp/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: testAgent, url: testUrl, maxAmount: testMax ? parseFloat(testMax) : undefined }),
      });
      const json = await res.json();
      if (json.success) setTestResult(json.data);
      else setTestResult({ success: false, amountPaid: 0, status: 0, body: json.error || "Failed" });
    } catch { setTestResult({ success: false, amountPaid: 0, status: 0, body: "Network error" }); }
    finally { setTesting(false); }
  }

  if (loading) return <Loader />;
  if (error) return <ErrorMsg message={error} />;

  const totalRevenue = (endpoints ?? []).reduce((s, e) => s + e.totalPaid, 0);
  const totalHits = (endpoints ?? []).reduce((s, e) => s + e.hitCount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Machine Payments Protocol</h3>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4, maxWidth: 520 }}>
            Register MPP-protected endpoints using the open standard HTTP 402 flow. Agents pay with <span style={{ fontFamily: "var(--font-mono)", color: "var(--violet-300)" }}>WWW-Authenticate: Payment</span> challenges and receive <span style={{ fontFamily: "var(--font-mono)", color: "var(--cyan-400)" }}>Payment-Receipt</span> headers on success.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowTest(true)} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--cyan-400)", cursor: "pointer" }}>
            ⚡ Test MPP Pay
          </button>
          <button onClick={() => setShowCreate(true)} style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 0 16px rgba(139,92,246,0.35)" }}>
            + Register Endpoint
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Stat label="Registered Endpoints" value={`${(endpoints ?? []).length}`} sub={`${(endpoints ?? []).filter(e => e.isActive).length} active`} />
        <Stat label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} sub="USDC collected" />
        <Stat label="Total Hits" value={`${totalHits}`} sub="Paid requests" />
        <Stat label="Avg Price" value={(endpoints ?? []).length > 0 ? `$${((endpoints ?? []).reduce((s, e) => s + e.priceUsdc, 0) / (endpoints ?? []).length).toFixed(4)}` : "$0"} sub="Per request" />
      </div>

      {/* Protocol info strip */}
      <GlassCard style={{ padding: "14px 20px", background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
          {[
            { label: "Standard", value: "IETF draft-ryan-httpauth-payment" },
            { label: "Challenge header", value: "WWW-Authenticate: Payment" },
            { label: "Auth header", value: "Authorization: Payment" },
            { label: "Receipt header", value: "Payment-Receipt" },
            { label: "Payment rail", value: "NexusPay USDC" },
            { label: "Error format", value: "RFC 9457 Problem Details" },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 2 }}>{label}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--violet-300)" }}>{value}</div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Two-flow explainer */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Flow A: NexusPay-hosted */}
        <GlassCard style={{ padding: 18, background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.15)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--violet-300)", marginBottom: 10 }}>⬡ Hosted Endpoints</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.6 }}>
            Register a path here — it's immediately accessible at the gateway URL. NexusPay issues and verifies all challenges.
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, padding: "8px 12px", borderRadius: 6, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)", color: "var(--violet-300)", wordBreak: "break-all" }}>
            {typeof window !== "undefined" ? window.location.origin : "https://nexuspay.finance"}/api/mpp/gateway<span style={{ opacity: 0.7 }}>/your-path</span>
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              "Agent hits gateway → 402 + challenge",
              "Agent pays via nexuspay_mpp_pay tool",
              "Gateway verifies → 200 + receipt",
            ].map((step, i) => (
              <div key={i} style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", gap: 8 }}>
                <span style={{ color: "var(--violet-400)", fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0 }}>{i + 1}.</span>
                {step}
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Flow B: External adapter */}
        <GlassCard style={{ padding: 18, background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.15)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--cyan-400)", marginBottom: 10 }}>⬡ External Apps</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.6 }}>
            Any Next.js app can add a paywall in one line using <code style={{ fontFamily: "var(--font-mono)", color: "var(--cyan-400)", fontSize: 11 }}>nexuspay-mpp-adapter</code>. NexusPay acts as the payment proxy.
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, padding: "8px 12px", borderRadius: 6, background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)", color: "var(--cyan-400)" }}>
            {"export const GET = withMpp(handler, { price: 0.10 })"}
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              "Agent hits external app → 402 + challenge",
              "Agent pays via nexuspay_mpp_pay (proxy handles it)",
              "Adapter verifies via NexusPay txn API → 200",
            ].map((step, i) => (
              <div key={i} style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", gap: 8 }}>
                <span style={{ color: "var(--cyan-400)", fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0 }}>{i + 1}.</span>
                {step}
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Endpoints list */}
      {(endpoints ?? []).length === 0 ? (
        <GlassCard style={{ padding: 40, textAlign: "center", border: "1px solid rgba(139,92,246,0.12)" }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>⬡</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>No MPP endpoints yet</div>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 400, margin: "0 auto 24px" }}>
            Register a path and price. Any agent with a NexusPay wallet can pay to access it — no API keys, no OAuth, just a signed payment credential.
          </p>
          <button onClick={() => setShowCreate(true)} style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + Register First Endpoint
          </button>
        </GlassCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(endpoints ?? []).map((ep) => (
            <GlassCard key={ep.id} style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{ep.path}</span>
                    <Badge variant={ep.isActive ? "success" : "default"}>{ep.isActive ? "ACTIVE" : "PAUSED"}</Badge>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "var(--violet-300)" }}>{ep.intent}</span>
                  </div>
                  {ep.description && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>{ep.description}</div>}
                  <div style={{ display: "flex", gap: 20, fontSize: 12, color: "var(--text-tertiary)" }}>
                    <span style={{ fontWeight: 700, color: "var(--cyan-400)", fontFamily: "var(--font-mono)" }}>${ep.priceUsdc.toFixed(4)} USDC</span>
                    <span>{ep.hitCount} requests</span>
                    <span>${ep.totalPaid.toFixed(4)} collected</span>
                    <span>{ep._count.payments} payments</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => toggleEndpoint(ep.id, ep.isActive)} style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 6, background: ep.isActive ? "rgba(234,179,8,0.08)" : "rgba(6,182,212,0.08)", border: `1px solid ${ep.isActive ? "rgba(234,179,8,0.2)" : "rgba(6,182,212,0.2)"}`, color: ep.isActive ? "#fde047" : "var(--cyan-400)", cursor: "pointer" }}>
                    {ep.isActive ? "Pause" : "Enable"}
                  </button>
                  <button onClick={() => deleteEndpoint(ep.id)} style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", cursor: "pointer" }}>Delete</button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Register modal */}
      {showCreate && (
        <Modal title="Register MPP Endpoint" onClose={() => { setShowCreate(false); setCreateErr(""); }}>
          <Field label="Endpoint Path">
            <Input value={path} onChange={setPath} placeholder="/api/premium/data" />
          </Field>
          <Field label="Price (USDC per request)">
            <Input value={price} onChange={setPrice} placeholder="0.001" type="number" />
          </Field>
          <Field label="Description (optional)">
            <Input value={description} onChange={setDescription} placeholder="e.g. Premium market data endpoint" />
          </Field>
          <Field label="Intent">
            <select value={intent} onChange={(e) => setIntent(e.target.value as "charge" | "session")} style={selectStyle}>
              <option value="charge">charge — one-time per request</option>
              <option value="session">session — streaming / high frequency</option>
            </select>
          </Field>
          {createErr && <div style={{ color: "#f87171", fontSize: 13 }}>{createErr}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Btn>
            <Btn onClick={createEndpoint} disabled={creating}>{creating ? "Registering…" : "Register"}</Btn>
          </div>
        </Modal>
      )}

      {/* MPP Pay tester modal */}
      {showTest && (
        <Modal title="Test MPP Pay" onClose={() => { setShowTest(false); setTestResult(null); }}>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 16, lineHeight: 1.6 }}>
            Send an agent to fetch any MPP-protected URL. NexusPay handles the full 402 → pay → retry cycle automatically.
          </div>
          <Field label="Agent Wallet">
            <select value={testAgent} onChange={(e) => setTestAgent(e.target.value)} style={selectStyle}>
              <option value="">Select agent…</option>
              {(wallets ?? []).filter(w => w.status === "ACTIVE").map(w => (
                <option key={w.agentId} value={w.agentId}>{w.agentId} (${w.balanceUsdc.toFixed(2)})</option>
              ))}
            </select>
          </Field>
          <Field label="Target URL">
            <Input value={testUrl} onChange={setTestUrl} placeholder="https://example.com/api/paid-resource" />
          </Field>
          <Field label="Max Amount Cap (USDC, optional)">
            <Input value={testMax} onChange={setTestMax} placeholder="e.g. 0.10" type="number" />
          </Field>
          {testResult && (
            <div style={{ padding: 14, borderRadius: 8, background: testResult.success ? "rgba(6,182,212,0.06)" : "rgba(248,113,113,0.06)", border: `1px solid ${testResult.success ? "rgba(6,182,212,0.2)" : "rgba(248,113,113,0.2)"}`, marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: testResult.success ? "var(--cyan-400)" : "#f87171", marginBottom: 6 }}>
                {testResult.success ? `✓ Success — $${testResult.amountPaid.toFixed(4)} USDC paid` : "✗ Failed"}
              </div>
              {testResult.transactionId && <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>tx: {testResult.transactionId}</div>}
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", wordBreak: "break-all", maxHeight: 80, overflowY: "auto" }}>{typeof testResult.body === "string" ? testResult.body : JSON.stringify(testResult.body)}</div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowTest(false)}>Close</Btn>
            <Btn onClick={runTest} disabled={testing || !testAgent || !testUrl}>{testing ? "Paying…" : "Send Request"}</Btn>
          </div>
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
    p2p: <P2PTab />, policies: <PoliciesTab />, x402: <X402Tab />, mpp: <MppTab />,
    analytics: <AnalyticsTab />, keys: <ApiKeysTab />, webhooks: <WebhooksTab />,
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
        <Link href="/docs" style={{ margin: "0 14px 6px", padding: "9px 14px", borderRadius: "var(--radius-sm)", display: "block", background: "transparent", border: "1px solid var(--border)", fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", fontWeight: 600, transition: "all 0.2s", textDecoration: "none" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.borderColor = "var(--border-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.borderColor = "var(--border)"; }}
        >API Docs →</Link>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 230, flex: 1, padding: 32, position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {tabList.find((t) => t.key === tab)?.label}
          </h1>
          <WalletStatus />
        </div>
        {content[tab]}
      </main>
    </div>
  );
}

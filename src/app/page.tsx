"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  NexusLogo, AmbientGlow, ConstellationNetwork,
  GlassCard, Section, GradientText, Badge, useScrollReveal,
} from "@/components/shared";

/* ═══════════════════════════════════════════════════════
   SIWE helpers
   ═══════════════════════════════════════════════════════ */
function buildSiweMessage(address: string, nonce: string, domain: string, uri: string) {
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address, "",
    "Sign in to NexusPay Dashboard", "",
    `URI: ${uri}`, "Version: 1", "Chain ID: 8453",
    `Nonce: ${nonce}`, `Issued At: ${new Date().toISOString()}`,
  ].join("\n");
}

async function runSiwe(): Promise<string | null> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error("No wallet detected. Install MetaMask or Coinbase Wallet.");
  const [account] = await ethereum.request({ method: "eth_requestAccounts" });
  const { nonce } = await (await fetch("/api/auth/nonce")).json();
  const message = buildSiweMessage(account, nonce, window.location.host, window.location.origin);
  const signature = await ethereum.request({ method: "personal_sign", params: [message, account] });
  const res = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: account, message, signature }),
  });
  // 501 = open mode (no JWT_SECRET) — no session cookie needed, proceed anyway
  if (res.ok || res.status === 501) return account as string;
  const { error } = await res.json().catch(() => ({ error: "Verification failed" }));
  throw new Error(error ?? "Verification failed");
}

/* ═══════════════════════════════════════════════════════
   Connect Wallet Button (nav)
   ═══════════════════════════════════════════════════════ */
function ConnectWalletBtn() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  // Check for existing session on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.address) setAddress(d.address); })
      .catch(() => {});
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    setErrMsg("");
    try {
      const addr = await runSiwe();
      if (addr) {
        setAddress(addr);
        router.push("/dashboard");
      }
    } catch (e: any) {
      // code 4001 = user rejected — silent
      if (e?.code !== 4001) setErrMsg(e?.message ?? "Connection failed");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const hoverOn = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px var(--glow-violet)"; };
  const hoverOff = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; };

  const baseBtnStyle = {
    padding: "9px 22px", borderRadius: 99,
    background: "var(--gradient-brand)",
    color: "white", fontSize: 13, fontWeight: 600,
    display: "flex", alignItems: "center", gap: 8,
    transition: "transform 0.25s, box-shadow 0.25s",
    border: "none", cursor: "pointer", textDecoration: "none",
  } as const;

  // Already connected — show address pill
  if (address) {
    return (
      <Link href="/dashboard" style={baseBtnStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--cyan-400)", flexShrink: 0 }} />
        {address.slice(0, 6)}…{address.slice(-4)}
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <button onClick={connect} disabled={loading} style={{
        ...baseBtnStyle,
        background: loading ? "rgba(139,92,246,0.35)" : "var(--gradient-brand)",
        cursor: loading ? "wait" : "pointer",
        opacity: loading ? 0.8 : 1,
      }}
      onMouseEnter={(e) => { if (!loading) hoverOn(e); }}
      onMouseLeave={hoverOff}
      >
        {loading && <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0 }} />}
        {loading ? "Check wallet…" : "Connect Wallet"}
      </button>
      {errMsg && (
        <div style={{ fontSize: 11, color: "#f87171", maxWidth: 220, textAlign: "right", lineHeight: 1.4 }}>{errMsg}</div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Animated counter — counts up on scroll
   ═══════════════════════════════════════════════════════ */
function Counter({ end, suffix = "", prefix = "", decimals = 0 }: {
  end: number; suffix?: string; prefix?: string; decimals?: number;
}) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        let start = 0;
        const duration = 2200;
        const step = (ts: number) => {
          if (!start) start = ts;
          const p = Math.min((ts - start) / duration, 1);
          const ease = 1 - Math.pow(1 - p, 4);
          setVal(Number((ease * end).toFixed(decimals)));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [end, decimals]);

  return <span ref={ref}>{prefix}{val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

/* ═══════════════════════════════════════════════════════
   Code demo — tabbed with typewriter
   ═══════════════════════════════════════════════════════ */
const codeExamples: Record<string, { lang: string; code: string }> = {
  "Create Wallet": {
    lang: "typescript",
    code: `const wallet = await nexus.wallets.create({
  agentId: "agent-alpha",
  initialFunding: 50.00
});

console.log(wallet.address);
// → 0x7a3f...8b2c
console.log(wallet.balanceUsdc);
// → 50.00`,
  },
  "Send Payment": {
    lang: "typescript",
    code: `const tx = await nexus.transactions.send({
  fromAgentId: "agent-alpha",
  toAddress: "0x9b2e...4d1a",
  amountUsdc: 12.50,
  category: "compute"
});

// Policy-checked, on-chain settled
console.log(tx.status);  // → "CONFIRMED"
console.log(tx.txHash);  // → "0x8f2a..."`,
  },
  "P2P Transfer": {
    lang: "typescript",
    code: `const p2p = await nexus.p2p.transfer({
  fromAgentId: "agent-alpha",
  toAgentId: "agent-beta",
  amountUsdc: 5.00,
  memo: "Tool access fee"
});

// Instant, zero gas
console.log(p2p.isP2P);   // → true
console.log(p2p.status);  // → "CONFIRMED"`,
  },
  "x402 Paywall": {
    lang: "typescript",
    code: `// Register a pay-per-request endpoint
await nexus.x402.register({
  path: "/api/premium/inference",
  priceUsdc: 0.001,
  description: "ML inference endpoint"
});

// Agents auto-pay on 402 response
// Sub-cent micropayments on Base`,
  },
};

function CodeDemo() {
  const tabs = Object.keys(codeExamples);
  const [active, setActive] = useState(tabs[0]);
  const [displayed, setDisplayed] = useState("");
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    const code = codeExamples[active].code;
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      if (i < code.length) { setDisplayed(code.slice(0, i + 1)); i++; }
      else clearInterval(id);
    }, 14);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    const id = setInterval(() => setCursor((c) => !c), 500);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--border)",
      background: "rgba(9,9,15,0.9)",
      overflow: "hidden",
      backdropFilter: "blur(20px)",
    }}>
      {/* Tab bar */}
      <div style={{
        display: "flex", borderBottom: "1px solid var(--border-subtle)",
        background: "rgba(15,15,24,0.6)",
      }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            style={{
              padding: "14px 20px", fontSize: 13, fontWeight: 500,
              color: active === tab ? "var(--violet-300)" : "var(--text-tertiary)",
              borderBottom: active === tab ? "2px solid var(--violet-500)" : "2px solid transparent",
              transition: "all 0.25s ease",
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      {/* Code */}
      <div style={{ position: "relative" }}>
        {/* Line numbers */}
        <pre style={{
          padding: "24px 0 24px 20px",
          fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.8,
          color: "var(--text-tertiary)", opacity: 0.4,
          position: "absolute", top: 0, left: 0,
          userSelect: "none",
        }}>
          {displayed.split("\n").map((_, i) => (
            <div key={i}>{String(i + 1).padStart(2, " ")}</div>
          ))}
        </pre>
        <pre style={{
          padding: "24px 24px 24px 56px",
          fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.8,
          color: "var(--violet-200)", minHeight: 260, margin: 0,
          overflowX: "auto",
        }}>
          {displayed}
          <span style={{ opacity: cursor ? 0.8 : 0, color: "var(--cyan-400)", transition: "opacity 0.1s" }}>▊</span>
        </pre>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SDK Demo — tabbed code examples
   ═══════════════════════════════════════════════════════ */
const sdkExamples: Record<string, string> = {
  "Initialize": `import NexusPay from "nexuspay-sdk";

const nexus = new NexusPay({
  baseUrl: "https://your-nexuspay.vercel.app",
  apiKey: process.env.NEXUSPAY_API_KEY,
});`,

  "Create Wallet": `const wallet = await nexus.wallets.create({
  agentId: "agent-gpt4",
  name: "GPT-4 Research Agent",
  initialFunding: 50.00,
});

console.log(wallet.address);
// → 0x7a3f...8b2c
console.log(wallet.balanceUsdc);
// → 50.00`,

  "Send USDC": `const tx = await nexus.transactions.send({
  fromAgentId: "agent-gpt4",
  toAddress: "0x9b2e...4d1a",
  amountUsdc: 12.50,
  category: "compute",
  memo: "GPU inference payment",
});

// Policy-checked, on-chain settled
console.log(tx.status);   // → "CONFIRMED"
console.log(tx.txHash);   // → "0x8f2a..."`,

  "P2P Transfer": `// Instant agent-to-agent transfer
// No gas, atomic balance swap
const result = await nexus.p2p.transfer({
  fromAgentId: "agent-gpt4",
  toAgentId:   "agent-claude",
  amountUsdc:  5.00,
  memo:        "Tool access fee",
});

console.log(result.isP2P);  // → true
console.log(result.status); // → "CONFIRMED"`,

  "Set Policy": `const policy = await nexus.policies.create({
  agentId: "agent-gpt4",
  tier: "MODERATE",
  maxPerTransaction: 25.00,
  dailyLimit: 200.00,
  monthlyLimit: 2000.00,
  requireApproval: false,
  allowedCategories: ["compute", "storage"],
});`,
};

function SdkDemo() {
  const tabs = Object.keys(sdkExamples);
  const [active, setActive] = useState(tabs[0]);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(sdkExamples[active]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--border)",
      background: "rgba(9,9,15,0.9)",
      overflow: "hidden",
      backdropFilter: "blur(20px)",
    }}>
      {/* Tab bar */}
      <div style={{
        display: "flex", borderBottom: "1px solid var(--border-subtle)",
        background: "rgba(15,15,24,0.6)",
        overflowX: "auto",
      }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            style={{
              padding: "13px 18px", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap",
              color: active === tab ? "var(--violet-300)" : "var(--text-tertiary)",
              borderBottom: active === tab ? "2px solid var(--violet-500)" : "2px solid transparent",
              transition: "all 0.25s ease",
            }}
          >{tab}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={copy}
          style={{
            padding: "13px 18px", fontSize: 12, fontWeight: 500,
            color: copied ? "var(--cyan-400)" : "var(--text-tertiary)",
            transition: "color 0.2s",
          }}
        >{copied ? "Copied!" : "Copy"}</button>
      </div>
      {/* Code */}
      <pre style={{
        padding: "24px 28px",
        fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.8,
        color: "var(--violet-200)", minHeight: 200, margin: 0,
        overflowX: "auto",
      }}>
        {sdkExamples[active]}
      </pre>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   FAQ Accordion
   ═══════════════════════════════════════════════════════ */
function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  const items = [
    { q: "What chains does NexusPay support?", a: "NexusPay settles on Base (Coinbase L2) using USDC. Base offers sub-second finality and gas costs under $0.001 per transaction, making it ideal for agent micropayments." },
    { q: "How do spending policies work?", a: "Each agent wallet can have multiple policies defining per-transaction limits, daily caps, allowed recipient lists, blocked merchant categories, and approval gates. Every transaction is validated against active policies before settlement." },
    { q: "What is the x402 protocol?", a: "x402 implements HTTP 402 Payment Required for machine-to-machine payments. Register an API endpoint with a USDC price — when agents hit it without payment, they receive a 402 response, pay via NexusPay, and gain access. Sub-cent micropayments make this viable for every API call." },
    { q: "Are agent wallets custodial?", a: "Agent wallets are created via the Coinbase CDP SDK, which provides institutional-grade key management. The CDP handles signing and key storage — your agents never touch private keys directly." },
    { q: "How do P2P transfers work?", a: "Agent-to-agent transfers are instant balance swaps within NexusPay — no gas, no on-chain settlement needed. Both balances update atomically in a single database transaction, with full audit trail." },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            borderRadius: "var(--radius-md)",
            border: "1px solid",
            borderColor: open === i ? "var(--border-hover)" : "var(--border)",
            background: open === i ? "rgba(139,92,246,0.03)" : "transparent",
            overflow: "hidden",
            transition: "all 0.3s ease",
          }}
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{
              width: "100%", textAlign: "left",
              padding: "18px 24px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              color: open === i ? "var(--text)" : "var(--text-secondary)",
              fontSize: 15, fontWeight: 500,
              transition: "color 0.2s",
            }}
          >
            {item.q}
            <span style={{
              fontSize: 18, transition: "transform 0.3s ease",
              transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
              color: "var(--violet-400)", flexShrink: 0, marginLeft: 16,
            }}>+</span>
          </button>
          <div style={{
            maxHeight: open === i ? 200 : 0,
            opacity: open === i ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease",
          }}>
            <p style={{
              padding: "0 24px 20px",
              fontSize: 14, lineHeight: 1.7,
              color: "var(--text-secondary)",
            }}>{item.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Feature data
   ═══════════════════════════════════════════════════════ */
const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#feat-g)" strokeWidth="1.5" strokeLinecap="round">
        <defs><linearGradient id="feat-g" x1="0" y1="0" x2="24" y2="24"><stop stopColor="#8b5cf6"/><stop offset="1" stopColor="#06b6d4"/></linearGradient></defs>
        <rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 12h6M12 9v6"/>
      </svg>
    ),
    title: "Agent Wallets",
    desc: "CDP-backed USDC wallets created in one API call. Funded from treasury, non-custodial key management via Coinbase.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#feat-g)" strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: "Spending Policies",
    desc: "Per-tx limits, daily caps, merchant blocklists, category allowlists, and multi-sig approval gates — enforced before every settlement.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#feat-g)" strokeWidth="1.5" strokeLinecap="round">
        <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
      </svg>
    ),
    title: "P2P Transfers",
    desc: "Agent-to-agent instant payments. Zero gas, atomic balance swaps, full audit trail. Agents pay each other for tool access and services.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#feat-g)" strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
    ),
    title: "x402 Protocol",
    desc: "HTTP 402 pay-per-request. Register endpoints with USDC prices — agents auto-pay on 402. Sub-cent micropayments on Base.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#feat-g)" strokeWidth="1.5" strokeLinecap="round">
        <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/>
      </svg>
    ),
    title: "DID Credentials",
    desc: "Issue verifiable credentials with JWT-signed DIDs. Merchants authenticate agents cryptographically before accepting payment.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#feat-g)" strokeWidth="1.5" strokeLinecap="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 00-8 0v2"/><circle cx="12" cy="15" r="1"/>
      </svg>
    ),
    title: "MCP Monetization",
    desc: "Gate MCP tool calls behind NexusPay. Providers earn per-invocation; agents pay from managed wallets with policy enforcement.",
  },
];

const steps = [
  { num: "01", title: "Register Agent", desc: "Single API call creates a CDP-backed wallet funded with USDC on Base." },
  { num: "02", title: "Set Policies", desc: "Define spending limits, allowlists, blocklists, and approval workflows." },
  { num: "03", title: "Issue Identity", desc: "Generate DID credentials for cryptographic merchant authentication." },
  { num: "04", title: "Transact", desc: "Send USDC, transfer P2P, or pay-per-request via x402 — all policy-enforced." },
];

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  useScrollReveal();

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <AmbientGlow />

      {/* ═══ NAVIGATION ═══ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: scrolled ? "12px 32px" : "20px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrolled ? "rgba(9, 9, 15, 0.8)" : "transparent",
        backdropFilter: scrolled ? "blur(20px) saturate(1.3)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px) saturate(1.3)" : "none",
        borderBottom: scrolled ? "1px solid var(--border-subtle)" : "none",
        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <NexusLogo size={34} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>NexusPay</span>
        </Link>
        <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {["Features", "How It Works", "Use Cases", "SDK"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/ /g, "-")}`}
              style={{
                fontSize: 13, fontWeight: 500,
                color: "var(--text-secondary)",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >{item}</a>
          ))}
          <Link href="/docs" style={{
            fontSize: 13, fontWeight: 500,
            color: "var(--text-secondary)",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >Docs</Link>
          <ConnectWalletBtn />
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section style={{
        position: "relative", minHeight: "100vh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "140px 24px 100px",
        overflow: "hidden",
      }}>
        <ConstellationNetwork />

        <div style={{ position: "relative", zIndex: 2, maxWidth: 780 }}>
          {/* Tag */}
          <div data-reveal style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "7px 18px", borderRadius: 99,
            background: "rgba(139,92,246,0.08)",
            border: "1px solid rgba(139,92,246,0.15)",
            fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
            color: "var(--violet-300)", marginBottom: 28,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--cyan-400)" }} />
            USDC ON BASE &middot; LIVE ON MAINNET
          </div>

          <h1 data-reveal data-reveal-delay="80" style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(42px, 6.5vw, 76px)",
            fontWeight: 800, lineHeight: 1.04,
            letterSpacing: "-0.035em",
            marginBottom: 24,
          }}>
            The payment layer<br />for{" "}
            <GradientText>AI agents</GradientText>
          </h1>

          <p data-reveal data-reveal-delay="160" style={{
            fontSize: "clamp(16px, 1.8vw, 19px)",
            color: "var(--text-secondary)", lineHeight: 1.7,
            maxWidth: 560, margin: "0 auto 40px",
          }}>
            Managed wallets, spending policies, and real USDC settlement on Base.
            P2P transfers, micropayments, and x402 paywalls, one API.
          </p>

          <div data-reveal data-reveal-delay="240" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/dashboard" style={{
              padding: "14px 34px", borderRadius: 99,
              background: "var(--gradient-brand)",
              color: "white", fontWeight: 700, fontSize: 15,
              transition: "transform 0.25s, box-shadow 0.25s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px var(--glow-violet)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >Get Started</Link>

            <a href="#code" style={{
              padding: "14px 34px", borderRadius: 99,
              border: "1px solid var(--border-hover)",
              color: "var(--text)", fontWeight: 600, fontSize: 15,
              transition: "background 0.25s, border-color 0.25s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.06)"; e.currentTarget.style.borderColor = "var(--violet-400)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--border-hover)"; }}
            >View API</a>
          </div>
        </div>

        {/* Hero bottom fade */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 200,
          background: "linear-gradient(to top, var(--bg), transparent)",
          zIndex: 3, pointerEvents: "none",
        }} />
      </section>

      {/* ═══ STATS ═══ */}
      <Section style={{ paddingBottom: "var(--section-gap)" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16,
        }}>
          {[
            { label: "Settlement", val: 12, suffix: "ms", prefix: "<" },
            { label: "Gas per tx", val: 0.001, suffix: "", prefix: "$", dec: 3 },
            { label: "Uptime SLA", val: 99.9, suffix: "%", dec: 1 },
            { label: "Active protocols", val: 3, suffix: "+" },
          ].map((s, i) => (
            <div key={i} data-reveal data-reveal-delay={i * 80} style={{
              padding: "28px 24px", borderRadius: "var(--radius-md)",
              background: "var(--gradient-surface)",
              border: "1px solid var(--border)",
              textAlign: "center",
            }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>
                {s.dec ? <>{s.prefix}{s.val}{s.suffix}</> : <Counter end={s.val} suffix={s.suffix} prefix={s.prefix || ""} />}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 6, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ CODE DEMO ═══ */}
      <Section id="code" style={{ paddingBottom: "var(--section-gap)" }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <div data-reveal style={{ textAlign: "center", marginBottom: 48 }}>
            <Badge variant="violet">Developer Experience</Badge>
            <h2 style={{
              fontFamily: "var(--font-display)", fontSize: "clamp(28px, 3.5vw, 42px)",
              fontWeight: 800, letterSpacing: "-0.03em", marginTop: 16,
            }}>
              Ship in <GradientText>minutes</GradientText>, not months
            </h2>
            <p style={{ color: "var(--text-secondary)", marginTop: 12, fontSize: 16 }}>
              Four lines to create a wallet. Four more to send a payment. Full type safety.
            </p>
          </div>
          <div data-reveal data-reveal-delay="100">
            <CodeDemo />
          </div>
        </div>
      </Section>

      {/* ═══ FEATURES ═══ */}
      <Section id="features" style={{ paddingBottom: "var(--section-gap)" }}>
        <div data-reveal style={{ textAlign: "center", marginBottom: 56 }}>
          <Badge variant="cyan">Capabilities</Badge>
          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: "clamp(28px, 3.5vw, 42px)",
            fontWeight: 800, letterSpacing: "-0.03em", marginTop: 16,
          }}>
            Everything agents need to <GradientText>transact</GradientText>
          </h2>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}>
          {features.map((f, i) => (
            <div key={i} data-reveal data-reveal-delay={i * 70}>
              <GlassCard style={{ height: "100%" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "var(--radius-md)",
                  background: "rgba(139,92,246,0.08)",
                  border: "1px solid rgba(139,92,246,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 18,
                }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, fontFamily: "var(--font-display)" }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.65 }}>{f.desc}</p>
              </GlassCard>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ HOW IT WORKS ═══ */}
      <Section id="how-it-works" style={{ paddingBottom: "var(--section-gap)" }}>
        <div data-reveal style={{ textAlign: "center", marginBottom: 56 }}>
          <Badge variant="violet">Workflow</Badge>
          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: "clamp(28px, 3.5vw, 42px)",
            fontWeight: 800, letterSpacing: "-0.03em", marginTop: 16,
          }}>
            From zero to <GradientText>settled</GradientText> in four steps
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {steps.map((s, i) => (
            <div key={i} data-reveal data-reveal-delay={i * 100}>
              <div style={{
                padding: 28, borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border)",
                background: "var(--gradient-surface)",
                height: "100%",
                position: "relative",
              }}>
                {/* Step number */}
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: 12,
                  fontWeight: 600, color: "var(--violet-400)",
                  marginBottom: 16, letterSpacing: "0.1em",
                }}>STEP {s.num}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, fontFamily: "var(--font-display)" }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>{s.desc}</p>
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div style={{
                    position: "absolute", right: -8, top: "50%",
                    width: 16, height: 1,
                    background: "var(--gradient-brand)",
                    opacity: 0.3,
                  }} />
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ USE CASES — Payment Flow Diagram ═══ */}
      <Section id="use-cases" style={{ paddingBottom: "var(--section-gap)" }}>
        <div data-reveal style={{ textAlign: "center", marginBottom: 56 }}>
          <Badge variant="cyan">Use Cases</Badge>
          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: "clamp(28px, 3.5vw, 42px)",
            fontWeight: 800, letterSpacing: "-0.03em", marginTop: 16,
          }}>
            Three ways agents <GradientText>transact</GradientText>
          </h2>
          <p style={{ color: "var(--text-secondary)", marginTop: 12, fontSize: 16, maxWidth: 560, margin: "12px auto 0" }}>
            Every payment is policy-checked, balance-verified, and settled with full audit trail.
          </p>
        </div>

        {/* Flow diagram */}
        <div data-reveal data-reveal-delay="80" style={{
          padding: 40, borderRadius: "var(--radius-xl)",
          background: "rgba(139,92,246,0.03)",
          border: "1px solid var(--border)",
          marginBottom: 40,
        }}>
          {/* Central pipeline */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, flexWrap: "wrap" }}>
            {/* Agent */}
            <div style={{ textAlign: "center", minWidth: 100 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: "0 auto 10px",
                background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
              }}>🤖</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)" }}>AI Agent</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Initiates payment</div>
            </div>

            {/* Arrow */}
            <svg width="60" height="24" viewBox="0 0 60 24" style={{ flexShrink: 0, margin: "0 4px" }}>
              <defs><linearGradient id="arrow-g" x1="0" y1="12" x2="60" y2="12" gradientUnits="userSpaceOnUse"><stop stopColor="#8b5cf6"/><stop offset="1" stopColor="#06b6d4"/></linearGradient></defs>
              <path d="M0 12H52M46 6l8 6-8 6" stroke="url(#arrow-g)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>

            {/* NexusPay box */}
            <div style={{
              padding: "20px 28px", borderRadius: "var(--radius-lg)",
              background: "rgba(9,9,15,0.8)", border: "1px solid rgba(139,92,246,0.2)",
              textAlign: "center", minWidth: 200,
            }}>
              <NexusLogo size={28} />
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-display)", marginTop: 8, marginBottom: 12 }}>NexusPay</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {["Policy Check", "Balance Verify", "Settlement"].map((step, i) => (
                  <div key={step} style={{
                    padding: "5px 14px", borderRadius: 6,
                    background: i === 2 ? "rgba(6,182,212,0.1)" : "rgba(139,92,246,0.08)",
                    border: `1px solid ${i === 2 ? "rgba(6,182,212,0.15)" : "rgba(139,92,246,0.12)"}`,
                    fontSize: 11, fontWeight: 600,
                    color: i === 2 ? "var(--cyan-400)" : "var(--violet-300)",
                    fontFamily: "var(--font-mono)",
                  }}>{step}</div>
                ))}
              </div>
            </div>

            {/* Arrow */}
            <svg width="60" height="24" viewBox="0 0 60 24" style={{ flexShrink: 0, margin: "0 4px" }}>
              <path d="M0 12H52M46 6l8 6-8 6" stroke="url(#arrow-g)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>

            {/* Recipient */}
            <div style={{ textAlign: "center", minWidth: 100 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: "0 auto 10px",
                background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
              }}>💰</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)" }}>Recipient</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Receives USDC</div>
            </div>
          </div>
        </div>

        {/* Three payment types */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            {
              title: "On-Chain Settlement",
              badge: "USDC on Base",
              badgeVariant: "success" as const,
              desc: "Agent pays an external address. USDC settles on Base via Coinbase CDP — real blockchain, sub-second finality, under $0.001 gas.",
              flow: ["Agent calls /api/transactions", "Policies enforced (6 checks)", "Balance decremented atomically", "CDP settles USDC on-chain", "Tx hash returned to agent"],
            },
            {
              title: "P2P Agent Transfer",
              badge: "Instant, Zero Gas",
              badgeVariant: "violet" as const,
              desc: "Agent pays another agent. Balances swap atomically in NexusPay — no on-chain settlement needed, no gas, instant confirmation.",
              flow: ["Agent calls /api/p2p", "Policies enforced on sender", "Both balances updated atomically", "Transaction logged with audit trail", "Both agents notified"],
            },
            {
              title: "x402 Pay-Per-Request",
              badge: "Micropayments",
              badgeVariant: "cyan" as const,
              desc: "Agent hits a monetized API endpoint. Gets 402, auto-pays the sub-cent USDC fee, receives access. Enables true pay-per-call AI tool economics.",
              flow: ["Agent hits protected endpoint", "Receives HTTP 402 + price", "Calls /api/x402 with payment", "Balance debited, access granted", "Endpoint revenue tracked"],
            },
          ].map((uc, i) => (
            <div key={i} data-reveal data-reveal-delay={i * 100}>
              <GlassCard style={{ height: "100%" }}>
                <div style={{ marginBottom: 14 }}>
                  <Badge variant={uc.badgeVariant}>{uc.badge}</Badge>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, fontFamily: "var(--font-display)", marginBottom: 10 }}>{uc.title}</h3>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 18 }}>{uc.desc}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {uc.flow.map((step, j) => (
                    <div key={j} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      fontSize: 12, color: "var(--text-secondary)",
                    }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                        background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.12)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700, color: "var(--violet-400)",
                        fontFamily: "var(--font-mono)",
                      }}>{j + 1}</span>
                      {step}
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ SDK ═══ */}
      <Section id="sdk" style={{ paddingBottom: "var(--section-gap)" }}>
        <div data-reveal style={{ textAlign: "center", marginBottom: 56 }}>
          <Badge variant="violet">TypeScript SDK</Badge>
          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: "clamp(28px, 3.5vw, 42px)",
            fontWeight: 800, letterSpacing: "-0.03em", marginTop: 16,
          }}>
            Install and start in <GradientText>30 seconds</GradientText>
          </h2>
          <p style={{ color: "var(--text-secondary)", marginTop: 12, fontSize: 16, maxWidth: 540, margin: "12px auto 0" }}>
            Full TypeScript types, CJS + ESM, works in Node, Bun, and edge runtimes.
          </p>
        </div>

        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          {/* Install command */}
          <div data-reveal style={{
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)",
            background: "rgba(9,9,15,0.9)",
            overflow: "hidden",
            backdropFilter: "blur(20px)",
            marginBottom: 24,
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 20px",
              borderBottom: "1px solid var(--border-subtle)",
              background: "rgba(15,15,24,0.6)",
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>TERMINAL</span>
              <a
                href="https://www.npmjs.com/package/nexuspay-sdk"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "4px 12px", borderRadius: 99,
                  background: "rgba(139,92,246,0.08)",
                  border: "1px solid rgba(139,92,246,0.2)",
                  fontSize: 11, fontWeight: 600, color: "var(--violet-300)",
                  fontFamily: "var(--font-mono)",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139,92,246,0.15)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(139,92,246,0.08)")}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 3v4M8 3v4M16 17v4M8 17v4"/></svg>
                npm
              </a>
            </div>
            <pre style={{
              padding: "20px 24px",
              fontFamily: "var(--font-mono)", fontSize: 15, lineHeight: 1.6,
              color: "var(--cyan-400)", margin: 0,
            }}>
              <span style={{ color: "var(--text-tertiary)", userSelect: "none" }}>$ </span>
              npm install nexuspay-sdk
            </pre>
          </div>

          {/* Code tabs */}
          <div data-reveal data-reveal-delay="100">
            <SdkDemo />
          </div>

          {/* Feature pills */}
          <div data-reveal data-reveal-delay="160" style={{
            display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center",
            marginTop: 32,
          }}>
            {[
              "Full TypeScript types",
              "CJS + ESM",
              "Node / Bun / Edge",
              "Zero dependencies",
              "Works with fetch API",
              "Auto-typed responses",
            ].map((pill) => (
              <div key={pill} style={{
                padding: "6px 16px", borderRadius: 99,
                background: "rgba(139,92,246,0.05)",
                border: "1px solid var(--border)",
                fontSize: 12, fontWeight: 500,
                color: "var(--text-secondary)",
              }}>{pill}</div>
            ))}
          </div>
        </div>
      </Section>

      {/* ═══ FAQ ═══ */}
      <Section style={{ paddingBottom: "var(--section-gap)" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div data-reveal style={{ textAlign: "center", marginBottom: 48 }}>
            <Badge variant="default">FAQ</Badge>
            <h2 style={{
              fontFamily: "var(--font-display)", fontSize: "clamp(28px, 3.5vw, 42px)",
              fontWeight: 800, letterSpacing: "-0.03em", marginTop: 16,
            }}>
              Common questions
            </h2>
          </div>
          <div data-reveal data-reveal-delay="100">
            <FAQ />
          </div>
        </div>
      </Section>

      {/* ═══ CTA ═══ */}
      <Section style={{ paddingBottom: "var(--section-gap)" }}>
        <div data-reveal style={{
          maxWidth: 640, margin: "0 auto",
          padding: "56px 48px", borderRadius: "var(--radius-xl)",
          background: "rgba(139,92,246,0.04)",
          border: "1px solid rgba(139,92,246,0.15)",
          textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          {/* Decorative gradient */}
          <div style={{
            position: "absolute", top: "-50%", left: "50%", transform: "translateX(-50%)",
            width: 500, height: 500, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{
              fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800,
              letterSpacing: "-0.02em", marginBottom: 12,
            }}>
              Ready to build the <GradientText>agent economy</GradientText>?
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 28, fontSize: 15 }}>
              Start building agent payment infrastructure today.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/dashboard" style={{
                padding: "12px 32px", borderRadius: 99,
                background: "var(--gradient-brand)",
                color: "white", fontWeight: 700, fontSize: 14,
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 20px var(--glow-violet)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >Open Dashboard</Link>
              <Link href="/docs" style={{
                padding: "12px 32px", borderRadius: 99,
                border: "1px solid var(--border-hover)",
                color: "var(--text)", fontWeight: 600, fontSize: 14,
                transition: "background 0.2s, border-color 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.06)"; e.currentTarget.style.borderColor = "var(--violet-400)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--border-hover)"; }}
              >View Docs</Link>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{
        position: "relative", zIndex: 2,
        maxWidth: "var(--container-max)", margin: "0 auto",
        padding: "40px var(--container-padding)",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <NexusLogo size={22} />
          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-display)" }}>NexusPay</span>
        </div>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>USDC on Base &middot; Built for agents</span>
      </footer>
    </div>
  );
}

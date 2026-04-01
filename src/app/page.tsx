"use client";

import { useState, useEffect, useRef } from "react";
import { NexusLogo, HexGrid, ParticleNetwork, GlassCard, useScrollReveal } from "@/components/shared";
import Link from "next/link";

/* ─── Animated counter ─── */
function Counter({ end, suffix = "", prefix = "" }: { end: number; suffix?: string; prefix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        let start = 0;
        const duration = 2000;
        const step = (ts: number) => {
          if (!start) start = ts;
          const p = Math.min((ts - start) / duration, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          setVal(Math.round(ease * end));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [end]);

  return <span ref={ref}>{prefix}{val.toLocaleString()}{suffix}</span>;
}

/* ─── Typing code demo ─── */
const codeSnippets = {
  "Create Wallet": `// Create an agent wallet
const wallet = await fetch("/api/wallets", {
  method: "POST",
  body: JSON.stringify({
    agentId: "agent-alpha",
    initialFunding: 50
  })
});
// → { address: "0x7a3...", balanceUsdc: 50 }`,
  "Send USDC": `// Policy-enforced USDC transfer
const tx = await fetch("/api/transactions", {
  method: "POST",
  body: JSON.stringify({
    fromAgentId: "agent-alpha",
    toAddress: "0x9b2...",
    amountUsdc: 12.50,
    category: "compute"
  })
});
// → { status: "CONFIRMED", txHash: "0x..." }`,
  "P2P Transfer": `// Agent-to-agent instant transfer
const p2p = await fetch("/api/p2p", {
  method: "POST",
  body: JSON.stringify({
    fromAgentId: "agent-alpha",
    toAgentId: "agent-beta",
    amountUsdc: 5.00,
    memo: "API tool payment"
  })
});
// → { isP2P: true, status: "CONFIRMED" }`,
  "x402 Paywall": `// Register a monetized endpoint
await fetch("/api/x402", {
  method: "POST",
  body: JSON.stringify({
    path: "/api/premium/data",
    priceUsdc: 0.001
  })
});
// Agents pay per request — HTTP 402 flow`,
};

function CodeDemo() {
  const tabs = Object.keys(codeSnippets) as (keyof typeof codeSnippets)[];
  const [active, setActive] = useState<keyof typeof codeSnippets>(tabs[0]);
  const [displayed, setDisplayed] = useState("");
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    const code = codeSnippets[active];
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      if (i < code.length) {
        setDisplayed(code.slice(0, i + 1));
        i++;
      } else clearInterval(id);
    }, 12);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    const id = setInterval(() => setCursor((c) => !c), 530);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: "rgba(5,15,10,0.8)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 16px" }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            style={{
              padding: "12px 16px",
              background: "none",
              border: "none",
              color: active === tab ? "var(--green-300)" : "var(--text-muted)",
              borderBottom: active === tab ? "2px solid var(--green-400)" : "2px solid transparent",
              fontSize: 13,
              fontWeight: 500,
              transition: "all 0.2s",
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      <pre style={{
        padding: 24,
        fontFamily: "var(--mono)",
        fontSize: 13,
        lineHeight: 1.7,
        color: "var(--green-200)",
        minHeight: 260,
        margin: 0,
        overflowX: "auto",
      }}>
        {displayed}
        <span style={{ opacity: cursor ? 1 : 0, color: "var(--green-400)" }}>|</span>
      </pre>
    </div>
  );
}

/* ─── Features data ─── */
const features = [
  { icon: "🔗", title: "x402 Protocol", desc: "HTTP 402 Payment Required. Agents pay-per-request to access monetized API endpoints with sub-cent USDC micropayments." },
  { icon: "🤝", title: "P2P Agent Payments", desc: "Agents pay agents directly. Instant off-chain settlement between NexusPay wallets with atomic balance transfers." },
  { icon: "🛡️", title: "Smart Spending Policies", desc: "Per-transaction limits, daily caps, merchant blocklists, category allowlists, and approval gates — all enforced before settlement." },
  { icon: "💸", title: "Micropayments", desc: "Sub-cent USDC transactions on Base. Gas costs fractions of a penny, enabling true pay-per-call economics for AI tools." },
  { icon: "🔑", title: "DID Credentials", desc: "Issue and verify decentralized identity credentials. JWT-signed DIDs let merchants authenticate agents cryptographically." },
  { icon: "🧰", title: "MCP Tool Monetization", desc: "Gate MCP tool calls behind NexusPay. Tool providers earn per-invocation; agents pay from their managed wallets." },
];

/* ─── How It Works ─── */
const steps = [
  { num: "01", title: "Register Agent", desc: "Create a wallet for your AI agent with a single API call. Funded from treasury with USDC on Base." },
  { num: "02", title: "Set Policies", desc: "Define spending rules — limits, allowlists, categories, approval gates. Policies are enforced on every transaction." },
  { num: "03", title: "Issue Credentials", desc: "Generate DID-based identity credentials. Merchants verify agents cryptographically before accepting payment." },
  { num: "04", title: "Transact", desc: "Send USDC to external addresses, other agents (P2P), or pay for API access via x402 — all policy-enforced." },
  { num: "05", title: "Settle On-Chain", desc: "Transactions settle on Base via Coinbase CDP SDK. Real USDC, real blockchain, sub-second finality." },
  { num: "06", title: "Monitor", desc: "Dashboard shows balances, transaction history, policy violations, and real-time analytics across all agents." },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [email, setEmail] = useState("");
  useScrollReveal();

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <HexGrid opacity={0.3} />

      {/* ── Nav ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "16px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrolled ? "rgba(5, 10, 8, 0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid var(--border)" : "none",
        transition: "all 0.3s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <NexusLogo size={36} />
          <span style={{ fontWeight: 700, fontSize: 18 }}>NexusPay</span>
        </div>
        <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
          <a href="#features" style={{ fontSize: 14, color: "var(--text-muted)", transition: "color 0.2s" }}
             onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
             onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>Features</a>
          <a href="#how-it-works" style={{ fontSize: 14, color: "var(--text-muted)", transition: "color 0.2s" }}
             onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
             onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>How It Works</a>
          <Link href="/dashboard" style={{
            padding: "8px 20px",
            borderRadius: 8,
            background: "linear-gradient(135deg, var(--green-600), var(--green-500))",
            color: "white",
            fontSize: 14,
            fontWeight: 600,
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 20px var(--glow)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
          >Dashboard</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        position: "relative", minHeight: "100vh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "120px 24px 80px",
      }}>
        <ParticleNetwork />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 800 }}>
          <div style={{
            display: "inline-block", padding: "6px 16px", borderRadius: 20,
            background: "rgba(52,216,122,0.1)", border: "1px solid var(--border)",
            fontSize: 13, color: "var(--green-300)", marginBottom: 24,
          }}>
            USDC on Base &middot; x402 Protocol &middot; Agent-to-Agent
          </div>
          <h1 style={{ fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 900, lineHeight: 1.05, marginBottom: 24 }}>
            PayPal for<br />
            <span style={{ background: "linear-gradient(135deg, var(--green-300), var(--green-500))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              AI Agents
            </span>
          </h1>
          <p style={{ fontSize: 18, color: "var(--text-muted)", lineHeight: 1.7, maxWidth: 600, margin: "0 auto 40px" }}>
            Give your AI agents managed wallets, spending policies, and real USDC settlement on Base.
            P2P transfers, micropayments, x402 paywalls — all through a simple REST API.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/dashboard" style={{
              padding: "14px 32px", borderRadius: 10,
              background: "linear-gradient(135deg, var(--green-500), var(--green-400))",
              color: "var(--bg)", fontWeight: 700, fontSize: 16,
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px var(--glow)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >Open Dashboard</Link>
            <a href="#code-demo" style={{
              padding: "14px 32px", borderRadius: 10,
              border: "1px solid var(--border)", color: "var(--text)",
              fontWeight: 600, fontSize: 16,
              transition: "border-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >See the API</a>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{
        position: "relative", zIndex: 2, padding: "0 24px 80px",
        display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap",
      }}>
        {[
          { label: "Settlement", value: 12, suffix: "ms", prefix: "<" },
          { label: "Uptime", value: 99.9, suffix: "%" },
          { label: "Gas per tx", value: 0.001, suffix: "", prefix: "$" },
          { label: "Protocols", value: 3, suffix: "+" },
        ].map((s, i) => (
          <div key={i} data-reveal data-reveal-delay={i * 100} style={{
            padding: "20px 32px", borderRadius: 12,
            background: "var(--bg-card)", backdropFilter: "blur(8px)",
            border: "1px solid var(--border)", textAlign: "center",
            opacity: 0, transform: "translateY(20px)",
            transition: "opacity 0.6s cubic-bezier(.22,1,.36,1), transform 0.6s cubic-bezier(.22,1,.36,1)",
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--green-300)" }}>
              {typeof s.value === "number" && s.value % 1 === 0
                ? <Counter end={s.value} suffix={s.suffix} prefix={s.prefix || ""} />
                : <>{s.prefix}{s.value}{s.suffix}</>}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Code Demo ── */}
      <section id="code-demo" style={{ position: "relative", zIndex: 2, padding: "80px 24px", maxWidth: 800, margin: "0 auto" }}>
        <div data-reveal style={{ opacity: 0, transform: "translateY(20px)", transition: "opacity 0.6s, transform 0.6s" }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, textAlign: "center" }}>
            Ship in minutes, not months
          </h2>
          <p style={{ color: "var(--text-muted)", textAlign: "center", marginBottom: 40 }}>
            Four lines of code to create a wallet. Four more to send a payment.
          </p>
          <CodeDemo />
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ position: "relative", zIndex: 2, padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <h2 data-reveal style={{
          fontSize: 32, fontWeight: 800, textAlign: "center", marginBottom: 48,
          opacity: 0, transform: "translateY(20px)", transition: "opacity 0.6s, transform 0.6s",
        }}>
          Built for the agent economy
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {features.map((f, i) => (
            <div key={i} data-reveal data-reveal-delay={i * 80}>
              <GlassCard style={{
                opacity: 0, transform: "translateY(20px)",
                transition: "opacity 0.6s cubic-bezier(.22,1,.36,1), transform 0.6s cubic-bezier(.22,1,.36,1), border-color 0.3s, box-shadow 0.3s",
                height: "100%",
              }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>{f.desc}</p>
              </GlassCard>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" style={{ position: "relative", zIndex: 2, padding: "80px 24px", maxWidth: 900, margin: "0 auto" }}>
        <h2 data-reveal style={{
          fontSize: 32, fontWeight: 800, textAlign: "center", marginBottom: 48,
          opacity: 0, transform: "translateY(20px)", transition: "opacity 0.6s, transform 0.6s",
        }}>
          How it works
        </h2>
        <div style={{ display: "grid", gap: 16 }}>
          {steps.map((s, i) => (
            <div key={i} data-reveal data-reveal-delay={i * 80} style={{
              display: "flex", gap: 20, alignItems: "flex-start",
              padding: 24, borderRadius: 12,
              background: "var(--bg-card)", backdropFilter: "blur(8px)",
              border: "1px solid var(--border)",
              opacity: 0, transform: "translateX(-20px)",
              transition: "opacity 0.6s cubic-bezier(.22,1,.36,1), transform 0.6s cubic-bezier(.22,1,.36,1)",
            }}>
              <div style={{
                minWidth: 44, height: 44, borderRadius: 10,
                background: "linear-gradient(135deg, var(--green-700), var(--green-600))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--mono)", fontWeight: 700, fontSize: 14,
              }}>{s.num}</div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA / Waitlist ── */}
      <section style={{
        position: "relative", zIndex: 2, padding: "80px 24px", textAlign: "center",
      }}>
        <div data-reveal style={{
          maxWidth: 600, margin: "0 auto", padding: 48, borderRadius: 20,
          background: "linear-gradient(135deg, rgba(10,25,18,0.8), rgba(5,15,10,0.9))",
          border: "1px solid var(--border)",
          opacity: 0, transform: "translateY(20px)", transition: "opacity 0.6s, transform 0.6s",
        }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Get early access</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 24, fontSize: 15 }}>
            Join the waitlist for NexusPay — we&apos;re onboarding agent builders now.
          </p>
          <div style={{ display: "flex", gap: 8, maxWidth: 400, margin: "0 auto" }}>
            <input
              type="email"
              placeholder="you@agent.dev"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                flex: 1, padding: "12px 16px", borderRadius: 8,
                background: "rgba(5,15,10,0.6)", border: "1px solid var(--border)",
                color: "var(--text)", fontSize: 14, outline: "none",
                fontFamily: "var(--font)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--green-500)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
            <button style={{
              padding: "12px 24px", borderRadius: 8,
              background: "linear-gradient(135deg, var(--green-500), var(--green-400))",
              color: "var(--bg)", fontWeight: 700, fontSize: 14,
              border: "none",
              transition: "transform 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >Join</button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        position: "relative", zIndex: 2,
        padding: "40px 32px",
        borderTop: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 13, color: "var(--text-muted)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <NexusLogo size={24} />
          <span>NexusPay</span>
        </div>
        <span>USDC on Base &middot; Built for agents</span>
      </footer>

      {/* ── Global reveal styles ── */}
      <style jsx global>{`
        [data-reveal].revealed {
          opacity: 1 !important;
          transform: translate(0, 0) !important;
        }
      `}</style>
    </div>
  );
}

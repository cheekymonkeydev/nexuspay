"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { NexusLogo, AmbientGlow } from "@/components/shared";

type Step = "idle" | "connecting" | "signing" | "verifying" | "done" | "error";

function buildSiweMessage(address: string, nonce: string, domain: string, uri: string): string {
  const issuedAt = new Date().toISOString();
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    "Sign in to NexusPay Dashboard",
    "",
    `URI: ${uri}`,
    "Version: 1",
    "Chain ID: 8453",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  const [step, setStep] = useState<Step>("idle");
  const [address, setAddress] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);

  useEffect(() => {
    setHasWallet(typeof window !== "undefined" && !!(window as any).ethereum);
  }, []);

  async function signIn() {
    setStep("connecting");
    setErrorMsg("");

    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) throw new Error("No wallet detected");

      // 1. Request accounts
      const accounts: string[] = await ethereum.request({ method: "eth_requestAccounts" });
      const account = accounts[0];
      setAddress(account);
      setStep("signing");

      // 2. Get nonce from server
      const nonceRes = await fetch("/api/auth/nonce");
      const { nonce } = await nonceRes.json();

      // 3. Build SIWE message
      const domain = window.location.host;
      const uri = window.location.origin;
      const message = buildSiweMessage(account, nonce, domain, uri);

      // 4. Sign it
      const signature: string = await ethereum.request({
        method: "personal_sign",
        params: [message, account],
      });

      setStep("verifying");

      // 5. Verify server-side and get session cookie
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: account, message, signature }),
      });

      const json = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(json.error || "Verification failed");

      setStep("done");
      router.push(next);
    } catch (e: any) {
      // User rejected the signature request
      if (e?.code === 4001) {
        setErrorMsg("Signature rejected — please approve the sign-in request in your wallet.");
      } else {
        setErrorMsg(e?.message ?? "Something went wrong");
      }
      setStep("error");
    }
  }

  const stepLabel: Record<Step, string> = {
    idle: "Sign in with Wallet",
    connecting: "Connecting…",
    signing: "Check your wallet…",
    verifying: "Verifying…",
    done: "Redirecting…",
    error: "Try again",
  };

  const busy = (["connecting", "signing", "verifying", "done"] as Step[]).includes(step);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      position: "relative", padding: "24px",
    }}>
      <AmbientGlow />

      {/* Back to home */}
      <Link href="/" style={{
        position: "absolute", top: 24, left: 32,
        display: "flex", alignItems: "center", gap: 8,
        fontSize: 13, color: "var(--text-tertiary)",
        transition: "color 0.2s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
      >
        ← NexusPay
      </Link>

      {/* Card */}
      <div style={{
        width: "100%", maxWidth: 400,
        background: "rgba(13,13,20,0.95)",
        border: "1px solid var(--border-hover)",
        borderRadius: "var(--radius-xl)",
        padding: "40px 36px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        backdropFilter: "blur(20px)",
        position: "relative", zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
          <NexusLogo size={48} />
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: 22, letterSpacing: "-0.02em", marginTop: 14, marginBottom: 6,
          }}>NexusPay</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center" }}>
            Sign in with your Ethereum wallet to access the dashboard
          </p>
        </div>

        {/* SIWE explanation */}
        <div style={{
          padding: "14px 16px", borderRadius: "var(--radius-md)",
          background: "rgba(139,92,246,0.05)",
          border: "1px solid rgba(139,92,246,0.12)",
          marginBottom: 24,
          display: "flex", gap: 12, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 18, lineHeight: 1.4 }}>🔐</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--violet-300)", marginBottom: 4 }}>
              Sign-In with Ethereum
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
              You'll sign a message with your wallet — no transaction, no gas. Proves wallet ownership without a password.
            </div>
          </div>
        </div>

        {/* No wallet warning */}
        {hasWallet === false && (
          <div style={{
            padding: "14px 16px", borderRadius: "var(--radius-md)",
            background: "rgba(248,113,113,0.06)",
            border: "1px solid rgba(248,113,113,0.15)",
            marginBottom: 20, fontSize: 13, color: "#f87171", lineHeight: 1.6,
          }}>
            No wallet detected. Install{" "}
            <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" style={{ color: "#f87171", textDecoration: "underline" }}>MetaMask</a>
            {" "}or{" "}
            <a href="https://www.coinbase.com/wallet" target="_blank" rel="noopener noreferrer" style={{ color: "#f87171", textDecoration: "underline" }}>Coinbase Wallet</a>
            {" "}to continue.
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div style={{
            padding: "12px 16px", borderRadius: "var(--radius-md)",
            background: "rgba(248,113,113,0.06)",
            border: "1px solid rgba(248,113,113,0.15)",
            marginBottom: 16, fontSize: 13, color: "#f87171", lineHeight: 1.5,
          }}>{errorMsg}</div>
        )}

        {/* Address pill (after connecting) */}
        {address && step !== "idle" && (
          <div style={{
            padding: "8px 14px", borderRadius: 99, marginBottom: 16,
            background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)",
            fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--cyan-400)",
            textAlign: "center", letterSpacing: "0.02em",
          }}>
            {address.slice(0, 6)}…{address.slice(-4)}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={signIn}
          disabled={busy || hasWallet === false}
          style={{
            width: "100%", padding: "14px 24px",
            borderRadius: 99, border: "none",
            background: busy ? "rgba(139,92,246,0.3)" : "var(--gradient-brand)",
            color: "white", fontSize: 15, fontWeight: 700,
            cursor: busy || hasWallet === false ? "not-allowed" : "pointer",
            opacity: hasWallet === false ? 0.5 : 1,
            transition: "transform 0.2s, box-shadow 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
          onMouseEnter={(e) => { if (!busy && hasWallet !== false) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px var(--glow-violet)"; } }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          {busy && (
            <span style={{
              width: 16, height: 16, borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white",
              animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0,
            }} />
          )}
          {stepLabel[step]}
        </button>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* Step indicators */}
        {busy && (
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { label: "Connect wallet", done: step !== "idle" && step !== "connecting" },
              { label: "Sign message (no gas)", done: step === "verifying" || step === "done" },
              { label: "Verify & create session", done: step === "done" },
            ].map((s, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 12, color: s.done ? "var(--cyan-400)" : "var(--text-tertiary)",
                transition: "color 0.3s",
              }}>
                <span style={{
                  width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                  background: s.done ? "rgba(6,182,212,0.15)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${s.done ? "rgba(6,182,212,0.4)" : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700,
                }}>{s.done ? "✓" : i + 1}</span>
                {s.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { NexusLogo, AmbientGlow } from "@/components/shared";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already authed, go straight to dashboard
  useEffect(() => {
    fetch("/api/system").then((r) => {
      if (r.ok) router.replace(params.get("from") || "/dashboard");
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (json.success) {
        router.replace(params.get("from") || "/dashboard");
      } else {
        setError(json.error || "Login failed");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, position: "relative",
    }}>
      <AmbientGlow />

      <div style={{
        width: "100%", maxWidth: 400, position: "relative", zIndex: 10,
        animation: "fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        {/* Card */}
        <div style={{
          background: "rgba(13,13,20,0.92)",
          border: "1px solid var(--border-hover)",
          borderRadius: "var(--radius-lg)",
          padding: "40px 36px",
          backdropFilter: "blur(24px)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.06)",
        }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <NexusLogo size={36} />
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>
                NexusPay
              </span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 8 }}>
              Dashboard access
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "var(--border-subtle)", marginBottom: 28 }} />

          <form onSubmit={submit}>
            {/* Password field */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: "block", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.06em", textTransform: "uppercase",
                color: "var(--text-tertiary)", marginBottom: 8,
              }}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter dashboard password"
                  autoComplete="current-password"
                  autoFocus
                  style={{
                    width: "100%", padding: "12px 44px 12px 14px",
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${error ? "rgba(248,113,113,0.4)" : "var(--border-hover)"}`,
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text)", fontSize: 15,
                    outline: "none", boxSizing: "border-box",
                    transition: "border-color 0.2s",
                    fontFamily: show ? "inherit" : "var(--font-mono)",
                  }}
                  onFocus={(e) => {
                    if (!error) e.target.style.borderColor = "var(--violet-500)";
                  }}
                  onBlur={(e) => {
                    if (!error) e.target.style.borderColor = "var(--border-hover)";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    color: "var(--text-tertiary)", fontSize: 13, padding: 4,
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
                >
                  {show ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: "10px 14px", marginBottom: 18,
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
                borderRadius: "var(--radius-sm)",
                fontSize: 13, color: "#f87171",
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !password}
              style={{
                width: "100%", padding: "12px",
                background: loading || !password ? "rgba(139,92,246,0.3)" : "var(--gradient-brand)",
                border: "none", borderRadius: 99,
                color: "white", fontSize: 14, fontWeight: 700,
                cursor: loading || !password ? "not-allowed" : "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
              onMouseEnter={(e) => {
                if (!loading && password) {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 8px 28px var(--glow-violet)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: 14, height: 14, borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white",
                    animation: "spin 0.7s linear infinite",
                  }} />
                  Signing in…
                </>
              ) : "Sign In"}
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <Link href="/" style={{ fontSize: 12, color: "var(--text-tertiary)", transition: "color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
            >
              ← Back to homepage
            </Link>
          </div>
        </div>

        {/* Glow under card */}
        <div style={{
          position: "absolute", bottom: -40, left: "10%", right: "10%", height: 60,
          background: "radial-gradient(ellipse, rgba(139,92,246,0.15) 0%, transparent 70%)",
          filter: "blur(20px)", pointerEvents: "none",
        }} />
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

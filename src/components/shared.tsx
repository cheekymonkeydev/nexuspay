"use client";

import { useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════
   NexusPay Logo
   ═══════════════════════════════════════════════════════ */
export function NexusLogo({ size = 32 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="NexusPay" width={size} height={size} style={{ borderRadius: size * 0.27, display: "block" }} />
  );
}

/* ═══════════════════════════════════════════════════════
   Ambient Glow Orbs — Floating gradient blobs
   ═══════════════════════════════════════════════════════ */
export function AmbientGlow() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* Violet orb — top left */}
      <div style={{
        position: "absolute", top: "-20%", left: "-10%",
        width: "60vw", height: "60vw", maxWidth: 900, maxHeight: 900,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(124,58,237,0.07) 0%, transparent 70%)",
        animation: "float-1 25s ease-in-out infinite",
      }} />
      {/* Cyan orb — bottom right */}
      <div style={{
        position: "absolute", bottom: "-30%", right: "-15%",
        width: "55vw", height: "55vw", maxWidth: 800, maxHeight: 800,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)",
        animation: "float-2 30s ease-in-out infinite",
      }} />
      {/* Small accent orb — mid */}
      <div style={{
        position: "absolute", top: "40%", right: "20%",
        width: "30vw", height: "30vw", maxWidth: 500, maxHeight: 500,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,92,246,0.04) 0%, transparent 70%)",
        animation: "float-3 20s ease-in-out infinite",
      }} />
      <style>{`
        @keyframes float-1 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(5vw, 8vh); } }
        @keyframes float-2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-6vw, -5vh); } }
        @keyframes float-3 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(3vw, -6vh); } }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Constellation Network — Interactive particle canvas
   ═══════════════════════════════════════════════════════ */
export function ConstellationNetwork({ height = "100vh" }: { height?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  const onMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    const nodes: { x: number; y: number; vx: number; vy: number; r: number; baseAlpha: number }[] = [];
    const count = 60;

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);

    for (let i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.8 + 0.6,
        baseAlpha: Math.random() * 0.3 + 0.15,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mx = mouseRef.current.x, my = mouseRef.current.y;

      // Update + draw nodes
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;

        const dm = Math.hypot(n.x - mx, n.y - my);
        const proximity = Math.max(0, 1 - dm / 220);

        // Gentle attraction
        if (dm < 250 && dm > 5) {
          n.vx += (mx - n.x) * 0.00004;
          n.vy += (my - n.y) * 0.00004;
        }

        // Speed damping
        const speed = Math.hypot(n.vx, n.vy);
        if (speed > 0.6) { n.vx *= 0.98; n.vy *= 0.98; }

        const alpha = n.baseAlpha + proximity * 0.5;
        const isViolet = n.baseAlpha > 0.25;
        const color = isViolet
          ? `rgba(139, 92, 246, ${alpha})`
          : `rgba(6, 182, 212, ${alpha})`;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + proximity * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      // Edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (d < 140) {
            const midDm = Math.hypot((nodes[i].x + nodes[j].x) / 2 - mx, (nodes[i].y + nodes[j].y) / 2 - my);
            const cursorBoost = Math.max(0, 1 - midDm / 200) * 0.12;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.04 * (1 - d / 140) + cursorBoost})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // Cursor glow
      if (mx > 0 && my > 0) {
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, 160);
        g.addColorStop(0, "rgba(124, 58, 237, 0.06)");
        g.addColorStop(0.5, "rgba(6, 182, 212, 0.02)");
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(mx - 160, my - 160, 320, 320);
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [onMouseMove]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height, zIndex: 1, pointerEvents: "none" }}
    />
  );
}

/* ═══════════════════════════════════════════════════════
   GlassCard — Frosted card with gradient border glow
   ═══════════════════════════════════════════════════════ */
export function GlassCard({
  children, className = "", style = {}, glow = true,
}: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; glow?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      style={{
        position: "relative",
        background: "var(--bg-card)",
        backdropFilter: "blur(20px) saturate(1.2)",
        WebkitBackdropFilter: "blur(20px) saturate(1.2)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
        padding: 28,
        overflow: "hidden",
        transition: "border-color 0.4s ease, transform 0.4s ease, box-shadow 0.4s ease",
        ...style,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "var(--border-hover)";
        el.style.transform = "translateY(-3px)";
        if (glow) el.style.boxShadow = "0 12px 40px var(--glow-violet)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "var(--border)";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
      }}
    >
      {/* Cursor-tracking radial highlight */}
      <div style={{
        position: "absolute", width: 280, height: 280, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
        left: "var(--mx, -200px)", top: "var(--my, -200px)",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none", transition: "opacity 0.3s",
      }} />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Section Container
   ═══════════════════════════════════════════════════════ */
export function Section({
  children, id, style = {},
}: {
  children: React.ReactNode; id?: string; style?: React.CSSProperties;
}) {
  return (
    <section
      id={id}
      style={{
        position: "relative", zIndex: 2,
        maxWidth: "var(--container-max)",
        margin: "0 auto",
        padding: `0 var(--container-padding)`,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   Gradient Text
   ═══════════════════════════════════════════════════════ */
export function GradientText({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{
      background: "var(--gradient-brand)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      ...style,
    }}>
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════
   Badge / Pill
   ═══════════════════════════════════════════════════════ */
export function Badge({
  children, variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "violet" | "cyan";
}) {
  const colors: Record<string, { bg: string; text: string }> = {
    default: { bg: "rgba(255,255,255,0.05)", text: "var(--text-secondary)" },
    success: { bg: "rgba(52,211,153,0.12)", text: "#34d399" },
    warning: { bg: "rgba(251,191,36,0.12)", text: "#fbbf24" },
    danger:  { bg: "rgba(248,113,113,0.12)", text: "#f87171" },
    violet:  { bg: "rgba(139,92,246,0.12)", text: "#a78bfa" },
    cyan:    { bg: "rgba(6,182,212,0.12)", text: "#22d3ee" },
  };
  const c = colors[variant] || colors.default;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "4px 12px", borderRadius: 99,
      background: c.bg, color: c.text,
      fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
    }}>
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════
   Scroll reveal hook
   ═══════════════════════════════════════════════════════ */
export function useScrollReveal() {
  useEffect(() => {
    const selectors = "[data-reveal],[data-reveal-left]";
    const els = document.querySelectorAll(selectors);
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = el.dataset.revealDelay || "0";
            el.style.transitionDelay = `${delay}ms`;
            el.classList.add("revealed");
            obs.unobserve(el);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

"use client";

import { useEffect, useRef, useCallback } from "react";

/* ─── NexusPay Logo ─── */
export function NexusLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="10" fill="url(#lg)" />
      {/* Left stroke */}
      <path d="M12 30V10" stroke="#e8fdf0" strokeWidth="3" strokeLinecap="round" />
      {/* Diagonal with arrow */}
      <path d="M12 10L28 30" stroke="#34d87a" strokeWidth="3" strokeLinecap="round" />
      {/* Right stroke */}
      <path d="M28 10V30" stroke="#e8fdf0" strokeWidth="3" strokeLinecap="round" />
      {/* Arrow head on diagonal */}
      <path d="M24 25L28 30L23 28" stroke="#34d87a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Source node dot */}
      <circle cx="12" cy="10" r="2.5" fill="#1ec464" />
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="40" y2="40">
          <stop stopColor="#0a1f14" />
          <stop offset="1" stopColor="#054d23" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ─── Hex Grid Background ─── */
export function HexGrid({ opacity = 0.35 }: { opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const drawHex = (cx: number, cy: number, r: number, alpha: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(52, 216, 122, ${alpha})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    };

    const animate = () => {
      t += 0.003;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const size = 40;
      const h = size * Math.sqrt(3);

      // Two glow spots
      const g1x = canvas.width * (0.3 + 0.2 * Math.sin(t * 0.7));
      const g1y = canvas.height * (0.4 + 0.2 * Math.cos(t * 0.5));
      const g2x = canvas.width * (0.7 + 0.15 * Math.cos(t * 0.6));
      const g2y = canvas.height * (0.6 + 0.2 * Math.sin(t * 0.4));

      for (let row = -1; row < canvas.height / h + 1; row++) {
        for (let col = -1; col < canvas.width / (size * 1.5) + 1; col++) {
          const cx = col * size * 1.5;
          const cy = row * h + (col % 2 ? h / 2 : 0);
          const d1 = Math.hypot(cx - g1x, cy - g1y);
          const d2 = Math.hypot(cx - g2x, cy - g2y);
          const glow1 = Math.max(0, 1 - d1 / 350);
          const glow2 = Math.max(0, 1 - d2 / 300);
          const alpha = 0.025 + glow1 * 0.06 + glow2 * 0.05;
          drawHex(cx, cy, size, alpha);
        }
      }
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed", inset: 0, zIndex: 0,
        opacity, pointerEvents: "none",
      }}
    />
  );
}

/* ─── Interactive Particle Network ─── */
export function ParticleNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    window.addEventListener("mousemove", handleMouseMove);

    let raf: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    const count = 80;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 1,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { x: mx, y: my } = mouseRef.current;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // Attract to cursor
        const dm = Math.hypot(p.x - mx, p.y - my);
        if (dm < 200) {
          p.vx += (mx - p.x) * 0.00008;
          p.vy += (my - p.y) * 0.00008;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(52, 216, 122, ${0.3 + (dm < 200 ? 0.4 * (1 - dm / 200) : 0)})`;
        ctx.fill();
      }

      // Connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const d = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(52, 216, 122, ${0.08 * (1 - d / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Cursor glow
      if (mx > 0) {
        const grad = ctx.createRadialGradient(mx, my, 0, mx, my, 180);
        grad.addColorStop(0, "rgba(30, 196, 100, 0.08)");
        grad.addColorStop(1, "rgba(30, 196, 100, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(mx - 180, my - 180, 360, 360);
      }

      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [handleMouseMove]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute", inset: 0, zIndex: 1,
        pointerEvents: "none",
      }}
    />
  );
}

/* ─── Glass Card with cursor-tracking glow ─── */
export function GlassCard({
  children, className = "", style = {},
}: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--gx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--gy", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      className={className}
      style={{
        background: "var(--bg-card)",
        backdropFilter: "blur(12px)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 24,
        position: "relative",
        overflow: "hidden",
        transition: "border-color 0.3s, transform 0.3s, box-shadow 0.3s",
        ...style,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "var(--border-hover)";
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = "0 8px 32px var(--glow)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "var(--border)";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
      }}
    >
      {/* Cursor glow */}
      <div style={{
        position: "absolute",
        width: 200, height: 200,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(52,216,122,0.1) 0%, transparent 70%)",
        transform: "translate(-50%, -50%)",
        left: "var(--gx, -100px)",
        top: "var(--gy, -100px)",
        pointerEvents: "none",
        transition: "opacity 0.2s",
      }} />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

/* ─── Scroll reveal hook ─── */
export function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll("[data-reveal]");
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
      { threshold: 0.1 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

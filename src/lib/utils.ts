import { NextResponse } from "next/server";
import type { ApiResponse } from "./types";

// --- Response helpers ---
export function ok<T>(data: T, meta?: Record<string, unknown>): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data, meta });
}

export function err(message: string, status = 400): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function handleError(e: unknown): NextResponse<ApiResponse> {
  const msg = e instanceof Error ? e.message : "Internal server error";
  console.error("[NexusPay Error]", msg);
  return err(msg, 500);
}

// --- ID generation ---
export function nanoid(len = 21): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) id += chars[bytes[i] % chars.length];
  return id;
}

// --- USDC helpers ---
export function parseUSDC(amount: number): bigint {
  return BigInt(Math.round(amount * 1e6));
}

export function formatUSDC(micro: bigint): number {
  return Number(micro) / 1e6;
}

// --- Crypto helpers ---
export async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Validation ---
export function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export function timestamp(): string {
  return new Date().toISOString();
}

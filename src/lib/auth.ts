import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "./db";
import { sha256 } from "./utils";

export const SCOPES: Record<string, string> = {
  "wallets:read":       "View wallets and balances",
  "wallets:write":      "Create and manage wallets",
  "transactions:read":  "View transaction history",
  "transactions:write": "Send transactions and transfers",
  "policies:read":      "View spending policies",
  "policies:write":     "Create and update policies",
  "analytics:read":     "View analytics data",
  "webhooks:read":      "View webhooks",
  "webhooks:write":     "Create and manage webhooks",
  "x402:read":          "View paywall endpoints",
  "x402:write":         "Create paywalls and process payments",
  "keys:read":          "View API keys",
  "keys:write":         "Create and revoke API keys",
};

const jwtSecret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET ?? "");

/**
 * Authentication is opt-in — controlled by environment variables.
 *
 * Open mode (default):   JWT_SECRET not set → all requests pass through.
 *                        Safe for development and single-operator deployments.
 *
 * Protected mode:        JWT_SECRET set → requires either:
 *                          1. nexus_session cookie (dashboard session from a login provider)
 *                          2. X-Api-Key header (programmatic agent access, DB-verified)
 *
 * To add proper multi-tenant auth later, integrate Clerk or NextAuth and
 * have them issue the nexus_session cookie on sign-in.
 */
export async function authenticate(req: NextRequest) {
  // Open mode — no auth configured
  if (!process.env.JWT_SECRET) {
    return { id: "open", name: "open", scopes: ["*"] as string[] };
  }

  // 1. Session cookie (dashboard UI / Clerk / NextAuth)
  const cookie = req.cookies.get("nexus_session")?.value;
  if (cookie) {
    try {
      await jwtVerify(cookie, jwtSecret());
      return { id: "session", name: "dashboard", scopes: ["*"] as string[] };
    } catch {
      // Expired or invalid
    }
  }

  // 2. X-Api-Key header (programmatic agent access)
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const keyHash = await sha256(apiKey);
    try {
      const key = await prisma.apiKey.findUnique({ where: { keyHash } });
      if (key?.isActive) {
        await prisma.apiKey.update({
          where: { id: key.id },
          data: { lastUsedAt: new Date() },
        });
        return key;
      }
    } catch {
      // DB error
    }
  }

  return null;
}

export function hasScope(key: { scopes: string[] }, scope: string): boolean {
  return key.scopes.includes(scope) || key.scopes.includes("*");
}

import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "./db";
import { sha256 } from "./utils";

const jwtSecret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET ?? "nexuspay-dev-secret-change-in-production"
  );

/**
 * Authenticate a request via:
 *  1. nexus_session cookie (dashboard UI — JWT signed by DASHBOARD_PASSWORD flow)
 *  2. X-Api-Key header (programmatic agent access — DB-verified key)
 *  3. Dev bypass — only when NODE_ENV=development and no secrets are configured
 *
 * Returns an auth context object on success, null on failure.
 */
export async function authenticate(req: NextRequest) {
  // 1. Session cookie (dashboard calls)
  const cookie = req.cookies.get("nexus_session")?.value;
  if (cookie) {
    try {
      await jwtVerify(cookie, jwtSecret());
      return { id: "session", name: "dashboard", scopes: ["*"] as string[] };
    } catch {
      // Invalid or expired — fall through
    }
  }

  // 2. API key header (programmatic)
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
      // DB error — fall through
    }
  }

  // 3. Dev bypass when no secrets are configured
  const inDev = process.env.NODE_ENV !== "production";
  const noSecrets = !process.env.JWT_SECRET && !process.env.API_SECRET_KEY;
  if (inDev && noSecrets) {
    return { id: "dev", name: "development", scopes: ["*"] as string[] };
  }

  return null;
}

export function hasScope(key: { scopes: string[] }, scope: string): boolean {
  return key.scopes.includes(scope) || key.scopes.includes("*");
}

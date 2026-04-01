import { NextRequest } from "next/server";
import { prisma } from "./db";
import { sha256 } from "./utils";

/**
 * Authenticate API requests via Bearer token (API key).
 * Returns the API key record if valid, null otherwise.
 * Skips auth in development if no API_SECRET_KEY is set.
 */
export async function authenticate(req: NextRequest) {
  // Skip auth in dev when no secret configured
  if (process.env.NODE_ENV === "development" && !process.env.API_SECRET_KEY) {
    return { id: "dev", name: "development", scopes: ["read", "write"] };
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const keyHash = await sha256(token);

  try {
    const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });
    if (!apiKey || !apiKey.isActive) return null;

    // Update last used
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return apiKey;
  } catch {
    return null;
  }
}

export function hasScope(key: { scopes: string[] }, scope: string): boolean {
  return key.scopes.includes(scope) || key.scopes.includes("*");
}

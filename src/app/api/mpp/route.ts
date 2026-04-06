/**
 * GET  /api/mpp  — list all MPP endpoints
 * POST /api/mpp  — register a new MPP endpoint
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";
import { z } from "zod";

const RegisterSchema = z.object({
  path:        z.string().min(1).startsWith("/"),
  priceUsdc:   z.number().positive(),
  description: z.string().max(300).optional(),
  intent:      z.enum(["charge", "session"]).default("charge"),
});

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "x402:read")) return err("Missing scope: x402:read", 403);
  try {
    const endpoints = await prisma.mppEndpoint.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { payments: true } } },
    });
    return ok(endpoints);
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "x402:write")) return err("Missing scope: x402:write", 403);
  try {
    const body = await req.json();
    const input = RegisterSchema.parse(body);

    const existing = await prisma.mppEndpoint.findUnique({ where: { path: input.path } });
    if (existing) return err("An MPP endpoint is already registered at this path", 409);

    const endpoint = await prisma.mppEndpoint.create({ data: input });
    return ok(endpoint);
  } catch (e) { return handleError(e); }
}

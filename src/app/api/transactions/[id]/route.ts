/**
 * GET /api/transactions/[id]
 *
 * Fetch a single transaction by ID.
 * Used by nexuspay-mpp-adapter to verify payment credentials on external apps.
 * Requires transactions:read scope (or any valid API key for backwards compat).
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "transactions:read")) return err("Missing scope: transactions:read", 403);
  try {
    const { id } = await params;
    const txn = await prisma.transaction.findUnique({ where: { id } });
    if (!txn) return err("Transaction not found", 404);
    return ok(txn);
  } catch (e) { return handleError(e); }
}

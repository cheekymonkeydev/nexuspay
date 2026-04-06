/**
 * PATCH /api/mpp/[id]  — toggle active/inactive
 * DELETE /api/mpp/[id] — remove endpoint
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "x402:write")) return err("Missing scope: x402:write", 403);
  try {
    const { id } = await params;
    const { isActive } = await req.json();
    const endpoint = await prisma.mppEndpoint.findUnique({ where: { id } });
    if (!endpoint) return err("Endpoint not found", 404);
    const updated = await prisma.mppEndpoint.update({ where: { id }, data: { isActive } });
    return ok(updated);
  } catch (e) { return handleError(e); }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "x402:write")) return err("Missing scope: x402:write", 403);
  try {
    const { id } = await params;
    await prisma.mppEndpoint.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) { return handleError(e); }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await authenticate(req)) return err("Unauthorized", 401);
  try {
    const { id } = await params;
    const { isActive } = await req.json();
    const endpoint = await prisma.paywallEndpoint.findUnique({ where: { id } });
    if (!endpoint) return err("Endpoint not found", 404);
    const updated = await prisma.paywallEndpoint.update({ where: { id }, data: { isActive } });
    return ok(updated);
  } catch (e) { return handleError(e); }
}

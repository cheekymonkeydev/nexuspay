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
  if (!hasScope(auth, "webhooks:write")) return err("Missing scope: webhooks:write", 403);
  try {
    const { id } = await params;
    const { isActive } = await req.json();
    const webhook = await prisma.webhook.update({
      where: { id },
      data: { isActive },
    });
    const { secret: _s, ...rest } = webhook;
    return ok(rest);
  } catch (e) { return handleError(e); }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "webhooks:write")) return err("Missing scope: webhooks:write", 403);
  try {
    const { id } = await params;
    await prisma.webhook.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) { return handleError(e); }
}

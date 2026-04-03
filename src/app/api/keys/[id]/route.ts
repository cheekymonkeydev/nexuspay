import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await authenticate(req)) return err("Unauthorized", 401);
  try {
    const { id } = await params;
    const key = await prisma.apiKey.findUnique({ where: { id } });
    if (!key) return err("Key not found", 404);

    await prisma.apiKey.update({ where: { id }, data: { isActive: false } });
    return ok({ revoked: true });
  } catch (e) { return handleError(e); }
}

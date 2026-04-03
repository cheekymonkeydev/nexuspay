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
    const body = await req.json();
    const policy = await prisma.spendingPolicy.findUnique({ where: { id } });
    if (!policy) return err("Policy not found", 404);

    const updated = await prisma.spendingPolicy.update({
      where: { id },
      data: {
        tier: body.tier ?? policy.tier,
        maxPerTransaction: body.maxPerTransaction ?? policy.maxPerTransaction,
        dailyLimit: body.dailyLimit ?? policy.dailyLimit,
        monthlyLimit: body.monthlyLimit ?? policy.monthlyLimit,
        requireApproval: body.requireApproval ?? policy.requireApproval,
      },
    });
    return ok(updated);
  } catch (e) { return handleError(e); }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await authenticate(req)) return err("Unauthorized", 401);
  try {
    const { id } = await params;
    const policy = await prisma.spendingPolicy.findUnique({ where: { id } });
    if (!policy) return err("Policy not found", 404);
    await prisma.spendingPolicy.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) { return handleError(e); }
}

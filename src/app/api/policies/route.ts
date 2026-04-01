import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { CreatePolicyInput } from "@/lib/types";
import { ok, err, handleError } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const agentId = req.nextUrl.searchParams.get("agentId");
    const tier = req.nextUrl.searchParams.get("tier");

    const where: Record<string, unknown> = {};
    if (agentId) where.agentId = agentId;
    if (tier) where.tier = tier;

    const policies = await prisma.spendingPolicy.findMany({ where, orderBy: { createdAt: "desc" } });
    return ok(policies);
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = CreatePolicyInput.parse(body);

    const wallet = await prisma.agentWallet.findUnique({ where: { agentId: input.agentId } });
    if (!wallet) return err("Agent wallet not found", 404);

    const policy = await prisma.spendingPolicy.create({ data: input });
    return ok(policy);
  } catch (e) { return handleError(e); }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "marketplace:read")) return err("Missing scope: marketplace:read", 403);
  try {
    const agentId = new URL(req.url).searchParams.get("agentId");
    if (!agentId) return err("agentId query param required", 400);

    const purchases = await prisma.servicePurchase.findMany({
      where: { buyerAgentId: agentId },
      include: { listing: { select: { name: true, slug: true, category: true, protocol: true, externalUrl: true } } },
      orderBy: { createdAt: "desc" },
    });
    return ok(purchases);
  } catch (e) { return handleError(e); }
}

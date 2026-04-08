import { NextRequest } from "next/server";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";
import { PurchaseListingInput } from "@/lib/types";
import { purchaseService } from "@/lib/marketplace";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "transactions:write")) return err("Missing scope: transactions:write", 403);
  try {
    const { id } = await params;
    const listing = await prisma.marketplaceListing.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!listing) return err("Listing not found", 404);

    const body = await req.json();
    const input = PurchaseListingInput.parse(body);

    const result = await purchaseService(listing.id, input.agentId, input.maxAmountUsdc);
    return ok(result);
  } catch (e) { return handleError(e); }
}

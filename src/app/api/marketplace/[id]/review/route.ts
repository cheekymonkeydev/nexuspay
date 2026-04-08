import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";
import { CreateReviewInput } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "marketplace:write")) return err("Missing scope: marketplace:write", 403);
  try {
    const { id } = await params;
    const body = await req.json();
    const input = CreateReviewInput.parse(body);

    const listing = await prisma.marketplaceListing.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!listing) return err("Listing not found", 404);

    // Must have purchased to review
    const hasPurchased = await prisma.servicePurchase.findFirst({
      where: { listingId: listing.id, buyerAgentId: input.reviewerAgentId },
    });
    if (!hasPurchased) return err("You must purchase this service before reviewing", 403);

    const review = await prisma.serviceReview.upsert({
      where: { listingId_reviewerAgentId: { listingId: listing.id, reviewerAgentId: input.reviewerAgentId } },
      create: { listingId: listing.id, ...input },
      update: { rating: input.rating, comment: input.comment },
    });

    // Recalculate average rating
    const agg = await prisma.serviceReview.aggregate({
      where: { listingId: listing.id },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.marketplaceListing.update({
      where: { id: listing.id },
      data: { avgRating: agg._avg.rating ?? 0, reviewCount: agg._count },
    });

    return ok(review);
  } catch (e) { return handleError(e); }
}

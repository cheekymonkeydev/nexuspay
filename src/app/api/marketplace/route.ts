import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { CreateListingInput } from "@/lib/types";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "marketplace:read")) return err("Missing scope: marketplace:read", 403);
  try {
    const { searchParams } = new URL(req.url);
    const category  = searchParams.get("category") ?? undefined;
    const protocol  = searchParams.get("protocol") ?? undefined;
    const q         = searchParams.get("q") ?? undefined;
    const maxPrice  = searchParams.get("maxPrice") ? parseFloat(searchParams.get("maxPrice")!) : undefined;
    const sort      = searchParams.get("sort") ?? "purchases";
    const verified  = searchParams.get("verified") === "true" ? true : undefined;
    const page      = parseInt(searchParams.get("page") ?? "1", 10);
    const limit     = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { status: "ACTIVE" };
    if (category)            where.category = category;
    if (protocol)            where.protocol = protocol;
    if (verified !== undefined) where.isVerified = verified;
    if (maxPrice !== undefined) where.priceUsdc = { lte: maxPrice };
    if (q) {
      where.OR = [
        { name:      { contains: q, mode: "insensitive" } },
        { shortDesc: { contains: q, mode: "insensitive" } },
        { tags:      { has: q } },
      ];
    }

    const orderBy =
      sort === "price_asc"  ? { priceUsdc: "asc"  as const } :
      sort === "price_desc" ? { priceUsdc: "desc" as const } :
      sort === "rating"     ? { avgRating: "desc" as const } :
      sort === "newest"     ? { createdAt: "desc" as const } :
                              { totalPurchases: "desc" as const };

    const [listings, total] = await Promise.all([
      prisma.marketplaceListing.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.marketplaceListing.count({ where }),
    ]);

    return ok(listings, { total, page, limit, pages: Math.ceil(total / limit) });
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "marketplace:write")) return err("Missing scope: marketplace:write", 403);
  try {
    const body = await req.json();
    const input = CreateListingInput.parse(body);

    const existing = await prisma.marketplaceListing.findUnique({ where: { slug: input.slug } });
    if (existing) return err("Slug already taken", 409);

    const listing = await prisma.marketplaceListing.create({
      data: {
        ...input,
        capabilities: input.capabilities as object,
        ownerId: auth.id !== "open" ? auth.id : null,
        status: "DRAFT",
      },
    });
    return ok(listing);
  } catch (e) { return handleError(e); }
}

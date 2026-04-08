import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "marketplace:read")) return err("Missing scope: marketplace:read", 403);
  try {
    const { id } = await params;
    // Support lookup by id or slug
    const listing = await prisma.marketplaceListing.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: { reviews: { orderBy: { createdAt: "desc" }, take: 10 } },
    });
    if (!listing) return err("Listing not found", 404);

    // Attach machine-readable payment instructions
    const paymentInstructions = {
      protocol: listing.protocol,
      ...(listing.externalUrl ? { url: listing.externalUrl } : {}),
      ...(listing.endpointPath ? { endpointPath: listing.endpointPath } : {}),
      sdkCall:
        listing.protocol === "X402"
          ? `nexuspay.x402Client.fetch({ agentId: "{agentId}", url: "${listing.externalUrl ?? listing.endpointPath}" })`
          : listing.protocol === "MPP"
          ? `nexuspay.mpp.pay({ agentId: "{agentId}", url: "${listing.externalUrl ?? listing.endpointPath}" })`
          : `nexuspay.marketplace.purchase("${listing.id}", { agentId: "{agentId}" })`,
    };

    return ok({ ...listing, paymentInstructions });
  } catch (e) { return handleError(e); }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "marketplace:write")) return err("Missing scope: marketplace:write", 403);
  try {
    const { id } = await params;
    const listing = await prisma.marketplaceListing.findUnique({ where: { id } });
    if (!listing) return err("Listing not found", 404);

    // Only owner or open mode can edit
    if (auth.id !== "open" && listing.ownerId && listing.ownerId !== auth.id) {
      return err("Forbidden", 403);
    }

    const body = await req.json();
    // Whitelist updatable fields
    const allowed = ["name","description","shortDesc","logoUrl","tags","priceUsdc",
      "pricingModel","endpointPath","externalUrl","capabilities","slaUptime",
      "avgLatencyMs","status","providerUrl","isVerified"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    for (const key of allowed) {
      if (body[key] !== undefined) data[key] = body[key];
    }

    const updated = await prisma.marketplaceListing.update({ where: { id }, data });
    return ok(updated);
  } catch (e) { return handleError(e); }
}

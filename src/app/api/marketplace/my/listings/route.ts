import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "marketplace:read")) return err("Missing scope: marketplace:read", 403);
  try {
    const where = auth.id !== "open" ? { ownerId: auth.id } : {};
    const listings = await prisma.marketplaceListing.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return ok(listings);
  } catch (e) { return handleError(e); }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!await authenticate(req)) return err("Unauthorized", 401);
  try {
    const treasury = await prisma.treasury.findUnique({ where: { id: "default" } });
    if (!treasury) return err("Treasury not found", 404);
    return ok(treasury);
  } catch (e) { return handleError(e); }
}

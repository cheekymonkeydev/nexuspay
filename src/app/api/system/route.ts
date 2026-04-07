import { prisma } from "@/lib/db";
import { getCDPStatus } from "@/lib/cdp";
import { ok, handleError } from "@/lib/utils";

export async function GET() {
  try {
    // Database check
    let dbStatus: "connected" | "error" = "error";
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = "connected";
    } catch {}

    const cdp = await getCDPStatus();

    return ok({
      version: "0.2.0",
      database: dbStatus,
      cdp: cdp.mode,
      cdpNetwork: process.env.NETWORK || "base-mainnet",
      cdpConfigured: cdp.configured,
      environment: process.env.NODE_ENV,
    });
  } catch (e) {
    return handleError(e);
  }
}

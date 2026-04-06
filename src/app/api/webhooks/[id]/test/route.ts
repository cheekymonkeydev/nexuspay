import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate } from "@/lib/auth";
import { signPayload } from "@/lib/webhooks";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await authenticate(req)) return err("Unauthorized", 401);
  try {
    const { id } = await params;
    const webhook = await prisma.webhook.findUnique({ where: { id } });
    if (!webhook) return err("Webhook not found", 404);

    const testPayload = {
      event: "transaction.confirmed",
      data: {
        id: `test_${Date.now()}`,
        fromAgentId: "test-agent",
        toAddress: "0x000000000000000000000000000000000000dead",
        amountUsdc: 1.00,
        status: "CONFIRMED",
        memo: "NexusPay webhook test event",
      },
      timestamp: new Date().toISOString(),
      test: true,
    };

    const body = JSON.stringify(testPayload);
    const signature = signPayload(webhook.secret, body);

    let statusCode: number | null = null;
    let success = false;
    let error: string | null = null;

    try {
      const res = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-NexusPay-Signature": signature,
          "X-NexusPay-Event": "transaction.confirmed",
          "X-NexusPay-Test": "true",
          "User-Agent": "NexusPay-Webhooks/1.0",
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      statusCode = res.status;
      success = res.ok;
    } catch (e) {
      error = e instanceof Error ? e.message : "Delivery failed";
    }

    await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event: "transaction.confirmed",
        payload: testPayload as object,
        statusCode,
        success,
        error,
      },
    });

    return ok({
      success,
      statusCode,
      error,
      message: success ? "Test event delivered successfully" : "Test delivery failed",
    });
  } catch (e) { return handleError(e); }
}

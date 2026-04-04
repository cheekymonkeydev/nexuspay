import crypto from "crypto";
import { prisma } from "@/lib/db";

export const WEBHOOK_EVENTS = [
  "transaction.confirmed",
  "transaction.failed",
  "transaction.rejected",
  "wallet.created",
  "wallet.suspended",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function signPayload(secret: string, body: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

/**
 * Deliver a webhook event to all active subscribers.
 * Fire-and-forget safe — logs delivery results but never throws.
 */
export async function deliverWebhook(event: WebhookEvent, data: object): Promise<void> {
  let webhooks: { id: string; url: string; secret: string }[] = [];

  try {
    webhooks = await prisma.webhook.findMany({
      where: { isActive: true, events: { has: event } },
      select: { id: true, url: true, secret: true },
    });
  } catch {
    return; // DB unavailable — skip silently
  }

  if (webhooks.length === 0) return;

  const body = JSON.stringify({
    event,
    data,
    timestamp: new Date().toISOString(),
  });

  await Promise.allSettled(
    webhooks.map(async (wh) => {
      const signature = signPayload(wh.secret, body);
      let statusCode: number | null = null;
      let success = false;
      let error: string | null = null;

      try {
        const res = await fetch(wh.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-NexusPay-Signature": signature,
            "X-NexusPay-Event": event,
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

      // Log delivery (best-effort)
      try {
        await prisma.webhookDelivery.create({
          data: {
            webhookId: wh.id,
            event,
            payload: JSON.parse(body),
            statusCode,
            success,
            error,
          },
        });
      } catch { /* ignore log failure */ }
    })
  );
}

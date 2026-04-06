import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err, handleError } from "@/lib/utils";
import { authenticate, hasScope } from "@/lib/auth";
import { generateWebhookSecret, WEBHOOK_EVENTS } from "@/lib/webhooks";
import { z } from "zod";

const CreateWebhookSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "Select at least one event"),
  description: z.string().max(200).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "webhooks:read")) return err("Missing scope: webhooks:read", 403);
  try {
    const webhooks = await prisma.webhook.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { deliveries: true } },
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, event: true, success: true, statusCode: true, error: true, createdAt: true },
        },
      },
    });
    // Never expose secret in list
    return ok(webhooks.map(({ secret: _s, ...w }) => w));
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!hasScope(auth, "webhooks:write")) return err("Missing scope: webhooks:write", 403);
  try {
    const body = await req.json();
    const input = CreateWebhookSchema.parse(body);
    const secret = generateWebhookSecret();

    const webhook = await prisma.webhook.create({
      data: { ...input, secret },
    });

    // Return secret only on creation
    return ok({ ...webhook });
  } catch (e) { return handleError(e); }
}

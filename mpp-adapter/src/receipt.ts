import type { ReceiptData } from "./types.js";
import { b64url } from "./crypto.js";

export function buildPaymentReceipt(data: ReceiptData): string {
  return b64url(JSON.stringify(data));
}

/** Clones a Response and adds the Payment-Receipt header. */
export function attachReceiptHeader(response: Response, receipt: string): Response {
  const headers = new Headers(response.headers);
  headers.set("Payment-Receipt", receipt);
  return new Response(response.body, {
    status:     response.status,
    statusText: response.statusText,
    headers,
  });
}

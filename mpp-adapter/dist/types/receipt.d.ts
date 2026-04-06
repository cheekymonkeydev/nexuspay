import type { ReceiptData } from "./types.js";
export declare function buildPaymentReceipt(data: ReceiptData): string;
/** Clones a Response and adds the Payment-Receipt header. */
export declare function attachReceiptHeader(response: Response, receipt: string): Response;

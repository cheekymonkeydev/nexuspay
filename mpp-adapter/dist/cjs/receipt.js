"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPaymentReceipt = buildPaymentReceipt;
exports.attachReceiptHeader = attachReceiptHeader;
const crypto_js_1 = require("./crypto.js");
function buildPaymentReceipt(data) {
    return (0, crypto_js_1.b64url)(JSON.stringify(data));
}
/** Clones a Response and adds the Payment-Receipt header. */
function attachReceiptHeader(response, receipt) {
    const headers = new Headers(response.headers);
    headers.set("Payment-Receipt", receipt);
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

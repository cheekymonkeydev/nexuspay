import { b64url, fromB64url, computeChallengeId } from "./crypto.js";
const MPP_METHOD = "nexuspay";
const MPP_INTENT = "charge";
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
/* ─── Realm resolution ───────────────────────────────────────────────────── */
function getRealm(config) {
    if (config.realm)
        return config.realm;
    if (process.env.NEXUSPAY_MPP_REALM)
        return process.env.NEXUSPAY_MPP_REALM;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
        try {
            return new URL(appUrl).hostname;
        }
        catch { /* fall through */ }
    }
    return "localhost";
}
/* ─── Challenge creation ─────────────────────────────────────────────────── */
export function createChallenge(endpointPath, config) {
    const realm = getRealm(config);
    const ttlMs = config.challengeTtlMs ?? DEFAULT_TTL;
    const expires = Date.now() + ttlMs;
    const data = {
        amount: config.price.toFixed(6),
        currency: "usdc",
        endpointPath,
        expires,
    };
    const request = b64url(JSON.stringify(data));
    const id = computeChallengeId(realm, MPP_METHOD, MPP_INTENT, request, expires);
    return { id, realm, method: MPP_METHOD, intent: MPP_INTENT, request };
}
/* ─── Header builders ────────────────────────────────────────────────────── */
export function buildWwwAuthenticate(challenge) {
    return (`Payment id="${challenge.id}", ` +
        `realm="${challenge.realm}", ` +
        `method="${challenge.method}", ` +
        `intent="${challenge.intent}", ` +
        `request="${challenge.request}"`);
}
/* ─── 402 Response ───────────────────────────────────────────────────────── */
export function buildChallengeResponse(challenge, price) {
    const data = JSON.parse(fromB64url(challenge.request));
    return new Response(JSON.stringify({
        type: "https://paymentauth.org/problems/payment-required",
        title: "Payment Required",
        status: 402,
        detail: `This resource costs $${parseFloat(data.amount).toFixed(2)} USDC. ` +
            `Pay using NexusPay MPP. Price: ${price}`,
    }), {
        status: 402,
        headers: {
            "Content-Type": "application/problem+json",
            "WWW-Authenticate": buildWwwAuthenticate(challenge),
            "Access-Control-Expose-Headers": "WWW-Authenticate",
        },
    });
}

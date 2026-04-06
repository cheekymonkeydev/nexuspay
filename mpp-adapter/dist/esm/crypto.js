import { createHmac, timingSafeEqual } from "crypto";
/* ─── Base64url helpers ──────────────────────────────────────────────────── */
export function b64url(data) {
    return Buffer.from(data, "utf8").toString("base64url");
}
export function fromB64url(data) {
    return Buffer.from(data, "base64url").toString("utf8");
}
/* ─── HMAC challenge ID ──────────────────────────────────────────────────── */
function getSecret() {
    const s = process.env.NEXUSPAY_MPP_SECRET;
    if (!s) {
        throw new Error("[nexuspay-mpp-adapter] NEXUSPAY_MPP_SECRET env var is required. " +
            "Generate one with: openssl rand -hex 32");
    }
    return s;
}
/**
 * Computes an HMAC-SHA256 challenge ID over the canonical string
 * realm|method|intent|request|expires
 *
 * This is the adapter's own HMAC — it uses NEXUSPAY_MPP_SECRET, which is
 * independent of NexusPay's internal MPP_SECRET. The adapter never needs
 * access to the NexusPay instance's secrets.
 */
export function computeChallengeId(realm, method, intent, request, expires) {
    const input = `${realm}|${method}|${intent}|${request}|${expires}`;
    return createHmac("sha256", getSecret()).update(input).digest("base64url");
}
/**
 * Constant-time HMAC verification to prevent timing attacks.
 */
export function verifyChallengeId(id, realm, method, intent, request, expires) {
    try {
        const expected = computeChallengeId(realm, method, intent, request, expires);
        const a = Buffer.from(expected);
        const b = Buffer.from(id);
        if (a.length !== b.length)
            return false;
        return timingSafeEqual(a, b);
    }
    catch {
        return false;
    }
}

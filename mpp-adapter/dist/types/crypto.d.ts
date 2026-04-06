export declare function b64url(data: string): string;
export declare function fromB64url(data: string): string;
/**
 * Computes an HMAC-SHA256 challenge ID over the canonical string
 * realm|method|intent|request|expires
 *
 * This is the adapter's own HMAC — it uses NEXUSPAY_MPP_SECRET, which is
 * independent of NexusPay's internal MPP_SECRET. The adapter never needs
 * access to the NexusPay instance's secrets.
 */
export declare function computeChallengeId(realm: string, method: string, intent: string, request: string, expires: number): string;
/**
 * Constant-time HMAC verification to prevent timing attacks.
 */
export declare function verifyChallengeId(id: string, realm: string, method: string, intent: string, request: string, expires: number): boolean;

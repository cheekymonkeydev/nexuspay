/**
 * In-process replay protection.
 *
 * Tracks used transactionIds so the same payment can't grant access twice.
 * Entries are evicted after `ttlMs * 2` with amortized pruning (max once/min).
 *
 * ⚠ Process-local: does NOT protect across multiple server instances.
 * For multi-instance deployments, wire up a Redis-backed store using the
 * exported ReplayStore interface and pass it to withMpp({ replayStore }).
 */
export interface ReplayStore {
    has(id: string): Promise<boolean> | boolean;
    add(id: string, ttlMs: number): Promise<void> | void;
}
export declare const defaultReplayStore: ReplayStore;
/**
 * Returns true if the transactionId is fresh (first use) and marks it used.
 * Returns false if it has already been used — replay attack.
 */
export declare function checkAndMarkUsed(transactionId: string, ttlMs: number, replayStore?: ReplayStore): boolean | Promise<boolean>;
/** For testing: clear all replay state. */
export declare function clearReplayStore(): void;

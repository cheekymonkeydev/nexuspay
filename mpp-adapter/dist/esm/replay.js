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
const store = new Map();
let lastPrune = Date.now();
const PRUNE_INTERVAL = 60000; // ms
function prune(ttlMs) {
    const now = Date.now();
    if (now - lastPrune < PRUNE_INTERVAL)
        return;
    lastPrune = now;
    const cutoff = now - ttlMs;
    for (const [id, entry] of store) {
        if (entry.usedAt < cutoff)
            store.delete(id);
    }
}
export const defaultReplayStore = {
    has(id) { return store.has(id); },
    add(id, ttlMs) { prune(ttlMs * 2); store.set(id, { usedAt: Date.now() }); },
};
/* ─── Check-and-mark ─────────────────────────────────────────────────────── */
/**
 * Returns true if the transactionId is fresh (first use) and marks it used.
 * Returns false if it has already been used — replay attack.
 */
export function checkAndMarkUsed(transactionId, ttlMs, replayStore = defaultReplayStore) {
    const seen = replayStore.has(transactionId);
    if (seen instanceof Promise) {
        return seen.then((isSeen) => {
            if (isSeen)
                return false;
            const addResult = replayStore.add(transactionId, ttlMs);
            if (addResult instanceof Promise)
                return addResult.then(() => true);
            return true;
        });
    }
    if (seen)
        return false;
    const addResult = replayStore.add(transactionId, ttlMs);
    if (addResult instanceof Promise)
        return addResult.then(() => true);
    return true;
}
/** For testing: clear all replay state. */
export function clearReplayStore() {
    store.clear();
}

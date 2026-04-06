/**
 * withMpp — Next.js App Router paywall wrapper
 *
 * Wraps any App Router route handler with a full MPP payment gate.
 * Agents that don't include a valid Authorization: Payment header receive
 * a 402 challenge. Once they pay via NexusPay and retry, they get through.
 *
 * @example
 * // app/api/inference/route.ts
 * import { withMpp } from "nexuspay-mpp-adapter";
 *
 * export const POST = withMpp(
 *   async (req) => Response.json({ result: await runModel(req) }),
 *   { price: 0.05 }
 * );
 */
import type { MppAdapterConfig } from "./types.js";
import type { ReplayStore } from "./replay.js";
type AppRouterHandler = (req: Request, context?: {
    params?: Promise<Record<string, string | string[]>>;
}) => Promise<Response> | Response;
export interface WithMppOptions extends MppAdapterConfig {
    /** Custom replay store for multi-instance deployments (e.g. Redis adapter) */
    replayStore?: ReplayStore;
}
export declare function withMpp(handler: AppRouterHandler, options: WithMppOptions): AppRouterHandler;
export {};

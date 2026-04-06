/**
 * withMppPages — Next.js Pages Router paywall wrapper
 *
 * @example
 * // pages/api/inference.ts
 * import { withMppPages } from "nexuspay-mpp-adapter";
 *
 * export default withMppPages(
 *   async (req, res) => { res.json({ result: "premium data" }); },
 *   { price: 0.05 }
 * );
 */
import type { MppAdapterConfig } from "./types.js";
import type { ReplayStore } from "./replay.js";
interface PageReq {
    url?: string;
    headers: Record<string, string | string[] | undefined>;
}
interface PageRes {
    setHeader(name: string, value: string): void;
    status(code: number): PageRes;
    json(body: unknown): void;
    end(): void;
}
type PageHandler = (req: PageReq, res: PageRes) => Promise<void> | void;
export interface WithMppPagesOptions extends MppAdapterConfig {
    replayStore?: ReplayStore;
}
export declare function withMppPages(handler: PageHandler, options: WithMppPagesOptions): PageHandler;
export {};

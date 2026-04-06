import type { MppCredential, VerifyResult, MppAdapterConfig } from "./types.js";
export declare function parseAuthorizationHeader(header: string): MppCredential | null;
export declare function extractAgentId(source: string): string | null;
export declare function verifyCredential(authHeader: string, config: MppAdapterConfig, _endpointPath: string): Promise<VerifyResult>;

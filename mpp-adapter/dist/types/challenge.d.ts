import type { MppChallenge, MppAdapterConfig } from "./types.js";
export declare function createChallenge(endpointPath: string, config: MppAdapterConfig): MppChallenge;
export declare function buildWwwAuthenticate(challenge: MppChallenge): string;
export declare function buildChallengeResponse(challenge: MppChallenge, price: number): Response;

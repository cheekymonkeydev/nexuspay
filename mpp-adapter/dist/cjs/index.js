"use strict";
/**
 * nexuspay-mpp-adapter
 *
 * One-liner MPP paywall wrappers for Next.js — powered by NexusPay USDC.
 *
 * App Router:
 *   export const GET = withMpp(handler, { price: 0.10 });
 *
 * Pages Router:
 *   export default withMppPages(handler, { price: 0.10 });
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeChallengeId = exports.fromB64url = exports.b64url = exports.attachReceiptHeader = exports.buildPaymentReceipt = exports.extractAgentId = exports.verifyCredential = exports.parseAuthorizationHeader = exports.buildChallengeResponse = exports.buildWwwAuthenticate = exports.createChallenge = exports.clearReplayStore = exports.defaultReplayStore = exports.withMppPages = exports.withMpp = void 0;
// ── Primary API ─────────────────────────────────────────────────────────────
var withMpp_js_1 = require("./withMpp.js");
Object.defineProperty(exports, "withMpp", { enumerable: true, get: function () { return withMpp_js_1.withMpp; } });
var withMppPages_js_1 = require("./withMppPages.js");
Object.defineProperty(exports, "withMppPages", { enumerable: true, get: function () { return withMppPages_js_1.withMppPages; } });
var replay_js_1 = require("./replay.js");
Object.defineProperty(exports, "defaultReplayStore", { enumerable: true, get: function () { return replay_js_1.defaultReplayStore; } });
Object.defineProperty(exports, "clearReplayStore", { enumerable: true, get: function () { return replay_js_1.clearReplayStore; } });
// ── Low-level primitives (advanced use / testing) ────────────────────────────
var challenge_js_1 = require("./challenge.js");
Object.defineProperty(exports, "createChallenge", { enumerable: true, get: function () { return challenge_js_1.createChallenge; } });
Object.defineProperty(exports, "buildWwwAuthenticate", { enumerable: true, get: function () { return challenge_js_1.buildWwwAuthenticate; } });
Object.defineProperty(exports, "buildChallengeResponse", { enumerable: true, get: function () { return challenge_js_1.buildChallengeResponse; } });
var credential_js_1 = require("./credential.js");
Object.defineProperty(exports, "parseAuthorizationHeader", { enumerable: true, get: function () { return credential_js_1.parseAuthorizationHeader; } });
Object.defineProperty(exports, "verifyCredential", { enumerable: true, get: function () { return credential_js_1.verifyCredential; } });
Object.defineProperty(exports, "extractAgentId", { enumerable: true, get: function () { return credential_js_1.extractAgentId; } });
var receipt_js_1 = require("./receipt.js");
Object.defineProperty(exports, "buildPaymentReceipt", { enumerable: true, get: function () { return receipt_js_1.buildPaymentReceipt; } });
Object.defineProperty(exports, "attachReceiptHeader", { enumerable: true, get: function () { return receipt_js_1.attachReceiptHeader; } });
var crypto_js_1 = require("./crypto.js");
Object.defineProperty(exports, "b64url", { enumerable: true, get: function () { return crypto_js_1.b64url; } });
Object.defineProperty(exports, "fromB64url", { enumerable: true, get: function () { return crypto_js_1.fromB64url; } });
Object.defineProperty(exports, "computeChallengeId", { enumerable: true, get: function () { return crypto_js_1.computeChallengeId; } });

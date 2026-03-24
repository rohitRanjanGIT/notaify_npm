/**
 * @notaify/node — HTTP sender
 *
 * Responsible for POSTing error payloads to the Notaify server.
 * Uses native `fetch` (Node 18+) with a 5-second timeout.
 * Never throws — failures are caught and logged as warnings.
 */

import type { NotaifyPayload } from './types';

/** Default production ingest endpoint. */
const DEFAULT_SERVER_URL = 'https://notaify.in/api/package/nodexp/ingest';

/**
 * HTTP timeout in milliseconds.
 * Set to 30 s because the Notaify server performs synchronous LLM analysis
 * before responding, which routinely takes 10–20 s.
 */
const TIMEOUT_MS = 30_000;

/**
 * Resolves the server URL from (in priority order):
 *  1. The explicit `serverUrl` passed by the caller
 *  2. The `NOTAIFY_SERVER_URL` environment variable
 *  3. The default production URL
 */
export function resolveServerUrl(explicit?: string): string {
    return (
        explicit ??
        process.env.NOTAIFY_SERVER_URL ??
        DEFAULT_SERVER_URL
    );
}

/**
 * Send an error payload to the Notaify ingest endpoint.
 *
 * @returns `true` if the request succeeded (2xx), `false` otherwise.
 */
export async function sendPayload(
    serverUrl: string,
    payload: NotaifyPayload,
): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(serverUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        return response.ok; // 2xx → true
    } catch {
        // Network error, timeout, abort — all silently swallowed here.
        // The caller (notaify.ts) is responsible for logging the warning.
        return false;
    } finally {
        clearTimeout(timeoutId);
    }
}

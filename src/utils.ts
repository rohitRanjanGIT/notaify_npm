/**
 * @notaify/node — Utility helpers
 *
 * Error normalisation, payload building, and logging.
 */

import type { NormalizedError, NotaifyPayload, ResolvedConfig } from './types';

// ─── Error Normalisation ────────────────────────────────────────────────────

/**
 * Converts any thrown value into a consistent `NormalizedError` shape.
 * Handles `Error` instances, plain strings, and completely unknown types.
 */
export function normalizeError(err: unknown): NormalizedError {
    if (err instanceof Error) {
        return {
            message: err.message,
            name: err.name,
            stack: err.stack,
        };
    }

    if (typeof err === 'string') {
        return {
            message: err,
            name: 'Error',
            stack: undefined,
        };
    }

    // Unknown type — best-effort serialisation
    let message: string;
    try {
        message = JSON.stringify(err);
    } catch {
        message = String(err);
    }

    return {
        message,
        name: 'UnknownError',
        stack: undefined,
    };
}

// ─── Payload Builder ────────────────────────────────────────────────────────

/**
 * Builds the JSON payload that will be POSTed to the Notaify ingest endpoint.
 */
export function buildPayload(
    config: ResolvedConfig,
    error: NormalizedError,
    context?: Record<string, unknown>,
): NotaifyPayload {
    return {
        apiKeyId: config.apiKeyId,
        apiKey: config.apiKey,
        error: error.message,
        location: (context?.location ?? context?.url) as string | undefined,
        stack: error.stack,
        context,
        meta: {
            environment: config.environment,
            appName: config.appName,
            timestamp: new Date().toISOString(),
            nodeVersion: process.version,
            platform: process.platform,
        },
    };
}

// ─── Logging ────────────────────────────────────────────────────────────────

const PREFIX = '[Notaify]';

/** Log an informational message (suppressed when `silent` is true). */
export function log(silent: boolean, ...args: unknown[]): void {
    if (!silent) {
        console.log(PREFIX, ...args);
    }
}

/** Log a warning (suppressed when `silent` is true). */
export function warn(silent: boolean, ...args: unknown[]): void {
    if (!silent) {
        console.warn(PREFIX, ...args);
    }
}

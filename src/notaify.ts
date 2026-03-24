/**
 * @notaify/node — Core singleton
 *
 * Provides `init()`, `capture()`, and `isInitialized()`.
 * Hooks into process-level error events so all unhandled errors are
 * automatically captured without any try-catch in user code.
 */

import type { NotaifyConfig, ResolvedConfig } from './types';
import { normalizeError, buildPayload, log, warn } from './utils';
import { resolveServerUrl, sendPayload } from './sender';

// ─── Singleton state ────────────────────────────────────────────────────────

let _config: ResolvedConfig | null = null;
let _processHooked = false;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns `true` if `notaify.init()` has been called successfully.
 */
export function isInitialized(): boolean {
    return _config !== null;
}

/**
 * Returns the current resolved config (or `null` if not initialised).
 * Exposed for internal use and testing — not part of the documented public API.
 */
export function getConfig(): ResolvedConfig | null {
    return _config;
}

/**
 * Initialise Notaify.
 *
 * - Validates required credentials
 * - Stores the resolved config in a module-level singleton
 * - Hooks into `uncaughtException` and `unhandledRejection` (once)
 *
 * Calling `init()` more than once will log a warning and overwrite the config.
 */
export function init(config: NotaifyConfig): void {
    // ── Validate required fields ────────────────────────────────────────────
    if (!config.apiKeyId || typeof config.apiKeyId !== 'string') {
        throw new Error('[Notaify] "apiKeyId" is required and must be a non-empty string.');
    }
    if (!config.apiKey || typeof config.apiKey !== 'string') {
        throw new Error('[Notaify] "apiKey" is required and must be a non-empty string.');
    }

    const silent = config.silent ?? false;

    // Warn on re-initialisation
    if (_config !== null) {
        warn(silent, 'init() called more than once. Previous config will be overwritten.');
    }

    // ── Resolve defaults ───────────────────────────────────────────────────
    _config = {
        apiKeyId: config.apiKeyId,
        apiKey: config.apiKey,
        environment: config.environment ?? 'production',
        appName: config.appName,
        silent,
        serverUrl: resolveServerUrl(config.serverUrl),
    };

    // ── Hook process-level error events (only once) ────────────────────────
    if (!_processHooked) {
        process.on('uncaughtException', (err: Error) => {
            // Use .finally() instead of async/await — Node.js does not await
            // async uncaughtException handlers, so process.exit() could fire
            // before capture completes.
            capture(err, { source: 'uncaughtException' })
                .finally(() => process.exit(1));

            // Safety net: force exit if capture hangs (e.g. network issues)
            setTimeout(() => process.exit(1), 10_000).unref();
        });

        process.on('unhandledRejection', (reason: unknown) => {
            // In Node 15+ unhandled rejections exit the process by default.
            // Adding a listener overrides that default, so we must exit
            // explicitly to preserve the same safety behaviour.
            capture(reason, { source: 'unhandledRejection' })
                .finally(() => process.exit(1));

            setTimeout(() => process.exit(1), 10_000).unref();
        });

        _processHooked = true;
    }

    log(silent, 'Initialized successfully.');
}

/**
 * Manually capture and report an error to the Notaify server.
 *
 * - Accepts any error type (`Error`, `string`, `unknown`)
 * - Accepts optional `context` for extra metadata (userId, route, etc.)
 * - **Never throws** — if the HTTP call fails a warning is logged
 * - Returns a `Promise<void>` so it can be awaited
 */
export async function capture(
    error: Error | unknown,
    context?: Record<string, unknown>,
): Promise<void> {
    if (!_config) {
        console.warn('[Notaify] Not initialized. Call notaify.init() first.');
        return;
    }

    try {
        const normalized = normalizeError(error);
        const payload = buildPayload(_config, normalized, context);
        const ok = await sendPayload(_config.serverUrl, payload);

        if (!ok) {
            warn(_config.silent, 'Failed to report error: server returned a non-2xx response.');
        }
    } catch (sendErr: unknown) {
        warn(
            _config?.silent ?? false,
            'Failed to report error:',
            sendErr instanceof Error ? sendErr.message : String(sendErr),
        );
    }
}

// ─── Testing helpers ────────────────────────────────────────────────────────

/**
 * Reset the singleton state. **For testing only — do not use in production.**
 * @internal
 */
export function _reset(): void {
    _config = null;
    // NOTE: We intentionally do NOT remove process listeners here because
    // Node.js doesn't provide a clean way to remove them by reference once
    // they've been wrapped in async closures. In tests, the listeners are
    // harmless because `_config` will be null and `capture` will no-op.
}

/**
 * @notaify/node — Framework error middleware
 *
 * Returns an error-handling middleware compatible with Express and Fastify.
 * Auto-detects the framework based on argument shape, or can be configured
 * explicitly via the `framework` option.
 */

import type { MiddlewareOptions } from './types';
import { capture } from './notaify';

/**
 * Creates an error-handling middleware that captures errors via Notaify.
 *
 * **Express** — must be added AFTER all routes:
 * ```ts
 * app.use(notaifyMiddleware());
 * ```
 *
 * **Fastify** — use as the global error handler:
 * ```ts
 * fastify.setErrorHandler(notaifyMiddleware({ framework: 'fastify' }));
 * ```
 *
 * @param options Optional configuration, e.g. `{ framework: 'express' }`.
 */
export function notaifyMiddleware(options?: MiddlewareOptions): any {
    const framework = options?.framework ?? 'auto';

    // ── Fastify explicit mode ──────────────────────────────────────────────
    if (framework === 'fastify') {
        return async function notaifyFastifyErrorHandler(
            error: Error,
            request: any,
            reply: any,
        ): Promise<void> {
            // Fire-and-forget: don't block the error response while the
            // server performs LLM analysis (can take 10–20 s).
            capture(error, {
                source: 'notaifyMiddleware:fastify',
                url: request?.url,
                method: request?.method,
            }).catch(() => {});

            // Send a generic 500 if the reply hasn't been sent yet
            if (!reply.sent) {
                reply.status(500).send({ error: 'Internal Server Error' });
            }
        };
    }

    // ── Express / Auto mode ────────────────────────────────────────────────
    // Express error middleware signature: (err, req, res, next)
    // The 4-argument length is critical — Express uses `fn.length === 4`
    // to distinguish error middleware from regular middleware.

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const expressMiddleware = function notaifyExpressErrorHandler(
        err: Error,
        req: any,
        res: any,
        next: (...args: any[]) => void,
    ): void {
        // Fire-and-forget: capture the error without blocking the Express
        // error pipeline. The server does synchronous LLM analysis which
        // can take 10–20 s; waiting here would stall the HTTP response.
        capture(err, {
            source: 'notaifyMiddleware:express',
            url: req?.originalUrl ?? req?.url,
            method: req?.method,
        }).catch(() => {});

        // Propagate immediately so Express can send the error response
        next(err);
    };

    return expressMiddleware;
}

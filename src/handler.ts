/**
 * @notaify/node — Async handler wrapper
 *
 * A higher-order function that wraps any async route handler.
 * If the handler throws, the error is captured via `notaify.capture()`
 * and then re-thrown so the framework's own error handling also runs.
 */

import { capture } from './notaify';

/**
 * Wraps an async function so any thrown error is automatically captured
 * by Notaify before being re-thrown.
 *
 * Works with:
 * - Express route handlers: `(req, res, next) => Promise<void>`
 * - Next.js App Router handlers: `(req: Request) => Promise<Response>`
 * - Fastify route handlers
 * - Any generic async function
 *
 * @example
 * ```ts
 * // Express
 * app.get('/users', notaifyHandler(async (req, res) => {
 *   const users = await db.getUsers();
 *   res.json(users);
 * }));
 *
 * // Next.js App Router
 * export const GET = notaifyHandler(async (req) => {
 *   const data = await fetchData();
 *   return Response.json(data);
 * });
 * ```
 */
export function notaifyHandler<T extends (...args: any[]) => Promise<any>>(
    fn: T,
): T {
    const wrapped = async function (this: any, ...args: any[]): Promise<any> {
        try {
            return await fn.apply(this, args);
        } catch (error: unknown) {
            // Fire-and-forget: capture the error without delaying the re-throw.
            // The server does synchronous LLM analysis (10–20 s); awaiting here
            // would block the HTTP error response for that entire duration.
            capture(error, { source: 'notaifyHandler' }).catch(() => {});
            throw error;
        }
    };

    // Preserve the original function name for debugging / framework introspection
    Object.defineProperty(wrapped, 'name', { value: fn.name || 'notaifyWrapped' });

    // Preserve `.length` so Express can differentiate (req,res) vs (req,res,next) vs (err,req,res,next)
    Object.defineProperty(wrapped, 'length', { value: fn.length });

    return wrapped as unknown as T;
}

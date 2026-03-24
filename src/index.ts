/**
 * @notaify/node — Public API surface
 *
 * Everything exported from this file is the public API of the package.
 */

// ─── Core ───────────────────────────────────────────────────────────────────
export { init, capture, isInitialized } from './notaify';

// ─── Handler wrapper ────────────────────────────────────────────────────────
export { notaifyHandler } from './handler';

// ─── Framework middleware ───────────────────────────────────────────────────
export { notaifyMiddleware } from './middleware';

// ─── Types (re-exported for consumers) ──────────────────────────────────────
export type {
    NotaifyConfig,
    NotaifyPayload,
    MiddlewareOptions,
    FrameworkType,
} from './types';

// ─── Convenience default export ─────────────────────────────────────────────
import { init, capture, isInitialized } from './notaify';
import { notaifyHandler } from './handler';
import { notaifyMiddleware } from './middleware';

const notaify = {
    init,
    capture,
    isInitialized,
    notaifyHandler,
    notaifyMiddleware,
} as const;

export default notaify;

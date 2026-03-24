/**
 * @notaify/node — TypeScript interfaces and types
 *
 * All public and internal types used across the package.
 */

// ─── Public Config ──────────────────────────────────────────────────────────

/**
 * Configuration object passed to `notaify.init()`.
 */
export interface NotaifyConfig {
    /** The Notaify API Key ID (public identifier for the project). */
    apiKeyId: string;

    /** The Notaify API Key (secret key used to authenticate requests). */
    apiKey: string;

    /**
     * Environment label attached to every error report.
     * @default 'production'
     */
    environment?: string;

    /**
     * Optional human-readable application name shown in emails and dashboard.
     */
    appName?: string;

    /**
     * When `true`, suppresses all `[Notaify]` console output.
     * @default false
     */
    silent?: boolean;

    /**
     * Override the Notaify server URL (useful for local development / self-hosted).
     * Falls back to the `NOTAIFY_SERVER_URL` env variable, then the default production URL.
     */
    serverUrl?: string;
}

// ─── Internal / Resolved Config ─────────────────────────────────────────────

/** Fully resolved configuration with all defaults applied. */
export interface ResolvedConfig {
    apiKeyId: string;
    apiKey: string;
    environment: string;
    appName?: string;
    silent: boolean;
    serverUrl: string;
}

// ─── Payload sent to the Notaify server ─────────────────────────────────────

/**
 * The JSON body POSTed to the Notaify ingest endpoint.
 * Matches the server's expected shape in `app/api/package/nodexp/ingest/route.ts`.
 */
export interface NotaifyPayload {
    /** Project API Key ID (public). */
    apiKeyId: string;

    /** Project API Key (secret). */
    apiKey: string;

    /** The error message string. */
    error: string;

    /** Where the error originated (file, route, handler name, etc.). */
    location?: string;

    /** Full stack trace string. */
    stack?: string;

    /** Additional metadata provided by the developer via `capture()`. */
    context?: Record<string, unknown>;

    /** Automatically collected runtime metadata. */
    meta: {
        environment: string;
        appName?: string;
        timestamp: string;      // ISO 8601
        nodeVersion: string;    // process.version
        platform: string;       // process.platform
    };

    /** Set to `true` only when the dashboard triggers a test capture. */
    isTest?: boolean;
}

// ─── Capture helpers ────────────────────────────────────────────────────────

/** Structured representation of any error after normalisation. */
export interface NormalizedError {
    message: string;
    name: string;
    stack?: string;
}

// ─── Framework middleware options ───────────────────────────────────────────

export type FrameworkType = 'express' | 'fastify' | 'auto';

export interface MiddlewareOptions {
    /**
     * Explicitly choose the framework instead of auto-detecting.
     * @default 'auto'
     */
    framework?: FrameworkType;
}

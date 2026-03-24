# @notaify/node

**AI-powered error tracking for Node.js** — catch errors, get instant diagnosis and fixes via email.

Your backend throws an error. Notaify captures it, sends it to your configured LLM (OpenAI / Claude / Gemini), and emails you a diagnosis with a suggested fix. Zero config beyond two keys.

```
Error thrown  -->  Notaify captures  -->  LLM analyzes  -->  Email with fix lands in your inbox
```

**Supports:** Express | Fastify | Next.js | NestJS | Plain Node.js

---

## Install

```bash
npm install @notaify/node
```

> **Server-side only.** Uses Node.js APIs — not for browsers or client components.

---

## Get Your Credentials

1. Sign up at [notaify.in](https://notaify.in)
2. Create a project and configure your LLM provider (OpenAI, Claude, or Gemini)
3. Generate an API key — you'll get an **API Key ID** and a **Secret API Key**
4. Add them to your `.env`:

```env
NOTAIFY_API_KEY_ID=nty_xxxxxx_xxxxxx
NOTAIFY_API_KEY=nty_xxxxxxxxxxxxxx
```

> Never commit these to version control. Always load from environment variables.

---

## Quick Start

```ts
import { init } from '@notaify/node';

init({
  apiKeyId: process.env.NOTAIFY_API_KEY_ID!,
  apiKey:   process.env.NOTAIFY_API_KEY!,
  appName:  'my-api',
});

// Done. All unhandled exceptions and promise rejections are now auto-captured.
```

That's the minimum setup. Every uncaught error from this point forward is sent to Notaify, analyzed by your LLM, and emailed to you.

---

## Usage

Notaify gives you four ways to capture errors — pick what fits your app.

### 1. Auto-capture (recommended)

Just call `init()` at your app's entry point. Notaify hooks into `uncaughtException` and `unhandledRejection` automatically.

```ts
import { init } from '@notaify/node';

init({
  apiKeyId: process.env.NOTAIFY_API_KEY_ID!,
  apiKey:   process.env.NOTAIFY_API_KEY!,
});

// Every unhandled error is now captured — no try/catch needed.
```

### 2. Manual capture

Use `capture()` inside a try-catch when you want to report specific errors with extra context.

```ts
import { capture } from '@notaify/node';

try {
  await chargeCustomer(userId);
} catch (err) {
  await capture(err, {
    userId: 'user_123',
    route: '/api/payments',
    severity: 'critical',
  });
}
```

- Accepts `Error` objects, strings, or any thrown value
- **Never throws** — if the API call fails, a warning is logged
- Returns `Promise<void>` so you can `await` it or fire-and-forget

### 3. Handler wrapper

Wrap any async route handler with `notaifyHandler`. If it throws, the error is captured and re-thrown so your framework's error handling still runs.

```ts
import { notaifyHandler } from '@notaify/node';

// Express
app.get('/users', notaifyHandler(async (req, res) => {
  const users = await db.getUsers();
  res.json(users);
}));

// Next.js App Router
export const GET = notaifyHandler(async (req) => {
  const data = await fetchData();
  return Response.json(data);
});
```

Error capture is non-blocking — your error response is sent immediately without waiting for the LLM analysis.

### 4. Error middleware

Plug into your framework's error-handling pipeline.

**Express** — add after all routes:

```ts
import { notaifyMiddleware } from '@notaify/node';

app.use(notaifyMiddleware());
```

**Fastify** — set as the global error handler:

```ts
import { notaifyMiddleware } from '@notaify/node';

fastify.setErrorHandler(notaifyMiddleware({ framework: 'fastify' }));
```

The middleware captures errors in the background and forwards them immediately — no added latency to your error responses.

---

## Framework Examples

### Express

```ts
import express from 'express';
import { init, notaifyMiddleware } from '@notaify/node';

init({
  apiKeyId: process.env.NOTAIFY_API_KEY_ID!,
  apiKey:   process.env.NOTAIFY_API_KEY!,
  appName:  'express-api',
});

const app = express();

app.get('/users', async (req, res) => {
  const users = await db.getUsers();
  res.json(users);
});

// Must be after all routes
app.use(notaifyMiddleware());

app.listen(3000);
```

### Fastify

```ts
import Fastify from 'fastify';
import { init, notaifyMiddleware } from '@notaify/node';

init({
  apiKeyId: process.env.NOTAIFY_API_KEY_ID!,
  apiKey:   process.env.NOTAIFY_API_KEY!,
  appName:  'fastify-api',
});

const fastify = Fastify();

fastify.setErrorHandler(notaifyMiddleware({ framework: 'fastify' }));

fastify.get('/users', async () => {
  return await db.getUsers();
});

fastify.listen({ port: 3000 });
```

### Next.js (App Router)

```ts
// lib/notaify.ts — initialize once
import { init } from '@notaify/node';

init({
  apiKeyId: process.env.NOTAIFY_API_KEY_ID!,
  apiKey:   process.env.NOTAIFY_API_KEY!,
  appName:  'my-nextjs-app',
});
```

```ts
// app/api/users/route.ts
import '@/lib/notaify';  // ensure init() runs
import { notaifyHandler } from '@notaify/node';

export const GET = notaifyHandler(async (req) => {
  const users = await db.getUsers();
  return Response.json(users);
});
```

> Notaify is **server-side only**. Don't import it in client components or `'use client'` files.

### NestJS

```ts
// main.ts
import { NestFactory } from '@nestjs/core';
import { init, notaifyMiddleware } from '@notaify/node';
import { AppModule } from './app.module';

async function bootstrap() {
  init({
    apiKeyId: process.env.NOTAIFY_API_KEY_ID!,
    apiKey:   process.env.NOTAIFY_API_KEY!,
    appName:  'nestjs-app',
  });

  const app = await NestFactory.create(AppModule);

  // NestJS uses Express under the hood
  app.use(notaifyMiddleware());

  await app.listen(3000);
}

bootstrap();
```

---

## Default Export

Prefer a namespace-style API? Use the default export:

```ts
import notaify from '@notaify/node';

notaify.init({ apiKeyId: '...', apiKey: '...' });
await notaify.capture(new Error('something broke'));
```

---

## Config Options

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKeyId` | `string` | **(required)** | Your project's API Key ID (starts with `nty_`) |
| `apiKey` | `string` | **(required)** | Your project's secret API Key (starts with `nty_`) |
| `environment` | `string` | `'production'` | Environment label — `'staging'`, `'development'`, etc. |
| `appName` | `string` | — | App name shown in emails and dashboard |
| `silent` | `boolean` | `false` | Suppress all `[Notaify]` console output |
| `serverUrl` | `string` | — | Override the Notaify server URL (self-hosted setups) |

| Environment Variable | Description |
|---|---|
| `NOTAIFY_SERVER_URL` | Override the default server URL (alternative to `serverUrl` config) |

---

## How It Works

```
1. Your app throws an error (caught or uncaught)
         |
2. @notaify/node captures it and sends error + stack trace to the Notaify server
         |
3. The server analyzes the error with your configured LLM (OpenAI / Claude / Gemini)
         |
4. You get an email with:
     - Raw error message and stack trace
     - AI-generated diagnosis (what went wrong)
     - Suggested fix (how to solve it)
     - Error type and status code
         |
5. The error + analysis is also logged in your Notaify dashboard
```

---

## Requirements

- **Node.js 18+** (uses native `fetch`)
- Zero runtime dependencies

---

## License

MIT

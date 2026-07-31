# @apowerb/apowerb-sdk

JavaScript client for the apowerb backend: agents, tools, RAG, BI, webhooks, billing, skills. **143 functions**, no dependencies, no React and no Next code — usable in a browser as well as in Node.

## Why this package

This layer used to live in `src/lib/api.js` inside the Next application, with `const BASE = ""` hard-coded: every request went out relative to `/api/...`, which assumes being served by the app that proxies those routes. The most reusable part of the repository was therefore trapped inside the front end.

## Usage

With no configuration the behaviour is the original one — relative requests, token read from `localStorage` — so the Next application does not change by a single byte:

```js
import { listAgents } from "@apowerb/apowerb-sdk";

const agents = await listAgents(); // GET /api/agents
```

Anywhere else, point it at the backend of your choice:

```js
import { configureClient, listAgents } from "@apowerb/apowerb-sdk";

configureClient({
  baseUrl: "https://your-apowerb-host",
  storage: { getToken: () => process.env.APOWERB_TOKEN },
});

const agents = await listAgents(); // GET https://your-apowerb-host/api/agents
```

## Configuration

`configureClient(options)` — omitted keys keep their current value.

| Option | Default | Role |
|---|---|---|
| `baseUrl` | `""` | Backend root. Empty means relative requests. A trailing slash is tolerated. |
| `storage` | `authStorage` (localStorage) | Must expose `getToken()`, ideally `setToken()` and `clear()`. |
| `onUnauthorized` | `auth:unauthorized` event on `window` | Called on a final 401. With no DOM, it does nothing. |

`getClientConfig()` returns the current configuration; `resetClientConfig()` restores the defaults, which is useful between tests.

## What the client handles for you

- injecting the `Authorization` header;
- refreshing the token on a 401, with a lock so concurrent refreshes cannot pile up, then replaying the request;
- non-JSON responses from reverse proxies (502/503/504), turned into clean `Error` objects carrying `status`;
- file uploads, including chunked ones.

## Format

Pure ESM, published as-is — no build step. The files contain neither JSX nor any proprietary syntax, so Node and any bundler consume them directly.

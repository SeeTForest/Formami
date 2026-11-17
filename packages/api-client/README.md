# @formami/api-client

Typed TypeScript client for the [Formami](https://github.com/SeeTForest/Formami) API. Every method is generated from
Formami's OpenAPI contract (`public/openapi.json` in the main repository), so the client can never
drift from the server.

This package is currently built from this workspace; no public npm publication is implied.
Run `pnpm build:packages` from the repository root.

## Usage

```ts
import { FormamiClient } from '@formami/api-client';

// Self-hosted
const formami = new FormamiClient({
  baseUrl: 'https://analytics.example.com/api',
  token: process.env.FORMAMI_API_TOKEN, // API key (formami_…) or login token
});

const websites = await formami.listWebsites();

const stats = await formami.getWebsiteStats({
  websiteId,
  startAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  endAt: Date.now(),
});

const pages = await formami.getWebsiteMetrics({ websiteId, startAt, endAt, type: 'path', limit: 10 });
```

Every method takes **one object** that merges path parameters, query parameters and the request
body. Method names are the OpenAPI `operationId`s; hover in your editor for the parameter and
response types, or import `OperationInput<'getWebsiteStats'>` / `OperationOutput<'…'>`.

### Options

| Option    | Description                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `baseUrl` | Required API root for your instance, e.g. `https://analytics.example.com/api`; there is no default hosted service.                    |
| `token`   | Bearer token: login token or self-hosted API key.                                      |
| `apiKey`  | Instance API key (sent as `x-formami-api-key`; also sent as a bearer token when `token` is not provided). |
| `headers` | Extra headers for every request.                                                                            |
| `fetch`   | Custom `fetch` (tests, other runtimes, in-process dispatch).                                                |
| `timeout` | Per-request timeout in milliseconds.                                                                        |

### Errors

Non-2xx responses throw `FormamiApiError` with `status`, `code` (`unauthorized`, `forbidden`,
`not-found`, `bad-request`, …), `message` and the parsed `body`.

```ts
import { isFormamiApiError } from '@formami/api-client';

try {
  await formami.getWebsite({ websiteId });
} catch (error) {
  if (isFormamiApiError(error) && error.isNotFound) {
    // …
  }
}
```

### Escape hatch

`formami.call('operationId', input)` invokes any operation by ID; `operations` exports the full
table of methods, paths and parameters.

## Regenerating

From the Formami repository root:

```bash
pnpm generate:api      # public/openapi.json → packages/api-client/src/generated
pnpm check:api:client  # CI: fail if generated files are stale
```

See [MIGRATION.md](./MIGRATION.md) if you are upgrading from the previous hand-written client.

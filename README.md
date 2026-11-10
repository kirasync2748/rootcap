<h1 align="center">rootcap</h1>

<p align="center"><strong>A little proof. A lot of privacy.</strong></p>

<p align="center">
  A self-hosted CAPTCHA alternative that makes automated requests more expensive<br>
  with browser proof of work. Visitors click a lightweight widget; a Web Worker<br>
  solves the challenges and your server verifies the result.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/rootcap"><img src="https://img.shields.io/npm/v/rootcap" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/rootcap"><img src="https://img.shields.io/npm/dm/rootcap" alt="npm downloads per month"></a>
  <a href="https://rootcap.vercel.app/docs#docs-intro"><img src="https://img.shields.io/badge/Privacy-First-047857" alt="Privacy First"></a>
  <a href="https://www.npmjs.com/package/rootcap"><img src="https://img.shields.io/badge/Dependencies-Zero-047857" alt="Zero runtime dependencies"></a>
  <a href="https://rootcap.vercel.app/docs#docs-pow"><img src="https://img.shields.io/badge/Proof%20of%20Work-SHA--256-047857" alt="Proof of Work: SHA-256"></a>
  <a href="https://github.com/kirasync2748/rootcap/actions/workflows/publish.yml"><img src="https://github.com/kirasync2748/rootcap/actions/workflows/publish.yml/badge.svg" alt="Publish"></a>
  <a href="https://github.com/kirasync2748/rootcap/actions/workflows/ci.yml"><img src="https://github.com/kirasync2748/rootcap/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

## Why rootcap?

- **No visual puzzles:** verification runs in a Web Worker.
- **Privacy first:** no third-party verification service or tracking cookies.
- **Self-hosted:** your application owns its signing keys and verification API.
- **Zero runtime dependencies:** ESM modules with TypeScript declarations.
- **Flexible security:** scoped tokens, context binding, key rotation, and opt-in
  one-time challenge and token consumption.
- **Portable:** Node HTTP and Express adapters, plus Web Crypto and Fetch APIs.
- **Customizable widget:** themes, translated messages, progress, background
  solving, cancellation, timeouts, and a separately hosted worker option.

Proof of work raises the cost of automation. It does not establish that a visitor
is human. Combine it with application validation, sensible rate limits, and
monitoring.

## Install

```sh
npm install rootcap
```

Use Node.js 24 or later for the Node APIs. The widget requires a modern browser
with Web Workers, Web Crypto, and form-associated custom elements, served over
HTTPS or localhost. Browser imports below assume a frontend bundler such as Vite.

## Quick start

This example protects a same-origin signup form with the `signup` scope.

### 1. Configure a signing secret

Generate a secret for your server environment:

```sh
export ROOTCAP_SECRET=$(node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))")
```

Store it in your deployment's secret manager and share it among your API
instances. Keep it out of frontend bundles and source control. The adapters
require at least 16 characters.

### 2. Add the API and protected route

Install Express if your application does not already use it:

```sh
npm install express
```

```js
import express from "express";
import { verifyToken } from "rootcap";
import { createExpressMiddleware } from "rootcap/express";

const secret = process.env.ROOTCAP_SECRET;
if (!secret || secret.length < 16) throw new Error("Set ROOTCAP_SECRET");

const app = express();

// Mount before body parsers: the adapter reads and bounds its own API bodies.
app.use(createExpressMiddleware({ secret, scope: "signup" }));
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: false, limit: "64kb" }));

app.post("/signup", (req, res) => {
  const token = req.body?.["rootcap-token"];
  if (typeof token !== "string" || !verifyToken(secret, token, { scope: "signup" })) {
    return res.status(403).json({ error: "verification_failed" });
  }

  // Validate the remaining fields and perform your protected operation here.
  return res.json({ success: true });
});

app.listen(3000);
```

The adapter serves `/api/challenge` and `/api/verify`. It also exposes
process-local `/api/stats`; restrict that endpoint in your application or proxy
if you do not want to expose those counters. Serve your frontend on the same
origin, or configure CORS and the form action for your deployment.

### 3. Add the widget

Import the custom element in your frontend entry module:

```js
import "rootcap/widget";
```

```html
<form action="/signup" method="POST">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" required />
  <rootcap-widget data-scope="signup" name="rootcap-token" required></rootcap-widget>
  <button type="submit">Sign up</button>
</form>
```

The widget contributes the redeem token to the form. Always verify it on the
server before accepting the protected action. The server controls the scope;
`data-scope` is not an authorization boundary. Set `data-api` when the API uses a
different base URL.

## How verification works

1. The server signs a batch of short-lived challenges.
2. The widget solves them in a worker and posts the solutions to your API.
3. Your API verifies the proof and returns a redeem token.
4. Your protected application route verifies that token and its expected scope.

By default, verification is stateless and tokens remain reusable until expiry.
Use `createProtection` with an atomic shared store when your application requires
one-time use. Both proof verification and final redemption must use that same
protection configuration.

## Security controls in 1.3.0

| Capability                            | API or configuration                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| One-time challenges and redeem tokens | `createProtection({ keys, store, consumeChallenges, consumeTokens })`                    |
| Signing-key rotation                  | Put the active key first in `keys`; retain previous keys while their tokens remain valid |
| Action and request-context binding    | Match server-controlled `scope` and `context` when issuing and verifying                 |
| Shared replay protection              | `createRedisConsumptionStore(client)` with atomic Redis consumption                      |
| Shared rate limiting                  | `createRedisRateLimiter(client, { limit, windowMs })` and adapter rate-limit hooks       |
| Workload presets                      | `securityProfiles.light`, `.balanced`, and `.strict`                                     |
| Operational telemetry                 | Adapter `onEvent` callback and application monitoring                                    |

Redis helpers accept a client with `sendCommand`; install and configure your
chosen Redis client separately. Store failures reject verification. Choose rate
limit identities using trusted proxy configuration and keep replay state shared
across application instances.

Challenge defaults are 50 puzzles, difficulty 4, and a 10-minute lifetime. Redeem
tokens default to 20 minutes. Tune these for your traffic and representative
client devices. Memory-hard proofs remain research for a future protocol.

## Widget controls

```js
const widget = document.querySelector("rootcap-widget");
await widget.execute();
const token = widget.getResponse();
widget.reset();
```

Use `cancel()` to stop active verification, `data-timeout` to bound elapsed time,
and `data-max-work` to limit the estimated work accepted from the server.
`data-auto` starts verification when the associated form receives focus.

Listen for `rootcap:verified`, `rootcap:progress`, `rootcap:error`,
`rootcap:expired`, and `rootcap:reset`. Customize messages through the `messages`
property, and theme the element with CSS variables:

```css
rootcap-widget {
  --rc-primary: #4f46e5;
  --rc-verified-surface: #eef2ff;
  --rc-on-primary: #ffffff;
  --rc-focus: #3730a3;
  --rc-radius: 8px;
}
```

See the [widget reference](https://rootcap.vercel.app/docs#docs-widget) for
attributes, events, and theming.

## Package entry points

| Import                     | Purpose                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `rootcap`                  | Synchronous Node core, protection, profiles, and Redis helpers |
| `rootcap/widget`           | Registers the `<rootcap-widget>` custom element                |
| `rootcap/server`           | Node HTTP `createApiHandler`                                   |
| `rootcap/express`          | Express-compatible `createExpressMiddleware`                   |
| `rootcap/edge`             | Asynchronous Web Crypto core and `createFetchHandler`          |
| `rootcap/worker/solver.js` | Worker asset for separately hosted deployments                 |

The [website documentation](https://rootcap.vercel.app/docs) covers installation,
the core API, widget configuration, and deployment. Exercise integrations on your
target runtime.

## Develop and validate

```sh
npm ci
npm run dev
```

The website and development API run at `http://localhost:3000`. A development-only
fallback secret is provided locally; production requires `ROOTCAP_SECRET`.

```sh
sudo apt-get update && sudo apt-get install -y redis-server redis-tools
npm run check
ROOTCAP_REDIS_INTEGRATION=1 npm test
bash scripts/install-demo.sh
npm run build --prefix demo
npm test --prefix demo
```

`npm run check` runs formatting, lint, type checks, unit tests, and website,
library, and declaration builds. Redis integration tests require `redis-server`
on PATH. The standalone demo script builds and installs the exact package archive
before testing it; see [demo setup](demo/README.md).

```sh
npm run bench:pow -- 20
npm pack --dry-run
```

The benchmark reports local Node timings for each profile. Measure real browser
performance before selecting production settings. Package creation rebuilds the
library and declarations and excludes website assets.

## License

[MIT](LICENSE)

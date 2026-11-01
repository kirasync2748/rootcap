<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:5f6554f918ee6e482c58ce6f9d4f4d695ce30e254cbe003fdebff0041917f719 -->

# rootcap

A privacy-first, self-hosted captcha alternative powered by proof-of-work.

No puzzles, no tracking, no third parties. Your visitors' browsers solve
tiny cryptographic challenges in the background — no clicking traffic lights,
no behavioural surveillance.

**Live demo:** <https://rootcap.vercel.app>

## Features

- **No puzzles** — proof-of-work challenges are solved silently in a Web Worker.
- **No tracking** — zero cookies, zero fingerprints sent to third parties.
- **Self-hosted** — runs on your own server or serverless (Vercel, Cloudflare, etc.).
- **Stateless** — challenge tokens are signed JWTs; no database required.
- **Featherlight** — zero runtime dependencies.

## Tech stack

- Node 26.13.0 LTS (also tested on Node 24)
- TypeScript
- Vite 8
- SCSS (dart-sass)
- Web Workers + Web Crypto API
- HS256 signed JWTs (node:crypto)

## Getting started

```sh
npm install
npm run dev        # http://localhost:3000
```

Set `ROOTCAP_SECRET` to a long random string (see `.env.example`):

```sh
export ROOTCAP_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
```

## How it works

1. **Your server issues challenges** — `generateChallenge(secret, opts)` returns
   a set of proof-of-work challenges and a signed JWT token.
2. **The widget solves silently** — a Web Worker finds a nonce for each
   challenge while the visitor sees a simple checkbox.
3. **The server verifies the proof** — `validateChallenge(secret, body, opts)`
   checks the solutions against the signed token and issues a short-lived
   redeem token for your form.

## Usage

### Install

```sh
npm install rootcap
```

### Server

```typescript
import { generateChallenge, validateChallenge, verifyToken } from "rootcap";

const secret = process.env.ROOTCAP_SECRET;

// Issue challenges
app.get("/api/challenge", (_req, res) => {
  res.json(generateChallenge(secret, { scope: "signup" }));
});

// Verify solutions
app.post("/api/verify", (req, res) => {
  const result = validateChallenge(secret, req.body, { scope: "signup" });
  res.json(result);
});

// Verify the redeem token on form submission
app.post("/signup", (req, res) => {
  if (!verifyToken(secret, req.body["rootcap-token"])) {
    return res.status(403).json({ error: "captcha failed" });
  }
  // Process the form...
});
```

### Client

```html
<script type="module">
  import "rootcap/widget";
</script>

<form action="/signup" method="POST">
  <input name="email" type="email" required />
  <rootcap-widget data-scope="signup" name="rootcap-token"></rootcap-widget>
  <button type="submit">Sign up</button>
</form>
```

### Demo project

A complete working example lives in the `demo/` directory. See
[`demo/README.md`](demo/README.md) for instructions.

## Testing

```sh
npm test            # run tests once
npm run test:watch  # run tests in watch mode
npm run typecheck   # type-check without emitting
npm run lint        # run ESLint
npm run format      # format with Prettier
npm run format:check # check formatting without writing
```

## CI/CD

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and
pull request. It checks formatting, linting, type-checking, and tests.

## Deployment

### Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Set `ROOTCAP_SECRET` in Vercel environment variables.
4. Deploy — the included `vercel.json` and `api/` directory are pre-configured.

The app is live at <https://rootcap.vercel.app>.

### Node.js server

```typescript
import { generateChallenge, validateChallenge } from "rootcap";
import http from "node:http";

const secret = process.env.ROOTCAP_SECRET;

http
  .createServer((req, res) => {
    if (req.url === "/api/challenge") {
      res.end(JSON.stringify(generateChallenge(secret)));
    }
  })
  .listen(3000);
```

### Docker (self-host the demo site)

The included `Dockerfile` builds the website and the library, then serves both
from a single container — static site plus `/api/challenge`, `/api/verify` and
`/api/stats` (`server.mjs`). No database or volume required.

```sh
git clone https://github.com/kirasync2748/rootcap.git
cd rootcap
docker build -t rootcap .
docker run -d -p 3000:3000 -e ROOTCAP_SECRET=your-secret rootcap
# → open http://localhost:3000
```

Without Docker you can build and serve it on any Node.js 26.13.0 host:

```sh
npm ci
npm run build
cp -r dist site        # set the site build aside
npm run build:lib     # library bundle → dist/
ROOTCAP_SECRET=your-secret npm start   # serves site/ + API on :3000
```

## Publishing to npm

This project is structured as an npm package (v1.1.0). The `lib/` directory
contains the core library and widget; `src/` contains the demo website.

### Build the package

```sh
npm run build:lib
```

This compiles the library to `dist/` using Vite library mode, producing ESM
bundles for both the core library and the widget.

### Publish with a trusted publisher

Configure the rootcap package on npm → Settings → Trusted Publisher → GitHub Actions:

- Organization or user: `kirasync2748`
- Repository: `rootcap`
- Workflow filename: `publish.yml`
- Environment: leave blank (the workflow does not use an environment).

Keep “Require two-factor authentication and disallow bypass 2fa tokens” enabled.
No npm token secret is needed. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
This npm account setting must be saved by a package maintainer before the first release.

After merging the release changes into main, create and push the matching tag:

```sh
git tag v1.1.0
git push origin v1.1.0
```

The workflow tests Node 24 and 26.13.0, checks formatting, lint and types,
builds the website, library, declarations and demo, and checks the package.
Only after these checks pass does it verify the tag matches package.json
and publish with OIDC and provenance. A failed check prevents publishing.
The `prepack` hook also builds JavaScript and declarations for local tarballs.

### Security and compatibility

Version 1.1.0 retains Node >=24 compatibility; development, Docker and publishing
use Node 26.13.0. Challenge counts must be integers from 1–1000, difficulty
must be an integer from 1–256, and lifetimes must be positive safe integers.
Invalid options now throw RangeError; malformed signed claims fail verification.
Production API handlers require ROOTCAP_SECRET (at least 16 characters).
Only the Vite development server may use the development fallback key.

Use `verifyToken(secret, token, { scope: "signup" })` to bind redemption to
an operation. Tokens remain stateless and reusable until expiry: applications
requiring one-time redemption must track consumed tokens server-side. Proof of
work raises the cost of automation; it does not establish a user's identity.
Add application-level rate limits appropriate to your deployment.

The widget participates in native FormData, exposes `reset()`, resets on form
reset and token expiry, and emits `rootcap:verified` and `rootcap:reset` events.

### What gets published

- `dist/` — compiled ESM bundles and generated TypeScript declaration files

Users can import from two entry points:

| Import                                        | Description           |
| --------------------------------------------- | --------------------- |
| `import { generateChallenge } from "rootcap"` | Core library          |
| `import "rootcap/widget"`                     | Widget custom element |

<!-- /coderabbit-ai-generated:v1 -->

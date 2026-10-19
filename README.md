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

- Node 24
- TypeScript
- Vite 6
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

Without Docker you can build and serve it on any Node.js 24 host:

```sh
npm ci
npm run build
cp -r dist site        # set the site build aside
npm run build:lib     # library bundle → dist/
ROOTCAP_SECRET=your-secret npm start   # serves site/ + API on :3000
```

## Publishing to npm

This project is structured as an npm package (v1.0.0). The `lib/` directory
contains the core library and widget; `src/` contains the demo website.

### Build the package

```sh
npm run build:lib
```

This compiles the library to `dist/` using Vite library mode, producing ESM
bundles for both the core library and the widget.

### Publish to the npm registry

1. **Log in to npm:**

   ```sh
   npm login
   ```

   Enter your npm username, password, email, and one-time password.

2. **Bump the version** (if needed):

   ```sh
   npm version 1.0.0
   ```

3. **Build and publish:**
   ```sh
   npm publish
   ```
   The `prepublishOnly` script automatically runs `build:lib` and
   `build:types` before publishing, producing the ESM bundles and the
   TypeScript declaration files that ship in the package.

### What gets published

- `dist/` — compiled ESM bundles and generated TypeScript declaration files

Users can import from two entry points:

| Import                                        | Description           |
| --------------------------------------------- | --------------------- |
| `import { generateChallenge } from "rootcap"` | Core library          |
| `import "rootcap/widget"`                     | Widget custom element |

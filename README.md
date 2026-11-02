# rootcap

**A little proof. A lot of privacy.**

rootcap is a self-hosted alternative to CAPTCHA. Instead of asking people to
solve puzzles, it uses small proof-of-work challenges to make automated requests
more expensive. Your visitors see a simple verification widget; their browser
does the work in the background.

[![CI](https://github.com/kirasync2748/rootcap/actions/workflows/ci.yml/badge.svg)](https://github.com/kirasync2748/rootcap/actions/workflows/ci.yml)
[![Publish](https://github.com/kirasync2748/rootcap/actions/workflows/publish.yml/badge.svg)](https://github.com/kirasync2748/rootcap/actions/workflows/publish.yml)

---

[Try the live demo](https://rootcap.vercel.app) ·
[Source code](https://github.com/kirasync2748/rootcap.git) ·

## Why rootcap?

- **No visual puzzles.** The widget solves challenges in a Web Worker.
- **Privacy first.** No tracking cookies or third-party verification service.
- **Yours to host.** Run the API on your own Node.js server.
- **Stateless.** Signed tokens carry the challenge details; no database is needed.
- **Lightweight.** The package has no runtime dependencies.
- **Customisable.** Match the widget's colours and shape to your application.

## How it works

1. Your server creates a set of challenges and signs their details.
2. The visitor selects the widget; a Web Worker solves the challenges.
3. Your server checks the solutions and returns a short-lived redeem token.
4. Your application checks that token when the form is submitted.

Proof of work raises the cost of automation; it does not identify a person.
Redeem tokens can be reused until they expire, so applications that require
one-time use need to record consumed tokens. Apply rate limits to your endpoints.

## Get started

You will need Node.js 24 or later, a modern browser, and a secure context such
as HTTPS or localhost for Web Crypto. The examples use Express for the server
and a frontend bundler such as Vite for the widget.

### 1. Install

When rootcap 1.2.0 is available on npm, install it alongside Express:

```sh
npm install rootcap@1.2.0 express
```

The 1.2.0 code on this branch can also be tried locally using the
[demo instructions](demo/README.md).

### 2. Add the server routes

Generate a long random `ROOTCAP_SECRET` and keep it private. Use the same secret
on every server that issues or verifies tokens. The included API handlers require
at least 16 characters.

```sh
export ROOTCAP_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
```

Add the following routes to an Express application. The example uses the
`signup` scope for both proof verification and form submission.

```javascript
import express from "express";
import { generateChallenge, validateChallenge, verifyToken } from "rootcap";

const secret = process.env.ROOTCAP_SECRET;
if (!secret || secret.length < 16) throw new Error("Set ROOTCAP_SECRET");

const app = express();
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: false, limit: "64kb" }));

app.get("/api/challenge", (_req, res) => {
  res.json(generateChallenge(secret, { scope: "signup" }));
});

app.post("/api/verify", (req, res) => {
  res.json(validateChallenge(secret, req.body, { scope: "signup" }));
});

app.post("/signup", (req, res) => {
  if (!verifyToken(secret, req.body["rootcap-token"], { scope: "signup" })) {
    return res.status(403).json({ error: "captcha failed" });
  }
  // Process the form after verifying the token.
  return res.json({ success: true });
});

app.listen(3000);
```

This example leaves static file serving and application-specific form handling
to your application. Keep the endpoints on the same origin as your form, or
configure CORS and the form action for your chosen origins.

### 3. Add the widget

Import the widget through your frontend bundler. A bare npm import is not
resolved by the browser on its own.

```html
<script type="module">
  import "rootcap/widget";
</script>

<form action="/signup" method="POST">
  <input name="email" type="email" required />
  <rootcap-widget data-scope="signup" name="rootcap-token" required></rootcap-widget>
  <button type="submit">Sign up</button>
</form>
```

The widget contributes the redeem token to the form. `required` enables native
form validation; your server must still verify the token. If your API is on a
different origin, set `data-api` to its base URL and allow the frontend origin
through CORS, including the JSON POST preflight.

## Configuration

| Option       | Default   | What it does                                    |
| ------------ | --------- | ----------------------------------------------- |
| `count`      | `50`      | Number of challenges, from 1 to 1,000.          |
| `difficulty` | `4`       | Leading zero bits required, from 1 to 16.       |
| `expiresMs`  | `600000`  | Challenge lifetime in milliseconds.             |
| `tokenTtlMs` | `1200000` | Redeem token lifetime in milliseconds.          |
| `scope`      | none      | Binds a token to an operation such as `signup`. |

The widget sends `data-scope` as a query parameter. Your server chooses its own
scope; `createApiHandler` ignores that parameter. Match the server's configured
scope to the widget and check it again when redeeming the token. The widget's
scope defaults to `default`; the optional Node adapter defaults to `demo`.

## Make it yours

Set CSS custom properties on the widget to suit your colours and design:

```css
rootcap-widget {
  --rc-primary: #4f46e5;
  --rc-verified-surface: #eef2ff;
  --rc-on-primary: #ffffff;
  --rc-focus: #3730a3;
  --rc-radius: 8px;
}
```

Listen for `rootcap:verified`, `rootcap:progress`, `rootcap:error`,
`rootcap:expired` and `rootcap:reset` to respond to verification changes.
The widget also exposes `execute()`, `getResponse()` and `reset()` for
applications that need programmatic control.

## Explore the project

- [Standalone demo](demo/README.md) — run a complete example using the local package.
- [Website documentation](https://rootcap.vercel.app/docs) — browse the API and widget guide.
- [Changelog](CHANGELOG.md) — see what changed in each version.

The package provides three entry points: `rootcap` for the core API,
`rootcap/widget` for the custom element, and `rootcap/server` for the optional
Node HTTP adapter.

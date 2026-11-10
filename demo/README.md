# rootcap demo

A minimal project showing how to integrate rootcap into your app.

## Run the demo

From the repository root:

```sh
npm ci
bash scripts/install-demo.sh
npm run dev --prefix demo   # http://localhost:3001
```

The script builds and packs rootcap, installs the resulting npm archive into the
standalone demo, and checks its version against the library. Run it again after
changing the library. The `file:..` dependency supports development against this
checkout. In your own application, install the package with `npm install rootcap`.

## Production smoke test

After installing the packed library and building the demo, run from the repository root:

```sh
npm run build --prefix demo
export ROOTCAP_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
npm start --prefix demo
```

The production demo server imports `rootcap/server` from the installed package.

The static Vite build alone does not include a backend. Deploy it with the Node
server or implement the same API in your own backend. `npm run preview` is only
for viewing static output; use the server above to test verification.

The Submit button calls `/api/submit`, which verifies the token with the `demo`
scope before reporting success. No name or other form data is stored. Token expiry
clears verification and pending submissions. The development API uses the same
bounded JSON and method handling as production. Never use the development fallback
secret in production.

## How it works

### Server side

The Vite config (`vite.config.ts`) uses `createApiHandler` from `rootcap/server`.
The server fixes the scope to `demo` and provides challenge, verification,
statistics and example submission endpoints:

```typescript
import { defineConfig, type PluginOption } from "vite";
import { createApiHandler } from "rootcap/server";

const apiPlugin: PluginOption = {
  name: "rootcap-demo-api",
  configureServer(server) {
    const api = createApiHandler({ demoSubmit: true });
    server.middlewares.use((req, res, next) => {
      void api(req, res)
        .then((handled) => {
          if (!handled) next();
        })
        .catch(next);
    });
  },
};
export default defineConfig({
  plugins: [apiPlugin],
  server: { host: "0.0.0.0", port: 3001 },
});
```

The adapter handles `GET` and `HEAD` for `/api/challenge` and `/api/stats`,
and `POST` for `/api/verify` and `/api/submit`. It returns 405 for unsupported
methods and lets other routes continue to Vite. The demo submission endpoint
verifies that the redeem token has the `demo` scope before accepting it.

### Client side

The widget is imported in `src/main.ts`:

```typescript
import "rootcap/widget";
```

And dropped into the HTML form:

```html
<rootcap-widget data-scope="demo" name="rootcap-token"></rootcap-widget>
```

## Using rootcap in your own project

Once rootcap 1.3.0 is published to npm, install it and the separately maintained
Express framework used in this example:

```sh
npm install rootcap@1.3.0 express
```

### Server

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

### Client

Bundle the widget import with a tool such as Vite and serve the API and form
from the same origin. If the API is on another origin, set the widget's
`data-api` to the backend origin and enable CORS for the frontend origin,
including the JSON POST preflight. Route the form's `action` to the application
submission endpoint directly or through a proxy.

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

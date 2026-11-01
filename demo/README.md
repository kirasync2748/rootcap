<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:2816bbe9dd48cb93260f6fd213551107704b159ae8386bb9ff594d22f5bcfc3f -->

# rootcap demo

A minimal project showing how to integrate rootcap into your app.

## Prerequisites

Build the rootcap library first (from the repo root):

```sh
npm run build:lib
npm run build:types
```

This compiles `lib/` to `dist/` so the `file:..` dependency resolves.

## Run

```sh
cd demo
npm ci
npm run dev   # http://localhost:3001
```

## How it works

### Server side

The Vite config (`vite.config.ts`) adds two API endpoints using rootcap's
core library:

```typescript
import { generateChallenge, validateChallenge } from "rootcap";

// GET /api/challenge — issue proof-of-work challenges
// POST /api/verify    — validate solutions, return a redeem token
```

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

Once rootcap is published to npm:

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
  res.json(validateChallenge(secret, req.body, { scope: "signup" }));
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

<!-- /coderabbit-ai-generated:v1 -->

import { addCopyButtons } from "../utils/code-copy";

const SECTIONS = [
  { id: "docs-intro", label: "Introduction" },
  { id: "docs-install", label: "Installation" },
  { id: "docs-quickstart", label: "Quick start" },
  { id: "docs-server", label: "Server API" },
  { id: "docs-widget", label: "Widget" },
  { id: "docs-config", label: "Configuration" },
  { id: "docs-deploy", label: "Deployment" },
  { id: "docs-pow", label: "Proof of work" },
  { id: "docs-faq", label: "FAQ" },
];

export function renderDocs(app: HTMLElement) {
  app.innerHTML = `
    <div class="docs-hero">
      <div class="container">
        <p class="section-eyebrow">Documentation</p>
        <h1 class="docs-hero-title">rootcap docs</h1>
        <p class="docs-hero-lead">Everything you need to integrate privacy-first captcha into your app.</p>
      </div>
    </div>

    <div class="container docs-layout">
      <div class="docs-mobile-nav">
        <button class="docs-mobile-nav-toggle" id="docs-mobile-nav-toggle" aria-expanded="false">
          <span>Contents</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <nav class="docs-mobile-nav-list" id="docs-mobile-nav-list" hidden aria-label="Docs sections">
          ${SECTIONS.map((s) => `<a href="#${s.id}" class="docs-nav-link" data-target="${s.id}">${s.label}</a>`).join("")}
        </nav>
      </div>
      <aside class="docs-sidebar" id="docs-sidebar">
        <nav aria-label="Docs sections">
          ${SECTIONS.map((s) => `<a href="#${s.id}" class="docs-nav-link" data-target="${s.id}">${s.label}</a>`).join("")}
        </nav>
      </aside>

      <div class="docs-content">
        <section id="docs-intro" class="docs-section">
          <h2>Introduction</h2>
          <p>
            rootcap is a privacy-first, self-hosted captcha alternative. Instead of
            asking your visitors to solve visual puzzles, rootcap has the browser
            silently complete small <strong>proof-of-work</strong> challenges in the
            background. There is no tracking, no third-party script, and no
            behavioural surveillance.
          </p>
          <p>
            The server generates a batch of challenges and signs them with an HS256
            JWT. The widget solves them inside a Web Worker, submits the solutions,
            and receives a short-lived redeem token that you can validate when the
            form is submitted. The entire flow is <strong>stateless</strong> — no
            database, no token store, no session state on the server.
          </p>
          <div class="callout">
            <strong>Design philosophy:</strong> prove that a real browser did
            computational work, without collecting a single byte of user data.
          </div>
        </section>

        <section id="docs-install" class="docs-section">
          <h2>Installation</h2>
          <p>Install the core library and widget with your preferred package manager:</p>
          <pre class="code-block" data-file="terminal"><code><span class="c-comment"># pnpm</span>
pnpm add rootcap

<span class="c-comment"># npm</span>
npm install rootcap

<span class="c-comment"># yarn</span>
yarn add rootcap</code></pre>
          <p>
            The package ships as ESM with zero runtime dependencies. It works in any
            Node.js server (Express, Fastify, Hono, Vercel functions, Cloudflare
            Workers with nodejs_compat, and more) and in any modern browser.
          </p>
        </section>

        <section id="docs-quickstart" class="docs-section">
          <h2>Quick start</h2>

          <h3>1. Set your secret</h3>
          <p>Generate a long random string and store it as an environment variable:</p>
          <pre class="code-block" data-file="terminal"><code><span class="c-comment"># Generate a secret</span>
node -e <span class="c-str">"console.log(require('crypto').randomBytes(48).toString('hex'))"</span>

<span class="c-comment"># .env</span>
ROOTCAP_SECRET=your-generated-secret-here</code></pre>

          <h3>2. Add server endpoints</h3>
          <p>Create a challenge endpoint and a verify endpoint:</p>
          <pre class="code-block" data-file="server.ts"><code><span class="c-key">import</span> { generateChallenge, validateChallenge } <span class="c-key">from</span> <span class="c-str">"rootcap"</span>;

<span class="c-key">const</span> secret = process.env.ROOTCAP_SECRET;

<span class="c-comment">// GET /api/challenge — issue challenges</span>
<span class="c-key">export default async function</span> handler(req, res) {
  res.json(generateChallenge(secret, { scope: <span class="c-str">"signup"</span> }));
}

<span class="c-comment">// POST /api/verify — validate solutions</span>
<span class="c-key">export default async function</span> verify(req, res) {
  <span class="c-key">const</span> body = <span class="c-key">await</span> req.json();
  <span class="c-key">const</span> result = validateChallenge(secret, body, {
    scope: <span class="c-str">"signup"</span>,
  });
  res.json(result);
}</code></pre>

          <h3>3. Add the widget to your form</h3>
          <pre class="code-block" data-file="form.html"><code><span class="c-comment">&lt;!-- Import the widget --&gt;</span>
&lt;script type=<span class="c-str">"module"</span>&gt;
  <span class="c-key">import</span> <span class="c-str">"rootcap/widget"</span>;
&lt;/script&gt;

<span class="c-comment">&lt;!-- Drop it in your form --&gt;</span>
&lt;form action=<span class="c-str">"/signup"</span> method=<span class="c-str">"POST"</span>&gt;
  &lt;input name=<span class="c-str">"email"</span> type=<span class="c-str">"email"</span> required /&gt;
  &lt;rootcap-widget
    data-api=<span class="c-str">"https://api.yoursite.com"</span>
    data-scope=<span class="c-str">"signup"</span>
    name=<span class="c-str">"rootcap-token"</span>&gt;
  &lt;/rootcap-widget&gt;
  &lt;button type=<span class="c-str">"submit"</span>&gt;Sign up&lt;/button&gt;
&lt;/form&gt;</code></pre>
          <p>
            The widget injects a hidden input with the redeem token. When the form
            submits, verify the token on your server with <code>verifyToken()</code>.
          </p>
        </section>

        <section id="docs-server" class="docs-section">
          <h2>Server API</h2>

          <h3>generateChallenge(secret, opts?)</h3>
          <p>Creates a set of proof-of-work challenges and a signed JWT token.</p>
          <table class="docs-table">
            <thead>
              <tr><th>Option</th><th>Type</th><th>Default</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>count</code></td><td>number</td><td>50</td><td>Number of challenges to generate.</td></tr>
              <tr><td><code>difficulty</code></td><td>number</td><td>4</td><td>Leading zero bits required per hash.</td></tr>
              <tr><td><code>expiresMs</code></td><td>number</td><td>600000</td><td>Token lifetime in milliseconds (10 min).</td></tr>
              <tr><td><code>scope</code></td><td>string</td><td>—</td><td>Optional scope bound to the challenge.</td></tr>
            </tbody>
          </table>
          <pre class="code-block" data-file="server.ts"><code><span class="c-key">const</span> challenge = generateChallenge(secret, {
  count: <span class="c-str">50</span>,
  difficulty: <span class="c-str">4</span>,
  expiresMs: <span class="c-str">600_000</span>,
  scope: <span class="c-str">"signup"</span>,
});
<span class="c-comment">// { challenges: [{ s, d }, ...], token: "eyJ...", expires: 1716... }</span></code></pre>

          <h3>validateChallenge(secret, body, opts?)</h3>
          <p>Verifies submitted solutions against the signed token and issues a redeem token on success.</p>
          <table class="docs-table">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>body.token</code></td><td>string</td><td>The challenge JWT from generateChallenge.</td></tr>
              <tr><td><code>body.solutions</code></td><td>number[]</td><td>Array of nonces, one per challenge.</td></tr>
              <tr><td><code>opts.scope</code></td><td>string</td><td>Must match the challenge scope.</td></tr>
              <tr><td><code>opts.tokenTtlMs</code></td><td>number</td><td>Redeem token lifetime (default 1200000 = 20 min).</td></tr>
            </tbody>
          </table>
          <p>Returns <code>{ success: true, token, expires, scope }</code> or <code>{ success: false, reason }</code>.</p>
          <table class="docs-table docs-reasons">
            <thead><tr><th>Reason</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>invalid_body</code></td><td>Request body is not an object.</td></tr>
              <tr><td><code>missing_token</code></td><td>No token provided.</td></tr>
              <tr><td><code>missing_solutions</code></td><td>Solutions missing or not an array.</td></tr>
              <tr><td><code>invalid_token</code></td><td>JWT signature mismatch or malformed.</td></tr>
              <tr><td><code>scope_mismatch</code></td><td>Token scope does not match opts.scope.</td></tr>
              <tr><td><code>expired</code></td><td>Challenge token has expired.</td></tr>
              <tr><td><code>invalid_solutions</code></td><td>Wrong number of solutions.</td></tr>
              <tr><td><code>invalid_solution</code></td><td>A nonce does not satisfy the proof-of-work.</td></tr>
            </tbody>
          </table>

          <h3>verifyToken(secret, token)</h3>
          <p>Validates a previously issued redeem token. Returns <code>true</code> or <code>false</code>.</p>
          <pre class="code-block" data-file="server.ts"><code><span class="c-key">const</span> ok = verifyToken(secret, req.body[<span class="c-str">"rootcap-token"</span>]);
<span class="c-key">if</span> (!ok) <span class="c-key">return</span> res.status(<span class="c-str">403</span>).json({ error: <span class="c-str">"captcha failed"</span> });</code></pre>
        </section>

        <section id="docs-widget" class="docs-section">
          <h2>Widget</h2>
          <p>The widget is a custom element: <code>&lt;rootcap-widget&gt;</code>. It uses Shadow DOM for style isolation.</p>

          <h3>Attributes</h3>
          <table class="docs-table">
            <thead><tr><th>Attribute</th><th>Default</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code>data-api</code></td><td>same origin</td><td>Base URL for the challenge / verify endpoints.</td></tr>
              <tr><td><code>data-scope</code></td><td>"default"</td><td>Challenge scope — must match the server scope.</td></tr>
              <tr><td><code>name</code></td><td>"rootcap-token"</td><td>Name of the hidden input that holds the token.</td></tr>
            </tbody>
          </table>

          <h3>Events</h3>
          <table class="docs-table">
            <thead><tr><th>Event</th><th>Detail</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code>rootcap:verified</code></td><td><code>{ token }</code></td><td>Fired when the widget successfully verifies.</td></tr>
            </tbody>
          </table>
          <pre class="code-block" data-file="client.ts"><code>document.querySelector(<span class="c-str">"rootcap-widget"</span>)
  .addEventListener(<span class="c-str">"rootcap:verified"</span>, (e) =&gt; {
    console.log(<span class="c-str">"Token:"</span>, e.detail.token);
  });</code></pre>

          <h3>Theming</h3>
          <p>Override CSS custom properties on the host element to match your brand:</p>
          <pre class="code-block" data-file="styles.css"><code>rootcap-widget {
  --rc-primary: #6366f1;
  --rc-primary-dark: #4f46e5;
  --rc-surface: #ffffff;
  --rc-border: #e2e8f0;
  --rc-radius: 8px;
}</code></pre>
        </section>

        <section id="docs-config" class="docs-section">
          <h2>Configuration</h2>
          <p>Tune the difficulty and challenge count to balance security and user wait time.</p>
          <table class="docs-table">
            <thead><tr><th>Setting</th><th>Default</th><th>Range</th><th>Notes</th></tr></thead>
            <tbody>
              <tr><td><code>count</code></td><td>50</td><td>1–200</td><td>More challenges = more work for bots.</td></tr>
              <tr><td><code>difficulty</code></td><td>4</td><td>1–16</td><td>Each +1 roughly doubles solve time.</td></tr>
              <tr><td><code>expiresMs</code></td><td>600000</td><td>—</td><td>How long a challenge stays valid.</td></tr>
              <tr><td><code>tokenTtlMs</code></td><td>1200000</td><td>—</td><td>How long the redeem token is valid.</td></tr>
            </tbody>
          </table>
          <div class="callout callout-warn">
            <strong>Tip:</strong> difficulty 4 with 50 challenges typically solves in
            under a second on a modern device. Raise difficulty to 6–8 for stronger
            protection at the cost of a longer wait.
          </div>
        </section>

        <section id="docs-deploy" class="docs-section">
          <h2>Deployment &amp; self-hosting</h2>
          <p>
            rootcap is fully self-hostable. This section covers deploying the
            demo site itself (Vercel, Docker, any Node host) and using the
            library inside your own server. In every case the only thing you
            must provide is a long random <code>ROOTCAP_SECRET</code>.
          </p>

          <h3>1. Generate your secret</h3>
          <pre class="code-block" data-file="terminal"><code>node -e <span class="c-str">"console.log(require('crypto').randomBytes(48).toString('hex'))"</span>
<span class="c-comment"># → store it as ROOTCAP_SECRET wherever you deploy</span></code></pre>
          <div class="callout callout-warn">
            <strong>Important:</strong> the same secret must be used to create
            and verify challenges. If it changes (or differs between
            instances), verification fails.
          </div>

          <h3>2. Deploy the demo site</h3>

          <h4>Vercel</h4>
          <p>The included <code>vercel.json</code> and <code>api/</code> serverless functions are pre-configured — no extra setup:</p>
          <ol>
            <li>Fork or clone this repository and push it to GitHub.</li>
            <li>In Vercel, click <em>New Project</em> and import the repository.</li>
            <li>Add an environment variable <code>ROOTCAP_SECRET</code> with your generated secret.</li>
            <li>Deploy. The API endpoints run as serverless functions automatically.</li>
          </ol>

          <h4>Docker (any VPS)</h4>
          <p>The repository ships with a <code>Dockerfile</code> that builds the site and serves it together with the API from one container:</p>
          <pre class="code-block" data-file="terminal"><code><span class="c-comment"># 1. Clone the repo</span>
git clone https://github.com/kirasync2748/rootcap.git
<span class="c-key">cd</span> rootcap

<span class="c-comment"># 2. Build the image</span>
docker build -t rootcap .

<span class="c-comment"># 3. Run it with your secret</span>
docker run -d -p 3000:3000 -e ROOTCAP_SECRET=your-secret rootcap

<span class="c-comment"># → open http://localhost:3000</span></code></pre>

          <h4>Any Node.js host</h4>
          <p>Without Docker, build the site and library and run the bundled server:</p>
          <pre class="code-block" data-file="terminal"><code>npm ci
npm run build
cp -r dist site        <span class="c-comment"># set the site build aside</span>
npm run build:lib      <span class="c-comment"># library bundle → dist/</span>
ROOTCAP_SECRET=your-secret npm start   <span class="c-comment"># serves site/ + API on :3000</span></code></pre>

          <h3>3. Use rootcap in your own project</h3>
          <p>
            Most users don't deploy this repo at all — they install the npm
            package into their existing backend. The core library works in any
            Node.js framework (Express, Fastify, Hono, Vercel functions,
            Cloudflare Workers with nodejs_compat, and more). See
            <a href="#docs-quickstart">Quick start</a> for the full walkthrough;
            with Express it looks like this:
          </p>
          <pre class="code-block" data-file="server.ts"><code><span class="c-key">import</span> express <span class="c-key">from</span> <span class="c-str">"express"</span>;
<span class="c-key">import</span> { generateChallenge, validateChallenge, verifyToken } <span class="c-key">from</span> <span class="c-str">"rootcap"</span>;

<span class="c-key">const</span> app = express();
<span class="c-key">const</span> secret = process.env.ROOTCAP_SECRET;

app.use(express.json());

<span class="c-comment">// Issue challenges</span>
app.get(<span class="c-str">"/api/challenge"</span>, (_req, res) =&gt; {
  res.json(generateChallenge(secret, { scope: <span class="c-str">"signup"</span> }));
});

<span class="c-comment">// Validate solutions</span>
app.post(<span class="c-str">"/api/verify"</span>, (req, res) =&gt; {
  res.json(validateChallenge(secret, req.body, { scope: <span class="c-str">"signup"</span> }));
});

<span class="c-comment">// Guard the form submission with the redeem token</span>
app.post(<span class="c-str">/signup/</span>, (req, res) =&gt; {
  <span class="c-key">if</span> (!verifyToken(secret, req.body[<span class="c-str">"rootcap-token"</span>])) {
    <span class="c-key">return</span> res.status(<span class="c-str">403</span>).json({ error: <span class="c-str">"captcha failed"</span> });
  }
  <span class="c-comment">// Process the form…</span>
});

app.listen(<span class="c-str">3000</span>);</code></pre>
          <p>
            The library is stateless — no database, no token store, no session
            state — so it scales horizontally with any number of instances.
          </p>
        </section>

        <section id="docs-pow" class="docs-section">
          <h2>How proof-of-work works</h2>
          <p>
            Each challenge consists of a random <strong>salt</strong> and a
            <strong>difficulty</strong> (number of leading zero bits required).
            The solver must find a <strong>nonce</strong> such that:
          </p>
          <pre class="code-block" data-file="formula"><code>SHA-256(salt + nonce)</code></pre>
          <p>
            starts with at least <code>difficulty</code> zero bits. There is no
            shortcut — the only way to find a valid nonce is to try values
            sequentially until one works. A difficulty of 4 means roughly 1 in 16
            random nonces will succeed, so the expected number of attempts is small
            enough to be instant for a real browser but wasteful for a bot sending
            thousands of requests.
          </p>
          <p>
            Salts are derived deterministically from a single seed stored inside the
            signed JWT, so the server never needs to persist challenge state. The
            JWT signature guarantees the challenge was issued by your server and has
            not been tampered with.
          </p>
        </section>

        <section id="docs-faq" class="docs-section">
          <h2>FAQ</h2>

          <div class="faq-item">
            <h3>Is rootcap accessible?</h3>
            <p>Yes. The widget is a single checkbox with proper ARIA attributes. There are no visual puzzles to solve, so it works with screen readers and keyboard navigation out of the box.</p>
          </div>
          <div class="faq-item">
            <h3>Does it work without JavaScript?</h3>
            <p>Proof-of-work requires JavaScript to run the solver. If JavaScript is disabled, the widget cannot verify. You can treat a missing token as a failed verification on the server.</p>
          </div>
          <div class="faq-item">
            <h3>Can a bot still solve the challenges?</h3>
            <p>A determined bot can solve proof-of-work challenges, but it costs them CPU time on every request. This raises the cost of abuse substantially without collecting any user data.</p>
          </div>
          <div class="faq-item">
            <h3>Do I need a database?</h3>
            <p>No. Challenge tokens are signed JWTs and redeem tokens are also signed JWTs. Everything is stateless. If you want replay prevention, you can add a nonce store (e.g. Redis) on top.</p>
          </div>
          <div class="faq-item">
            <h3>What is the widget size?</h3>
            <p>The widget is under 6 KB minified with zero runtime dependencies. It loads instantly and has no impact on page weight.</p>
          </div>
        </section>
      </div>
    </div>
  `;

  // Active section highlighting in sidebar
  const navLinks = app.querySelectorAll(".docs-nav-link");
  const sectionEls = SECTIONS.map((s) => app.querySelector("#" + s.id)).filter(
    Boolean,
  ) as HTMLElement[];

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            navLinks.forEach((link) => {
              link.classList.toggle("active", link.getAttribute("data-target") === id);
            });
          }
        });
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    sectionEls.forEach((el) => observer.observe(el));
  }

  // Mobile docs nav toggle
  const mobileNavToggle = app.querySelector("#docs-mobile-nav-toggle") as HTMLButtonElement | null;
  const mobileNavList = app.querySelector("#docs-mobile-nav-list") as HTMLElement | null;

  mobileNavToggle?.addEventListener("click", () => {
    const isOpen = !mobileNavList?.hasAttribute("hidden");
    if (isOpen) {
      mobileNavList?.setAttribute("hidden", "");
      mobileNavToggle.setAttribute("aria-expanded", "false");
    } else {
      mobileNavList?.removeAttribute("hidden");
      mobileNavToggle.setAttribute("aria-expanded", "true");
    }
  });

  mobileNavList?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mobileNavList?.setAttribute("hidden", "");
      mobileNavToggle?.setAttribute("aria-expanded", "false");
    });
  });

  // Add copy buttons to all code blocks
  addCopyButtons(app);
}

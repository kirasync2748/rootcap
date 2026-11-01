import { addCopyButtons } from "../utils/code-copy";

export function renderHome(app: HTMLElement) {
  app.innerHTML = `
    <section class="hero">
      <div class="hero-dots" aria-hidden="true"></div>
      <div class="container hero-inner">
        <a class="eyebrow release-badge" href="/docs">Introducing rootcap 1.1 <span>Node.js 26 ready ↗</span></a>
        <h1 class="hero-title">A little proof.<br><span class="grad">A lot of privacy.</span></h1>
        <p class="hero-lead">
          Add a quiet layer of protection with proof-of-work challenges solved
          in the browser. No clicking traffic lights, no behavioural
          surveillance, no external scripts watching your users.
        </p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="/#demo">Try the demo</a>
          <a class="btn btn-ghost" href="/docs">Read the docs</a>
        </div>
        <div class="install-command"><span aria-hidden="true">$</span><code>npm install rootcap</code><button type="button" id="copy-install" aria-label="Copy install command">Copy</button></div>
        <div class="hero-stats">
          <div class="stat"><strong>0</strong><span>third parties</span></div>
          <div class="stat"><strong>0</strong><span>cookies set</span></div>
          <div class="stat"><strong>100%</strong><span>open source</span></div>
        </div>
      </div>
      <div class="hero-glow" aria-hidden="true"></div>
    </section>

    <section id="features" class="features">
      <div class="container">
        <p class="section-eyebrow">Features</p>
        <h2 class="section-title">Why rootcap</h2>
        <div class="feature-grid">
          <article class="feature-card">
            <div class="feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <h3>No puzzles</h3>
            <p>Your browser solves tiny cryptographic challenges in the background. No visual puzzles to solve.</p>
          </article>
          <article class="feature-card">
            <div class="feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h3>No tracking</h3>
            <p>Zero cookies, zero fingerprints sent to third parties. Every challenge is generated and verified on your own server.</p>
          </article>
          <article class="feature-card">
            <div class="feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/></svg>
            </div>
            <h3>Self-hosted</h3>
            <p>Run it on your own server or deploy serverless. The core library is stateless — no database required.</p>
          </article>
          <article class="feature-card">
            <div class="feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <h3>Featherlight</h3>
            <p>Zero runtime dependencies. The widget is a fraction of the size of traditional captcha scripts.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="compare">
      <div class="container">
        <p class="section-eyebrow">Comparison</p>
        <h2 class="section-title">rootcap vs traditional captcha</h2>
        <div class="compare-grid">
          <div class="compare-col compare-good">
            <h3>rootcap</h3>
            <ul>
              <li><span class="check" aria-hidden="true"></span> Silent proof-of-work</li>
              <li><span class="check" aria-hidden="true"></span> No user data collected</li>
              <li><span class="check" aria-hidden="true"></span> Runs on your infrastructure</li>
              <li><span class="check" aria-hidden="true"></span> Zero dependencies</li>
              <li><span class="check" aria-hidden="true"></span> Open source</li>
            </ul>
          </div>
          <div class="compare-col compare-bad">
            <h3>Traditional captcha</h3>
            <ul>
              <li><span class="cross" aria-hidden="true"></span> Click traffic lights, crosswalks</li>
              <li><span class="cross" aria-hidden="true"></span> Tracks visitor behaviour</li>
              <li><span class="cross" aria-hidden="true"></span> Relies on third-party servers</li>
              <li><span class="cross" aria-hidden="true"></span> Heavy script payload</li>
              <li><span class="cross" aria-hidden="true"></span> Closed source</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section id="how" class="how">
      <div class="container">
        <p class="section-eyebrow">How it works</p>
        <h2 class="section-title">Three steps, zero friction</h2>
        <ol class="steps">
          <li class="step">
            <span class="step-number">1</span>
            <h3>Your server issues challenges</h3>
            <p>A signed token is created containing proof-of-work parameters. No state is stored — the signature is the source of truth.</p>
          </li>
          <li class="step">
            <span class="step-number">2</span>
            <h3>The widget solves silently</h3>
            <p>A Web Worker finds a nonce for each challenge. The visitor sees a simple checkbox while the work happens off the main thread.</p>
          </li>
          <li class="step">
            <span class="step-number">3</span>
            <h3>The server verifies the proof</h3>
            <p>Solutions are checked against the signed token. On success a short-lived redeem token is issued for your form.</p>
          </li>
        </ol>
      </div>
    </section>

    <section id="demo" class="demo">
      <div class="container demo-inner">
        <p class="section-eyebrow">Live demo</p>
        <h2 class="section-title">See it in action</h2>
        <p class="demo-lead">Click the checkbox below — the widget will solve a batch of challenges in the background and hand you a token.</p>
        <form class="demo-form" id="demo-form" autocomplete="off">
          <div class="form-row">
            <label for="demo-name">Name</label>
            <input id="demo-name" type="text" placeholder="Your name" required />
          </div>
          <div class="form-row" id="demo-verify-row">
            <label>Verification</label>
            <rootcap-widget data-scope="demo" name="rootcap-token"></rootcap-widget>
            <p class="verification-error" id="demo-verify-error" role="alert"></p>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Submit</button>
        </form>
        <div class="demo-result" id="demo-result" hidden>
          <div class="result-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <div>
            <strong>Token received</strong>
            <code id="demo-token"></code>
          </div>
        </div>
      </div>
    </section>

    <section id="code" class="code-section">
      <div class="container">
        <p class="section-eyebrow">Get started</p>
        <h2 class="section-title">Up and running in minutes</h2>
        <div class="code-card">
          <pre class="code-block" data-file="example.ts"><code><span class="c-comment">// Server — create a challenge</span>
<span class="c-key">import</span> { generateChallenge, validateChallenge } <span class="c-key">from</span> <span class="c-str">"rootcap"</span>;

<span class="c-key">const</span> secret = process.env.ROOTCAP_SECRET;

app.get(<span class="c-str">"/api/challenge"</span>, (_req, res) =&gt; {
  res.json(generateChallenge(secret, { scope: <span class="c-str">"signup"</span> }));
});

app.post(<span class="c-str">"/api/verify"</span>, (req, res) =&gt; {
  <span class="c-key">const</span> result = validateChallenge(secret, req.body, {
    scope: <span class="c-str">"signup"</span>,
  });
  res.json(result);
});

<span class="c-comment">// Client — drop in the widget</span>
<span class="c-str">&lt;rootcap-widget data-scope="signup"&gt;&lt;/rootcap-widget&gt;</span></code></pre>
        </div>
      </div>
    </section>

    <section class="cta">
      <div class="container cta-inner">
        <h2 class="cta-title">Ready to ditch puzzle captcha?</h2>
        <p class="cta-lead">Set up rootcap in minutes and give your visitors the privacy they deserve.</p>
        <div class="cta-actions">
          <a class="btn btn-light" href="/docs">Get started</a>
          <a class="btn btn-outline-light" href="https://github.com/kirasync2748/rootcap" target="_blank" rel="noopener">View on GitHub</a>
        </div>
      </div>
    </section>
  `;

  app.querySelector("#copy-install")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    try {
      await navigator.clipboard.writeText("npm install rootcap");
      button.textContent = "Copied!";
    } catch {
      button.textContent = "Select command to copy";
    }
  });

  // Demo form handler
  const form = app.querySelector("#demo-form") as HTMLFormElement | null;
  const result = app.querySelector("#demo-result") as HTMLElement | null;
  const tokenOut = app.querySelector("#demo-token") as HTMLElement | null;
  const verificationError = app.querySelector("#demo-verify-error") as HTMLElement | null;

  form?.addEventListener("rootcap:verified", () => {
    if (verificationError) verificationError.textContent = "";
  });
  const hideResult = () => {
    if (result) result.hidden = true;
  };
  form?.addEventListener("rootcap:reset", hideResult);
  form?.addEventListener("reset", () => {
    if (verificationError) verificationError.textContent = "";
    hideResult();
  });

  form?.addEventListener("submit", (e) => {
    e.preventDefault();

    const token = new FormData(form).get("rootcap-token")?.toString();
    if (!token) {
      if (verificationError) verificationError.textContent = "Please complete verification.";
      if (result) result.hidden = true;
      return;
    }
    if (result && tokenOut) {
      tokenOut.textContent = token.slice(0, 48) + "…";
      result.hidden = false;
    }
  });

  // Add copy buttons to all code blocks
  addCopyButtons(app);
}

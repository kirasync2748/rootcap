import widgetStyles from "./widget.scss?inline";
// Bundled AND inlined by Vite — the worker ships inside the widget bundle as a
// self-contained blob, so it works in the dev server, in production builds and
// when the widget is consumed from the npm package by another bundler.
// (Do not construct this URL by hand: a plain `new URL(..., import.meta.url)`
// makes the build emit the raw .ts file with a non-JavaScript MIME type, which
// browsers reject — the exact cause of "Failed — try again" in production.)
import SolverWorker from "./solver.worker.ts?worker&inline";

/**
 * <rootcap-widget> — a privacy-first captcha widget.
 *
 * The user clicks the checkbox; the widget fetches a set of signed
 * proof-of-work challenges from the server, solves them silently inside a
 * Web Worker, submits the solutions back, and stores the resulting redeem
 * token through ElementInternals so it travels with the form.
 *
 * Attributes:
 *   data-api   — API base URL (default: same origin)
 *   data-scope — challenge scope (default: "default")
 *   name       — submitted form field name for the token (default: "rootcap-token")
 */

type WidgetState = "idle" | "verifying" | "verified" | "error";

interface Challenge {
  s: string;
  d: number;
}

class RootcapWidget extends HTMLElement {
  static formAssociated = true;
  private internals = this.attachInternals();
  private controller: AbortController | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  private state: WidgetState = "idle";
  private worker: Worker | null = null;
  private solveId = 0;
  private shadow: ShadowRoot;

  static get observedAttributes() {
    return ["data-api", "data-scope", "name"];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.render();
  }

  private get apiBase(): string {
    return this.getAttribute("data-api") || "";
  }

  private get scope(): string {
    return this.getAttribute("data-scope") || "default";
  }

  private get inputName(): string {
    return this.getAttribute("name") || "rootcap-token";
  }

  private render() {
    const style = document.createElement("style");
    style.textContent = widgetStyles;
    this.shadow.appendChild(style);

    const box = document.createElement("div");
    box.className = "rc-widget";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "Human verification");

    box.innerHTML = `
      <button class="rc-checkbox" type="button" part="checkbox" aria-pressed="false" aria-label="Verify you are human">
        <span class="rc-checkmark" aria-hidden="true"></span>
        <span class="rc-spinner" aria-hidden="true"></span>
      </button>
      <span class="rc-label" part="label" role="status" aria-live="polite">I am human</span>
      <input type="hidden" class="rc-token"  />
    `;

    this.shadow.appendChild(box);
    (this.shadow.querySelector(".rc-token") as HTMLInputElement).name = this.inputName;

    const checkbox = this.shadow.querySelector(".rc-checkbox") as HTMLButtonElement;
    checkbox.addEventListener("click", () => this.onClick());
  }

  private setState(state: WidgetState, message?: string) {
    this.state = state;
    const box = this.shadow.querySelector(".rc-widget") as HTMLElement;
    const label = this.shadow.querySelector(".rc-label") as HTMLElement;
    const checkbox = this.shadow.querySelector(".rc-checkbox") as HTMLButtonElement;

    box.dataset.state = state;
    checkbox.setAttribute("aria-pressed", state === "verified" ? "true" : "false");
    checkbox.disabled = state === "verifying";

    const messages: Record<WidgetState, string> = {
      idle: "I am human",
      verifying: "Verifying…",
      verified: "Verified",
      error: "Failed — try again",
    };
    label.textContent = message ?? messages[state];
  }

  private async onClick() {
    if (this.state === "verifying") return;
    this.reset();
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    this.setState("verifying");

    try {
      const res = await fetch(
        `${this.apiBase}/api/challenge?scope=${encodeURIComponent(this.scope)}`,
        {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );
      if (!res.ok) throw new Error("challenge request failed");
      const data = (await res.json()) as { challenges: Challenge[]; token: string };
      const solutions = await this.solve(data.challenges, controller.signal);
      const verifyRes = await fetch(`${this.apiBase}/api/verify`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.token, solutions }),
      });
      if (!verifyRes.ok) throw new Error("verify request failed");
      const result = (await verifyRes.json()) as {
        success: boolean;
        token?: string;
        reason?: string;
        expires?: number;
      };
      if (!result.success || !result.token) {
        throw new Error(result.reason || "verification failed");
      }
      if (controller.signal.aborted || this.controller !== controller) return;
      const input = this.shadow.querySelector(".rc-token") as HTMLInputElement;
      input.value = result.token;
      const formValue = new FormData();
      formValue.append(this.inputName, result.token);
      this.internals.setFormValue(formValue);
      if (!Number.isSafeInteger(result.expires) || result.expires! <= Date.now())
        throw new Error("invalid expiry");
      this.expiryTimer = setTimeout(
        () => this.reset(),
        Math.min(result.expires! - Date.now(), 2147483647),
      );
      this.setState("verified");
      this.dispatchEvent(
        new CustomEvent("rootcap:verified", {
          bubbles: true,
          composed: true,
          detail: { token: result.token },
        }),
      );
    } catch {
      if (this.controller === controller) {
        this.internals.setFormValue(null);
        (this.shadow.querySelector(".rc-token") as HTMLInputElement).value = "";
        this.setState("error");
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private solve(challenges: Challenge[], signal: AbortSignal): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const worker = new SolverWorker();
      this.worker = worker;
      const id = ++this.solveId;

      const abort = () => {
        worker.terminate();
        reject(new Error("verification cancelled"));
      };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) {
        abort();
        return;
      }
      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.id !== id) return;
        if (msg.type === "done") {
          signal.removeEventListener("abort", abort);
          worker.terminate();
          this.worker = null;
          resolve(msg.solutions);
        }
      };

      worker.onerror = () => {
        signal.removeEventListener("abort", abort);
        worker.terminate();
        this.worker = null;
        reject(new Error("solver crashed"));
      };

      worker.postMessage({ id, challenges });
    });
  }

  reset() {
    this.controller?.abort();
    this.controller = null;
    this.worker?.terminate();
    this.worker = null;
    clearTimeout(this.expiryTimer);
    this.internals.setFormValue(null);
    (this.shadow.querySelector(".rc-token") as HTMLInputElement).value = "";
    this.setState("idle");
    this.dispatchEvent(new CustomEvent("rootcap:reset", { bubbles: true, composed: true }));
  }

  formResetCallback() {
    this.reset();
  }
  attributeChangedCallback() {
    this.reset();
    (this.shadow.querySelector(".rc-token") as HTMLInputElement).name = this.inputName;
  }
  disconnectedCallback() {
    this.reset();
  }
}

if (!customElements.get("rootcap-widget")) customElements.define("rootcap-widget", RootcapWidget);

export { RootcapWidget };

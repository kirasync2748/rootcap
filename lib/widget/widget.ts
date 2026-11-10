import widgetStyles from "./widget.scss?inline";
import { scheduleExpiry } from "./expiry.js";
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

export interface WidgetMessages {
  group: string;
  button: string;
  idle: string;
  verifying: string;
  verified: string;
  error: string;
  required: string;
}

const defaultMessages: WidgetMessages = {
  group: "Human verification",
  button: "Verify you are human",
  idle: "I am human",
  verifying: "Verifying…",
  verified: "Verified",
  error: "Failed — try again",
  required: "Please complete verification.",
};

class RootcapWidget extends HTMLElement {
  static formAssociated = true;
  private internals = this.attachInternals();
  private formDisabled = false;
  private controller: AbortController | null = null;
  private cancelExpiry: (() => void) | undefined;
  private state: WidgetState = "idle";
  private worker: Worker | null = null;
  private solveId = 0;
  private shadow: ShadowRoot;
  private widgetMessages: WidgetMessages = { ...defaultMessages };
  private autoForm: HTMLFormElement | null = null;
  private readonly onFormFocus = () => {
    if (this.hasAttribute("data-auto") && this.state === "idle") void this.execute();
  };

  static get observedAttributes() {
    return [
      "data-api",
      "data-scope",
      "name",
      "required",
      "disabled",
      "data-timeout",
      "data-max-work",
      "data-worker-src",
      "data-style-nonce",
    ];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.render();
  }

  private get apiBase(): string {
    return (this.getAttribute("data-api") || "").replace(/\/+$/, "");
  }

  private get scope(): string {
    return this.getAttribute("data-scope") || "default";
  }

  private get inputName(): string {
    return this.getAttribute("name") || "rootcap-token";
  }

  private render() {
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
      <progress class="rc-progress" part="progress" max="100" value="0" hidden></progress>
      <input type="hidden" class="rc-token"  />
    `;

    this.shadow.appendChild(box);
    (this.shadow.querySelector(".rc-token") as HTMLInputElement).name = this.inputName;

    const checkbox = this.shadow.querySelector(".rc-checkbox") as HTMLButtonElement;
    checkbox.addEventListener("click", () => this.onClick());
    box.addEventListener("click", (event) => {
      if (!checkbox.contains(event.target as Node) && !checkbox.disabled) checkbox.click();
    });
  }

  private updateStyles() {
    const style = document.createElement("style");
    const nonce = this.getAttribute("data-style-nonce");
    if (nonce) style.nonce = nonce;
    style.textContent = widgetStyles;
    this.shadow.querySelector("style")?.remove();
    this.shadow.prepend(style);
  }

  private setState(state: WidgetState, message?: string) {
    this.state = state;
    const box = this.shadow.querySelector(".rc-widget") as HTMLElement;
    const label = this.shadow.querySelector(".rc-label") as HTMLElement;
    const checkbox = this.shadow.querySelector(".rc-checkbox") as HTMLButtonElement;
    const progress = this.shadow.querySelector(".rc-progress") as HTMLProgressElement;

    box.dataset.state = state;
    checkbox.setAttribute("aria-pressed", state === "verified" ? "true" : "false");
    box.setAttribute("aria-label", this.widgetMessages.group);
    checkbox.setAttribute("aria-label", this.widgetMessages.button);
    progress.setAttribute("aria-label", this.widgetMessages.verifying);
    progress.hidden = state !== "verifying";
    if (state !== "verifying") progress.value = 0;
    checkbox.disabled = this.formDisabled || this.hasAttribute("disabled") || state === "verifying";
    this.internals.setValidity(
      this.hasAttribute("required") && state !== "verified" ? { valueMissing: true } : {},
      this.hasAttribute("required") && state !== "verified" ? this.widgetMessages.required : "",
      checkbox,
    );

    label.textContent = message ?? this.widgetMessages[state];
  }

  /** Replace visible and accessible strings for the current locale. */
  set messages(messages: Partial<WidgetMessages>) {
    this.widgetMessages = { ...defaultMessages, ...messages };
    this.setState(this.state);
  }

  get messages(): WidgetMessages {
    return { ...this.widgetMessages };
  }

  private onClick() {
    void this.execute();
  }

  /** Read the current redeem token; empty before verification or after reset. */
  getResponse(): string {
    return (this.shadow.querySelector(".rc-token") as HTMLInputElement).value;
  }

  /** Start verification; failures are reported through rootcap:error. */
  async execute(): Promise<void> {
    if (this.formDisabled || this.hasAttribute("disabled") || this.state === "verifying") return;
    this.reset();
    const controller = new AbortController();
    this.controller = controller;
    const configuredTimeout = Number(this.getAttribute("data-timeout"));
    const timeoutMs =
      Number.isSafeInteger(configuredTimeout) &&
      configuredTimeout > 0 &&
      configuredTimeout <= 600000
        ? configuredTimeout
        : 60000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
      if (
        !Array.isArray(data.challenges) ||
        data.challenges.length < 1 ||
        data.challenges.length > 1000 ||
        typeof data.token !== "string" ||
        !data.token ||
        data.token.length > 16384 ||
        data.challenges.some(
          (c) =>
            !c ||
            typeof c.s !== "string" ||
            !/^[a-f0-9]{64}$/.test(c.s) ||
            !Number.isInteger(c.d) ||
            c.d < 1 ||
            c.d > 16,
        )
      )
        throw new Error("invalid challenge response");
      const maxWork = Number(this.getAttribute("data-max-work"));
      if (
        Number.isSafeInteger(maxWork) &&
        maxWork > 0 &&
        data.challenges.reduce((total, c) => total + 2 ** c.d, 0) > maxWork
      )
        throw new Error("challenge exceeds work limit");
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
      if (result.success !== true || typeof result.token !== "string" || !result.token) {
        throw new Error(result.reason || "verification failed");
      }
      if (this.controller !== controller) return;
      if (controller.signal.aborted) throw new Error("verification timed out");
      const input = this.shadow.querySelector(".rc-token") as HTMLInputElement;
      input.value = result.token;
      const formValue = new FormData();
      formValue.append(this.inputName, result.token);
      this.internals.setFormValue(formValue);
      if (!Number.isSafeInteger(result.expires) || result.expires! <= Date.now())
        throw new Error("invalid expiry");
      this.setState("verified");
      this.cancelExpiry = scheduleExpiry(result.expires!, () => {
        this.reset();
        this.dispatchEvent(new CustomEvent("rootcap:expired", { bubbles: true, composed: true }));
      });
      this.dispatchEvent(
        new CustomEvent("rootcap:verified", {
          bubbles: true,
          composed: true,
          detail: { token: result.token, expires: result.expires },
        }),
      );
    } catch (error) {
      if (this.controller === controller) {
        this.internals.setFormValue(null);
        (this.shadow.querySelector(".rc-token") as HTMLInputElement).value = "";
        this.setState("error");
        this.dispatchEvent(
          new CustomEvent("rootcap:error", {
            bubbles: true,
            composed: true,
            detail: {
              reason: controller.signal.aborted
                ? "timeout"
                : error instanceof Error
                  ? error.message
                  : "verification failed",
            },
          }),
        );
      }
    } finally {
      clearTimeout(timeout);
      if (this.controller === controller) this.controller = null;
    }
  }

  private solve(challenges: Challenge[], signal: AbortSignal): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const workerSrc = this.getAttribute("data-worker-src");
      const worker = workerSrc
        ? new Worker(new URL(workerSrc, document.baseURI), { type: "module" })
        : new SolverWorker();
      this.worker = worker;
      const id = ++this.solveId;

      const abort = () => {
        worker.terminate();
        if (this.worker === worker) this.worker = null;
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
        if (msg.type === "progress") {
          const progress = this.shadow.querySelector(".rc-progress") as HTMLProgressElement;
          progress.value = Math.round((msg.index / msg.total) * 100);
          this.dispatchEvent(
            new CustomEvent("rootcap:progress", {
              bubbles: true,
              composed: true,
              detail: { completed: msg.index, total: msg.total },
            }),
          );
        }
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

      try {
        worker.postMessage({ id, challenges });
      } catch (error) {
        signal.removeEventListener("abort", abort);
        worker.terminate();
        this.worker = null;
        reject(error);
      }
    });
  }

  reset() {
    this.controller?.abort();
    this.controller = null;
    this.worker?.terminate();
    this.worker = null;
    this.cancelExpiry?.();
    this.cancelExpiry = undefined;
    this.internals.setFormValue(null);
    (this.shadow.querySelector(".rc-token") as HTMLInputElement).value = "";
    this.setState("idle");
    this.dispatchEvent(new CustomEvent("rootcap:reset", { bubbles: true, composed: true }));
  }

  /** Cancel an in-flight attempt and clear any response. */
  cancel() {
    this.reset();
  }

  private connectAutoForm(form: HTMLFormElement | null) {
    this.autoForm?.removeEventListener("focusin", this.onFormFocus);
    this.autoForm = form;
    this.autoForm?.addEventListener("focusin", this.onFormFocus);
  }

  connectedCallback() {
    this.updateStyles();
    this.connectAutoForm(this.internals.form);
    this.setState(this.state);
  }

  formResetCallback() {
    this.reset();
  }
  formAssociatedCallback(form: HTMLFormElement | null) {
    if (this.isConnected) this.connectAutoForm(form);
  }
  formDisabledCallback(disabled: boolean) {
    this.formDisabled = disabled;
    if (disabled) this.reset();
    else this.setState(this.state);
  }
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;
    if (name === "data-style-nonce") {
      if (this.isConnected) this.updateStyles();
      return;
    }
    if (name === "required") {
      this.setState(this.state);
      return;
    }
    this.reset();
    (this.shadow.querySelector(".rc-token") as HTMLInputElement).name = this.inputName;
  }
  disconnectedCallback() {
    this.connectAutoForm(null);
    this.reset();
  }
}

if (!customElements.get("rootcap-widget")) customElements.define("rootcap-widget", RootcapWidget);

export { RootcapWidget };

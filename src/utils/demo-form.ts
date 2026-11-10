/** Connect a demo form to rootcap 1.3 controls and server-side token verification. */
export function setupDemoForm(
  form: HTMLFormElement,
  result: HTMLElement,
  tokenOut: HTMLElement,
  error: HTMLElement,
) {
  const status = form.querySelector<HTMLElement>("[data-verification-status]")!;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  let pending: AbortController | undefined;

  const clearSubmission = () => {
    pending?.abort();
    pending = undefined;
    button.disabled = false;
    form.removeAttribute("aria-busy");
    result.hidden = true;
    tokenOut.textContent = "";
    error.textContent = "";
  };
  const resetFeedback = () => {
    clearSubmission();
    status.textContent = "Ready to verify.";
  };
  form.addEventListener("rootcap:reset", resetFeedback, options);
  form.addEventListener("reset", resetFeedback, options);
  form.addEventListener(
    "rootcap:progress",
    () => {
      status.textContent = "";
    },
    options,
  );
  form.addEventListener(
    "rootcap:verified",
    () => {
      error.textContent = "";
      status.textContent = "Verification complete. Submit the form to verify with the server.";
    },
    options,
  );
  form.addEventListener(
    "rootcap:expired",
    () => {
      clearSubmission();
      status.textContent = "Verification expired. Please verify again.";
    },
    options,
  );
  form.addEventListener(
    "rootcap:error",
    (event) => {
      clearSubmission();
      status.textContent = "";
      const { reason } = (event as CustomEvent<{ reason: string }>).detail;
      error.textContent =
        reason === "timeout"
          ? "Verification timed out. Please try again."
          : "Verification failed. Please try again.";
    },
    options,
  );
  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      clearSubmission();
      const token = new FormData(form).get("rootcap-token")?.toString();
      if (!token) {
        error.textContent = "Please complete verification.";
        return;
      }
      const controller = new AbortController();
      pending = controller;
      button.disabled = true;
      form.setAttribute("aria-busy", "true");
      status.textContent = "Checking the token with the server…";
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok || body.success !== true) throw new Error("Submission rejected");
        if (pending !== controller || controller.signal.aborted || !form.isConnected) return;
        tokenOut.textContent = token.slice(0, 48) + "…";
        result.hidden = false;
        status.textContent = "The server accepted your verification.";
      } catch {
        if (pending === controller && form.isConnected) {
          status.textContent = "";
          error.textContent = "Submission failed. Check your connection and verify again.";
        }
      } finally {
        clearTimeout(timeout);
        if (pending === controller) {
          pending = undefined;
          button.disabled = false;
          form.removeAttribute("aria-busy");
        }
      }
    },
    options,
  );
  resetFeedback();
  return () => {
    listeners.abort();
    clearSubmission();
  };
}

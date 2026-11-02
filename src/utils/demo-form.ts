/** Wire an example form to server-side redeem-token verification. No form data is saved. */
export function setupDemoForm(
  form: HTMLFormElement,
  result: HTMLElement,
  tokenOut: HTMLElement,
  error: HTMLElement,
) {
  let pending: AbortController | undefined;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const hideResult = () => {
    pending?.abort();
    pending = undefined;
    button.disabled = false;
    result.hidden = true;
    error.textContent = "";
  };
  form.addEventListener("rootcap:reset", hideResult);
  form.addEventListener("reset", hideResult);
  form.addEventListener("rootcap:verified", () => {
    error.textContent = "";
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideResult();
    const token = new FormData(form).get("rootcap-token")?.toString();
    if (!token) {
      error.textContent = "Please complete verification.";
      return;
    }
    const controller = new AbortController();
    pending = controller;
    button.disabled = true;
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
    } catch {
      if (pending === controller && form.isConnected)
        error.textContent = "Submission failed. Check your connection and verify again.";
    } finally {
      clearTimeout(timeout);
      if (pending === controller) {
        pending = undefined;
        button.disabled = false;
      }
    }
  });
  return () => {
    pending?.abort();
  };
}

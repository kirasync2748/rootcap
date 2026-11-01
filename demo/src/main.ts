// Importing "rootcap/widget" registers the <rootcap-widget> custom element.
import "rootcap/widget";

document.getElementById("form")?.addEventListener("submit", (e) => {
  e.preventDefault();

  const token = new FormData(document.getElementById("form") as HTMLFormElement)
    .get("rootcap-token")
    ?.toString();
  if (!token) {
    alert("Please complete the verification first.");
    return;
  }
  const result = document.getElementById("result");
  const tokenEl = document.getElementById("token");
  if (result && tokenEl) {
    tokenEl.textContent = token.slice(0, 48) + "…";
    result.hidden = false;
  }
});

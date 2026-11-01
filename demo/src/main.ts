// Importing "rootcap/widget" registers the <rootcap-widget> custom element.
import "rootcap/widget";

const form = document.getElementById("form") as HTMLFormElement | null;
const result = document.getElementById("result");
const hideResult = () => {
  if (result) result.hidden = true;
};
form?.addEventListener("rootcap:reset", hideResult);
form?.addEventListener("reset", hideResult);
form?.addEventListener("submit", (e) => {
  e.preventDefault();
  hideResult();

  const token = new FormData(form).get("rootcap-token")?.toString();
  if (!token) {
    alert("Please complete the verification first.");
    return;
  }
  const tokenEl = document.getElementById("token");
  if (result && tokenEl) {
    tokenEl.textContent = token.slice(0, 48) + "…";
    result.hidden = false;
  }
});

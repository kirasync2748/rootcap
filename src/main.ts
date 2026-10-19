import "../lib/widget/widget";
import "./app.scss";
import "./docs.scss";
import { renderHome } from "./pages/home";
import { renderDocs } from "./pages/docs";
import { renderDashboard } from "./pages/dashboard";
import { renderNotFound } from "./pages/not-found";
import { renderServerError } from "./pages/server-error";

// Mobile nav toggle
const navToggle = document.getElementById("nav-toggle")!;
const mobileNav = document.getElementById("mobile-nav")!;

function closeMobileNav() {
  mobileNav.hidden = true;
  navToggle.setAttribute("aria-expanded", "false");
  navToggle.classList.remove("open");
}

navToggle.addEventListener("click", () => {
  const open = mobileNav.hidden;
  mobileNav.hidden = !open;
  navToggle.setAttribute("aria-expanded", String(open));
  navToggle.classList.toggle("open", open);
});

function navigate() {
  const app = document.getElementById("app")!;
  const path = location.pathname;

  try {
    if (path === "/docs") {
      renderDocs(app);
      document.body.dataset.page = "docs";
    } else if (path === "/dashboard") {
      renderDashboard(app);
      document.body.dataset.page = "dashboard";
    } else if (path === "/" || path === "") {
      renderHome(app);
      document.body.dataset.page = "home";
    } else {
      renderNotFound(app);
      document.body.dataset.page = "not-found";
    }
  } catch {
    renderServerError(app);
    document.body.dataset.page = "server-error";
  }

  if (location.hash) {
    requestAnimationFrame(() => {
      document.querySelector(location.hash)?.scrollIntoView({ behavior: "smooth" });
    });
  } else {
    window.scrollTo(0, 0);
  }

  closeMobileNav();
}

// SPA link interception
document.addEventListener("click", (e) => {
  const link = (e.target as HTMLElement).closest("a");
  if (!link || link.origin !== location.origin) return;
  if (link.hasAttribute("target")) return;
  if (link.dataset.nospa !== undefined) return;
  // Same-page hash link — let the browser scroll natively
  if (link.pathname === location.pathname && link.hash) return;
  e.preventDefault();
  history.pushState(null, "", link.pathname + link.hash);
  navigate();
});

window.addEventListener("popstate", navigate);

// Show server error page for unhandled runtime errors that leave the page blank
window.addEventListener("error", () => {
  const app = document.getElementById("app");
  if (!app || document.body.dataset.page === "server-error") return;
  if (!app.innerHTML.trim()) {
    renderServerError(app);
    document.body.dataset.page = "server-error";
  }
});

navigate();

export function renderNotFound(app: HTMLElement) {
  app.innerHTML = `
    <section class="error-page">
      <div class="container error-inner">
        <span class="error-code">404</span>
        <h1 class="error-title">Page not found</h1>
        <p class="error-lead">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div class="error-actions">
          <a class="btn btn-primary" href="/">Back to home</a>
          <a class="btn btn-ghost" href="/docs">Read the docs</a>
        </div>
      </div>
    </section>
  `;
}

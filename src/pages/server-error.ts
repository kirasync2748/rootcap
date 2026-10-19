export function renderServerError(app: HTMLElement) {
  app.innerHTML = `
    <section class="error-page">
      <div class="container error-inner">
        <span class="error-code">500</span>
        <h1 class="error-title">Something went wrong</h1>
        <p class="error-lead">
          An unexpected error occurred. Please try again in a moment.
        </p>
        <div class="error-actions">
          <a class="btn btn-primary" href="/">Back to home</a>
          <a class="btn btn-ghost" href="/docs">Read the docs</a>
        </div>
      </div>
    </section>
  `;
}

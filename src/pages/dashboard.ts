export function renderDashboard(app: HTMLElement) {
  app.innerHTML = `
    <div class="dashboard-hero">
      <div class="container">
        <p class="section-eyebrow">Dashboard</p>
        <h1 class="dashboard-hero-title">Usage analytics</h1>
        <p class="dashboard-hero-lead">
          Track challenge requests and verification activity in real time.
        </p>
      </div>
    </div>

    <div class="container dashboard-content">
      <div class="dashboard-grid" id="dashboard-grid">
        <div class="stat-card">
          <div class="stat-label">Challenges Requested</div>
          <div class="stat-value" id="stat-challenges">—</div>
          <div class="stat-detail">Total /api/challenge calls</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Verifications Attempted</div>
          <div class="stat-value" id="stat-verifications">—</div>
          <div class="stat-detail">Total /api/verify calls</div>
        </div>
        <div class="stat-card stat-card-success">
          <div class="stat-label">Success Rate</div>
          <div class="stat-value" id="stat-success-rate">—</div>
          <div class="stat-detail" id="stat-success-detail">— succeeded</div>
        </div>
        <div class="stat-card stat-card-fail">
          <div class="stat-label">Failed Verifications</div>
          <div class="stat-value" id="stat-failed">—</div>
          <div class="stat-detail" id="stat-fail-detail">— of — attempts</div>
        </div>
      </div>
      <div class="dashboard-refresh">
        <span class="refresh-dot"></span>
        <span id="refresh-status">Loading…</span>
      </div>
    </div>
  `;

  const els = {
    challenges: app.querySelector("#stat-challenges"),
    verifications: app.querySelector("#stat-verifications"),
    successRate: app.querySelector("#stat-success-rate"),
    successDetail: app.querySelector("#stat-success-detail"),
    failed: app.querySelector("#stat-failed"),
    failDetail: app.querySelector("#stat-fail-detail"),
    refreshStatus: app.querySelector("#refresh-status"),
  };

  function formatUptime(ms: number): string {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }

  async function fetchStats() {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("stats request failed");
      const data = (await res.json()) as {
        challengesRequested: number;
        verificationsAttempted: number;
        verificationsSucceeded: number;
        verificationsFailed: number;
        uptime: number;
      };

      if (els.challenges) els.challenges.textContent = String(data.challengesRequested);
      if (els.verifications) els.verifications.textContent = String(data.verificationsAttempted);

      const rate =
        data.verificationsAttempted > 0
          ? Math.round((data.verificationsSucceeded / data.verificationsAttempted) * 100)
          : 100;
      if (els.successRate) els.successRate.textContent = rate + "%";
      if (els.successDetail)
        els.successDetail.textContent = `${data.verificationsSucceeded} succeeded`;

      if (els.failed) els.failed.textContent = String(data.verificationsFailed);
      if (els.failDetail)
        els.failDetail.textContent = `${data.verificationsFailed} of ${data.verificationsAttempted} attempts`;

      if (els.refreshStatus)
        els.refreshStatus.textContent = `Live · uptime ${formatUptime(data.uptime)}`;
    } catch {
      if (els.refreshStatus) els.refreshStatus.textContent = "Failed to fetch stats";
    }
  }

  fetchStats();
  const intervalId = setInterval(() => {
    if (!document.querySelector("#dashboard-grid")) {
      clearInterval(intervalId);
      return;
    }
    fetchStats();
  }, 5000);
}

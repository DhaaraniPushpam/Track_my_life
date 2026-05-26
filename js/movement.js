// ═══════════════════════════════════════════════════
// LIFE OS — movement.js
// Fit data display + manual log, step streak, bar chart
// ═══════════════════════════════════════════════════

function renderMovement(container) {
  const date = today();
  _renderMovementForDate(container, date);
}

async function _renderMovementForDate(container, date) {
  const goals = getGoals();
  const stepGoal = goals.steps || 10000;
  const manualEntry = LS.getJSON(`lifeOS:movement:${date}`) || null;

  // Try Fit data first, fall back to manual
  let fitData = null;
  if (isFitConnected()) {
    fitData = await fetchFitDay(date).catch(() => null);
  }

  const steps = fitData?.steps ?? manualEntry?.steps ?? 0;
  const activeMin = fitData?.activeMin ?? manualEntry?.activeMin ?? 0;
  const distance = fitData?.distance ?? manualEntry?.distance ?? 0;
  const cal = fitData?.cal ?? manualEntry?.cal ?? 0;
  const source = fitData ? 'Google Fit' : (manualEntry ? 'Manual' : 'No data');

  // 30-day steps chart
  const chartData = [];
  const chartLabels = [];
  for (let i = 29; i >= 0; i--) {
    const d = daysAgo(i);
    const fit = LS.getJSON(`lifeOS:fit:cache:${d}`);
    const manual = LS.getJSON(`lifeOS:movement:${d}`);
    chartData.push(fit?.steps ?? manual?.steps ?? 0);
    chartLabels.push(i % 7 === 0 ? d.slice(5) : '');
  }

  const stepPct = Math.min(100, Math.round((steps / stepGoal) * 100));
  const streak = getStepStreak();

  container.innerHTML = `
    <div class="module">
      <div class="module-header">
        <div class="module-title">Movement <span>& Steps</span></div>
        <div class="module-date">${formatDate(date)}</div>
      </div>

      <div class="movement-main">
        <div class="movement-hero">
          <div class="movement-steps-big">${steps.toLocaleString()}</div>
          <div class="movement-steps-label">steps today</div>
          <div class="progress-bar-wrap" style="margin-top:10px;">
            <div class="progress-bar" style="width:${stepPct}%"></div>
          </div>
          <div class="movement-goal-row">
            <span style="font-size:11px;color:var(--text3);">Goal: ${stepGoal.toLocaleString()}</span>
            <span style="font-size:11px;color:var(--text3);">${stepPct}%</span>
          </div>
        </div>

        <div class="movement-stats">
          <div class="movement-stat">
            <div class="movement-stat-val">${activeMin}</div>
            <div class="movement-stat-label">Active Min</div>
          </div>
          <div class="movement-stat">
            <div class="movement-stat-val">${distance.toFixed(1)}</div>
            <div class="movement-stat-label">km</div>
          </div>
          <div class="movement-stat">
            <div class="movement-stat-val">${cal}</div>
            <div class="movement-stat-label">Cal Burned</div>
          </div>
          <div class="movement-stat">
            <div class="movement-stat-val">${streak}</div>
            <div class="movement-stat-label">Day Streak</div>
          </div>
        </div>

        <div class="movement-source">
          Source: <strong>${source}</strong>
          ${isFitConnected() ? '<button class="btn small" id="move-refresh-btn">Sync Fit</button>' : ''}
        </div>
      </div>

      <div class="movement-manual">
        <div class="section-subtitle">Manual Override</div>
        <div class="form-row">
          <div class="form-group">
            <label>Steps</label>
            <input type="number" id="move-steps" placeholder="0" min="0" value="${manualEntry?.steps ?? ''}">
          </div>
          <div class="form-group">
            <label>Active Min</label>
            <input type="number" id="move-active" placeholder="0" min="0" value="${manualEntry?.activeMin ?? ''}">
          </div>
          <div class="form-group">
            <label>Distance (km)</label>
            <input type="number" id="move-distance" placeholder="0" min="0" step="0.1" value="${manualEntry?.distance ?? ''}">
          </div>
          <div class="form-group">
            <label>Cal Burned</label>
            <input type="number" id="move-cal" placeholder="0" min="0" value="${manualEntry?.cal ?? ''}">
          </div>
        </div>
        <button class="btn primary" id="move-save-btn">Save Manual Data</button>
        <div id="move-msg" style="font-size:12px;color:var(--text3);margin-top:6px;"></div>
      </div>

      <div class="chart-section">
        <div class="chart-title">30-Day Steps</div>
        ${makeSVGBar(chartData, stepGoal, 520, 120, chartLabels)}
      </div>
    </div>
  `;

  container.querySelector('#move-save-btn').addEventListener('click', () => {
    const entry = {
      steps: parseInt(container.querySelector('#move-steps').value) || 0,
      activeMin: parseInt(container.querySelector('#move-active').value) || 0,
      distance: parseFloat(container.querySelector('#move-distance').value) || 0,
      cal: parseInt(container.querySelector('#move-cal').value) || 0
    };
    LS.setJSON(`lifeOS:movement:${date}`, entry);
    updateIndex(date);
    container.querySelector('#move-msg').textContent = 'Saved.';
    setTimeout(() => _renderMovementForDate(container, date), 400);
  });

  const refreshBtn = container.querySelector('#move-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Syncing…';
      LS.remove(`lifeOS:fit:cache:${date}`);
      await _renderMovementForDate(container, date);
    });
  }
}

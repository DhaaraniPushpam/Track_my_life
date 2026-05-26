// ═══════════════════════════════════════════════════
// LIFE OS — water.js
// Quick-add buttons, SVG ring, 7-day bar chart
// ═══════════════════════════════════════════════════

function renderWater(container) {
  const date = today();
  _renderWaterForDate(container, date);
}

function _renderWaterForDate(container, date) {
  const entries = LS.getJSON(`lifeOS:water:${date}`) || [];
  const goals = getGoals();
  const goalMl = goals.water || 2500;
  const totalMl = entries.reduce((s, e) => s + e.ml, 0);
  const pct = Math.min(100, (totalMl / goalMl) * 100);
  const remaining = Math.max(0, goalMl - totalMl);
  const glasses = Math.round(totalMl / 250);

  // 7-day chart data
  const chartData = [];
  const chartLabels = [];
  for (let i = 6; i >= 0; i--) {
    const d = daysAgo(i);
    const dayEntries = LS.getJSON(`lifeOS:water:${d}`) || [];
    chartData.push(dayEntries.reduce((s, e) => s + e.ml, 0));
    chartLabels.push(d.slice(5));
  }

  const ring = makeCircleProgress(totalMl, goalMl, 160);

  container.innerHTML = `
    <div class="module">
      <div class="module-header">
        <div class="module-title">Water <span>Intake</span></div>
        <div class="module-date">${formatDate(date)}</div>
      </div>

      <div class="water-main">
        <div class="water-ring-section">
          ${ring}
          <div class="water-stats">
            <div class="water-stat-item">
              <div class="water-stat-value">${totalMl}</div>
              <div class="water-stat-label">ml drunk</div>
            </div>
            <div class="water-stat-item">
              <div class="water-stat-value">${remaining}</div>
              <div class="water-stat-label">ml left</div>
            </div>
            <div class="water-stat-item">
              <div class="water-stat-value">${glasses}</div>
              <div class="water-stat-label">glasses</div>
            </div>
          </div>
        </div>

        <div class="water-quick-add">
          <div class="quick-add-label">Quick Add</div>
          <div class="water-btn-grid">
            <button class="water-btn" data-ml="100">100 ml</button>
            <button class="water-btn" data-ml="150">150 ml</button>
            <button class="water-btn" data-ml="200">200 ml</button>
            <button class="water-btn" data-ml="250">250 ml</button>
            <button class="water-btn" data-ml="300">300 ml</button>
            <button class="water-btn" data-ml="350">350 ml</button>
            <button class="water-btn" data-ml="400">400 ml</button>
            <button class="water-btn" data-ml="500">500 ml</button>
          </div>
          <div class="custom-water-row">
            <input type="number" id="water-custom" placeholder="Custom ml" min="1" max="2000">
            <button class="btn" id="water-custom-btn">Add</button>
          </div>
        </div>
      </div>

      <div class="water-log" id="water-log">
        ${entries.length === 0
          ? '<div class="empty-state">No water logged yet today.</div>'
          : entries.slice().reverse().map((e, i) => `
            <div class="water-entry">
              <span class="water-entry-amount">${e.ml} ml</span>
              <span class="water-entry-time">${e.time || ''}</span>
              <button class="btn danger small water-delete-btn" data-id="${e.id}">×</button>
            </div>
          `).join('')}
      </div>

      <div class="chart-section">
        <div class="chart-title">7-Day Water Intake</div>
        ${makeSVGBar(chartData, goalMl, 520, 100, chartLabels)}
      </div>
    </div>
  `;

  // Quick-add buttons
  container.querySelectorAll('.water-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _addWater(date, parseInt(btn.dataset.ml));
      _renderWaterForDate(container, date);
    });
  });

  // Custom add
  container.querySelector('#water-custom-btn').addEventListener('click', () => {
    const val = parseInt(container.querySelector('#water-custom').value);
    if (val > 0) {
      _addWater(date, val);
      _renderWaterForDate(container, date);
    }
  });

  // Delete entry
  container.querySelectorAll('.water-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const entries = LS.getJSON(`lifeOS:water:${date}`) || [];
      LS.setJSON(`lifeOS:water:${date}`, entries.filter(e => e.id !== id));
      _renderWaterForDate(container, date);
    });
  });
}

function _addWater(date, ml) {
  const entries = LS.getJSON(`lifeOS:water:${date}`) || [];
  entries.push({
    id: Date.now(),
    ml,
    time: new Date().toTimeString().slice(0, 5)
  });
  LS.setJSON(`lifeOS:water:${date}`, entries);
  updateIndex(date);
}

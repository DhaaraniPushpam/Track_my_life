// ═══════════════════════════════════════════════════
// LIFE OS — food.js
// Food log, AI nutrition estimation, macro charts
// ═══════════════════════════════════════════════════

function renderFood(container) {
  const date = today();
  _renderFoodForDate(container, date);
}

function _renderFoodForDate(container, date) {
  const entries = LS.getJSON(`lifeOS:food:${date}`) || [];
  const goals = getGoals();
  const totalCal = entries.reduce((s, e) => s + (e.cal || 0), 0);
  const totalProtein = entries.reduce((s, e) => s + (e.protein || 0), 0);
  const totalCarbs = entries.reduce((s, e) => s + (e.carbs || 0), 0);
  const totalFat = entries.reduce((s, e) => s + (e.fat || 0), 0);

  const calPct = Math.min(100, Math.round((totalCal / (goals.calories || 2000)) * 100));
  const proteinPct = Math.min(100, Math.round((totalProtein / (goals.protein || 120)) * 100));

  // Build 7-day calorie data for chart
  const chartData = [];
  const chartLabels = [];
  for (let i = 6; i >= 0; i--) {
    const d = daysAgo(i);
    const dayEntries = LS.getJSON(`lifeOS:food:${d}`) || [];
    chartData.push(dayEntries.reduce((s, e) => s + (e.cal || 0), 0));
    chartLabels.push(d.slice(5));
  }

  container.innerHTML = `
    <div class="module">
      <div class="module-header">
        <div class="module-title">Food <span>Log</span></div>
        <div class="module-date">${formatDate(date)}</div>
      </div>

      <div class="food-input-section">
        <div class="form-group">
          <label>Describe what you ate</label>
          <textarea id="food-desc" rows="2" placeholder="e.g. 2 rotis with dal and sabzi, 1 cup chai with milk and sugar"></textarea>
        </div>
        <div class="flex gap-8">
          <button class="btn primary" id="food-ai-btn">Estimate with AI</button>
          <button class="btn" id="food-manual-btn">Add Manually</button>
        </div>
        <div id="food-ai-status" style="font-size:12px;color:var(--text3);margin-top:6px;min-height:16px;"></div>
      </div>

      <div id="food-manual-form" style="display:none;" class="food-manual-form">
        <div class="form-row">
          <div class="form-group">
            <label>Name</label>
            <input type="text" id="food-name" placeholder="Meal name">
          </div>
          <div class="form-group">
            <label>Cal</label>
            <input type="number" id="food-cal" placeholder="0" min="0">
          </div>
          <div class="form-group">
            <label>Protein (g)</label>
            <input type="number" id="food-protein" placeholder="0" min="0">
          </div>
          <div class="form-group">
            <label>Carbs (g)</label>
            <input type="number" id="food-carbs" placeholder="0" min="0">
          </div>
          <div class="form-group">
            <label>Fat (g)</label>
            <input type="number" id="food-fat" placeholder="0" min="0">
          </div>
        </div>
        <button class="btn primary small" id="food-save-manual-btn">Save Entry</button>
      </div>

      <div id="food-ai-preview" style="display:none;" class="food-ai-preview">
        <div class="food-ai-result">
          <div class="food-ai-name" id="food-preview-name"></div>
          <div class="macro-badges">
            <span class="macro-badge cal" contenteditable="true" id="food-preview-cal" title="Click to edit"></span>
            <span class="macro-badge protein" contenteditable="true" id="food-preview-protein" title="Click to edit">0g protein</span>
            <span class="macro-badge carbs" contenteditable="true" id="food-preview-carbs" title="Click to edit">0g carbs</span>
            <span class="macro-badge fat" contenteditable="true" id="food-preview-fat" title="Click to edit">0g fat</span>
          </div>
          <div class="flex gap-8 mt-8">
            <button class="btn primary small" id="food-confirm-btn">Add to Log</button>
            <button class="btn small" id="food-discard-btn">Discard</button>
          </div>
        </div>
      </div>

      <div class="food-totals">
        <div class="totals-row">
          <span class="totals-label">Calories</span>
          <span class="totals-value">${totalCal} / ${goals.calories || 2000} kcal</span>
        </div>
        <div class="progress-bar-wrap"><div class="progress-bar" style="width:${calPct}%"></div></div>
        <div class="totals-row" style="margin-top:8px;">
          <span class="totals-label">Protein</span>
          <span class="totals-value">${totalProtein}g / ${goals.protein || 120}g</span>
        </div>
        <div class="progress-bar-wrap"><div class="progress-bar protein" style="width:${proteinPct}%"></div></div>
        <div class="macro-summary">
          <span>Carbs: <strong>${totalCarbs}g</strong></span>
          <span>Fat: <strong>${totalFat}g</strong></span>
        </div>
      </div>

      <div class="food-entries" id="food-entries-list">
        ${entries.length === 0
          ? '<div class="empty-state">No food logged yet today.</div>'
          : entries.map((e, i) => _foodEntryHTML(e, i)).join('')}
      </div>

      <div class="chart-section">
        <div class="chart-title">7-Day Calories</div>
        ${makeSVGBar(chartData, goals.calories || 2000, 520, 100, chartLabels)}
      </div>
    </div>
  `;

  // AI estimate button
  container.querySelector('#food-ai-btn').addEventListener('click', async () => {
    const desc = container.querySelector('#food-desc').value.trim();
    if (!desc) return;
    const apiKey = LS.get('lifeOS:apikey');
    if (!apiKey) {
      container.querySelector('#food-ai-status').textContent = 'No API key — go to Settings to add one, or use Add Manually.';
      return;
    }
    const statusEl = container.querySelector('#food-ai-status');
    const btn = container.querySelector('#food-ai-btn');
    btn.disabled = true;
    btn.textContent = 'Estimating…';
    statusEl.textContent = '';

    try {
      const system = `You are a nutrition expert. Given a food description, estimate calories, protein, carbs, and fat. Respond ONLY with valid JSON in this exact format: {"name":"description","cal":number,"protein":number,"carbs":number,"fat":number}. Numbers are integers. Be realistic and accurate.`;
      const text = await callClaude(system, desc, 150);
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      const data = JSON.parse(match[0]);

      container.querySelector('#food-preview-name').textContent = data.name || desc;
      container.querySelector('#food-preview-cal').textContent = `${data.cal || 0} kcal`;
      container.querySelector('#food-preview-protein').textContent = `${data.protein || 0}g protein`;
      container.querySelector('#food-preview-carbs').textContent = `${data.carbs || 0}g carbs`;
      container.querySelector('#food-preview-fat').textContent = `${data.fat || 0}g fat`;

      container.querySelector('#food-ai-preview').style.display = '';
    } catch (e) {
      statusEl.textContent = `AI error: ${e.message}. Try adding manually.`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Estimate with AI';
    }
  });

  // Confirm AI result
  container.querySelector('#food-confirm-btn').addEventListener('click', () => {
    const name = container.querySelector('#food-preview-name').textContent;
    const calText = container.querySelector('#food-preview-cal').textContent;
    const proteinText = container.querySelector('#food-preview-protein').textContent;
    const carbsText = container.querySelector('#food-preview-carbs').textContent;
    const fatText = container.querySelector('#food-preview-fat').textContent;

    const entry = {
      id: Date.now(),
      name,
      cal: parseInt(calText) || 0,
      protein: parseInt(proteinText) || 0,
      carbs: parseInt(carbsText) || 0,
      fat: parseInt(fatText) || 0,
      time: new Date().toTimeString().slice(0, 5)
    };

    _saveFoodEntry(date, entry);
    _renderFoodForDate(container, date);
  });

  // Discard AI result
  container.querySelector('#food-discard-btn').addEventListener('click', () => {
    container.querySelector('#food-ai-preview').style.display = 'none';
  });

  // Show/hide manual form
  container.querySelector('#food-manual-btn').addEventListener('click', () => {
    const form = container.querySelector('#food-manual-form');
    form.style.display = form.style.display === 'none' ? '' : 'none';
  });

  // Save manual entry
  container.querySelector('#food-save-manual-btn').addEventListener('click', () => {
    const name = container.querySelector('#food-name').value.trim();
    if (!name) return;
    const entry = {
      id: Date.now(),
      name,
      cal: parseInt(container.querySelector('#food-cal').value) || 0,
      protein: parseInt(container.querySelector('#food-protein').value) || 0,
      carbs: parseInt(container.querySelector('#food-carbs').value) || 0,
      fat: parseInt(container.querySelector('#food-fat').value) || 0,
      time: new Date().toTimeString().slice(0, 5)
    };
    _saveFoodEntry(date, entry);
    _renderFoodForDate(container, date);
  });

  // Delete entry buttons
  container.querySelectorAll('.food-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const entries = LS.getJSON(`lifeOS:food:${date}`) || [];
      LS.setJSON(`lifeOS:food:${date}`, entries.filter(e => e.id !== id));
      _renderFoodForDate(container, date);
    });
  });
}

function _foodEntryHTML(entry, i) {
  return `
    <div class="food-entry">
      <div class="food-entry-info">
        <div class="food-entry-name">${entry.name}</div>
        <div class="food-entry-macros">
          <span class="macro-pill cal">${entry.cal} kcal</span>
          <span class="macro-pill">${entry.protein}g P</span>
          <span class="macro-pill">${entry.carbs}g C</span>
          <span class="macro-pill">${entry.fat}g F</span>
          ${entry.time ? `<span class="macro-pill time">${entry.time}</span>` : ''}
        </div>
      </div>
      <button class="btn danger small food-delete-btn" data-id="${entry.id}">×</button>
    </div>
  `;
}

function _saveFoodEntry(date, entry) {
  const entries = LS.getJSON(`lifeOS:food:${date}`) || [];
  entries.push(entry);
  LS.setJSON(`lifeOS:food:${date}`, entries);
  updateIndex(date);
}

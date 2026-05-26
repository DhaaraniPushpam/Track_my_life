// ═══════════════════════════════════════════════════
// LIFE OS — settings.js
// API key, OAuth client ID, goals, export/import/clear
// ═══════════════════════════════════════════════════

function renderSettings(container) {
  _renderSettingsView(container);
}

function _renderSettingsView(container) {
  const apiKey = LS.get('lifeOS:apikey') || '';
  const fitClientId = LS.get('lifeOS:fit:clientid') || '';
  const goals = getGoals();

  const maskedKey = apiKey ? `sk-ant-...${apiKey.slice(-6)}` : '';

  container.innerHTML = `
    <div class="module">
      <div class="module-header">
        <div class="module-title">Settings <span>& Goals</span></div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">AI Integration</div>
        <div class="form-group">
          <label>Anthropic API Key</label>
          <div class="api-key-row">
            <input type="password" id="settings-apikey" placeholder="sk-ant-..." value="${apiKey}" autocomplete="off">
            <button class="btn small" id="settings-toggle-key">Show</button>
          </div>
          ${maskedKey ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;">Current: ${maskedKey}</div>` : ''}
          <div style="font-size:11px;color:var(--text3);margin-top:4px;">Used for: food nutrition estimation, journal reflections, learning summaries</div>
        </div>
        <button class="btn primary small" id="settings-save-key-btn">Save API Key</button>
        <div id="settings-key-msg" style="font-size:12px;color:var(--text3);margin-top:6px;min-height:14px;"></div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Google Fit</div>
        <div class="form-group">
          <label>OAuth Client ID</label>
          <input type="text" id="settings-fit-id" placeholder="xxxx.apps.googleusercontent.com" value="${fitClientId}">
        </div>
        <div class="flex gap-8">
          <button class="btn primary small" id="settings-save-fit-btn">Save Client ID</button>
          ${isFitConnected() ? '<button class="btn danger small" id="settings-disconnect-fit-btn">Disconnect Fit</button>' : ''}
        </div>
        <div id="settings-fit-msg" style="font-size:12px;color:var(--text3);margin-top:6px;min-height:14px;"></div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Daily Goals</div>
        <div class="form-row">
          <div class="form-group">
            <label>Calories (kcal)</label>
            <input type="number" id="goal-calories" value="${goals.calories || 2000}" min="500">
          </div>
          <div class="form-group">
            <label>Protein (g)</label>
            <input type="number" id="goal-protein" value="${goals.protein || 120}" min="0">
          </div>
          <div class="form-group">
            <label>Water (ml)</label>
            <input type="number" id="goal-water" value="${goals.water || 2500}" min="500">
          </div>
          <div class="form-group">
            <label>Sleep (hours)</label>
            <input type="number" id="goal-sleep" value="${goals.sleep || 7.5}" min="4" max="12" step="0.5">
          </div>
          <div class="form-group">
            <label>Steps</label>
            <input type="number" id="goal-steps" value="${goals.steps || 10000}" min="1000">
          </div>
        </div>
        <button class="btn primary small" id="settings-save-goals-btn">Save Goals</button>
        <div id="settings-goals-msg" style="font-size:12px;color:var(--text3);margin-top:6px;min-height:14px;"></div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Monthly Budgets (₹)</div>
        <div class="form-row">
          ${['Food', 'Transport', 'Health', 'Entertainment', 'Subscriptions', 'Misc'].map(cat => `
            <div class="form-group">
              <label>${cat}</label>
              <input type="number" id="budget-${cat.toLowerCase()}" value="${goals.budgets?.[cat.toLowerCase()] || goals.budgets?.[cat] || 0}" min="0">
            </div>
          `).join('')}
        </div>
        <button class="btn primary small" id="settings-save-budgets-btn">Save Budgets</button>
        <div id="settings-budgets-msg" style="font-size:12px;color:var(--text3);margin-top:6px;min-height:14px;"></div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Data Management</div>
        <div class="flex gap-8 flex-wrap">
          <button class="btn" id="settings-export-btn">Export Data (JSON)</button>
          <button class="btn" id="settings-import-btn">Import Data</button>
          <button class="btn danger" id="settings-clear-btn">Clear All Data</button>
        </div>
        <input type="file" id="settings-import-file" accept=".json" style="display:none;">
        <div id="settings-data-msg" style="font-size:12px;color:var(--text3);margin-top:8px;"></div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">About</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.8;">
          <div>Personal Life OS — v1.0</div>
          <div>All data stored locally in your browser's localStorage.</div>
          <div>No data is sent anywhere except Anthropic API calls (if API key is set) and Google Fit (if connected).</div>
          <div style="margin-top:8px;">localStorage keys: <code style="font-family:var(--mono);font-size:11px;">lifeOS:*</code></div>
          <div>Approximate storage used: <strong id="storage-used">calculating…</strong></div>
        </div>
      </div>
    </div>
  `;

  // Calculate storage
  let bytes = 0;
  LS.keys().filter(k => k.startsWith('lifeOS:')).forEach(k => {
    bytes += (LS.get(k) || '').length * 2;
  });
  const kb = (bytes / 1024).toFixed(1);
  container.querySelector('#storage-used').textContent = `${kb} KB`;

  // API key toggle visibility
  container.querySelector('#settings-toggle-key').addEventListener('click', () => {
    const input = container.querySelector('#settings-apikey');
    const btn = container.querySelector('#settings-toggle-key');
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = 'Hide';
    } else {
      input.type = 'password';
      btn.textContent = 'Show';
    }
  });

  // Save API key
  container.querySelector('#settings-save-key-btn').addEventListener('click', () => {
    const key = container.querySelector('#settings-apikey').value.trim();
    LS.set('lifeOS:apikey', key);
    container.querySelector('#settings-key-msg').textContent = key ? 'API key saved.' : 'API key cleared.';
    setTimeout(() => { container.querySelector('#settings-key-msg').textContent = ''; }, 2000);
  });

  // Save fit client id
  container.querySelector('#settings-save-fit-btn').addEventListener('click', () => {
    const id = container.querySelector('#settings-fit-id').value.trim();
    LS.set('lifeOS:fit:clientid', id);
    container.querySelector('#settings-fit-msg').textContent = id ? 'Client ID saved.' : 'Client ID cleared.';
    setTimeout(() => { container.querySelector('#settings-fit-msg').textContent = ''; }, 2000);
  });

  const disconnectBtn = container.querySelector('#settings-disconnect-fit-btn');
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
      clearFitToken();
      updateSidebarFitStatus();
      _renderSettingsView(container);
    });
  }

  // Save goals
  container.querySelector('#settings-save-goals-btn').addEventListener('click', () => {
    const g = getGoals();
    g.calories = parseInt(container.querySelector('#goal-calories').value) || 2000;
    g.protein = parseInt(container.querySelector('#goal-protein').value) || 120;
    g.water = parseInt(container.querySelector('#goal-water').value) || 2500;
    g.sleep = parseFloat(container.querySelector('#goal-sleep').value) || 7.5;
    g.steps = parseInt(container.querySelector('#goal-steps').value) || 10000;
    saveGoals(g);
    container.querySelector('#settings-goals-msg').textContent = 'Goals saved.';
    setTimeout(() => { container.querySelector('#settings-goals-msg').textContent = ''; }, 2000);
  });

  // Save budgets
  container.querySelector('#settings-save-budgets-btn').addEventListener('click', () => {
    const g = getGoals();
    g.budgets = g.budgets || {};
    ['food', 'transport', 'health', 'entertainment', 'subscriptions', 'misc'].forEach(cat => {
      g.budgets[cat] = parseInt(container.querySelector(`#budget-${cat}`).value) || 0;
    });
    saveGoals(g);
    container.querySelector('#settings-budgets-msg').textContent = 'Budgets saved.';
    setTimeout(() => { container.querySelector('#settings-budgets-msg').textContent = ''; }, 2000);
  });

  // Export
  container.querySelector('#settings-export-btn').addEventListener('click', () => {
    const data = {};
    LS.keys().filter(k => k.startsWith('lifeOS:')).forEach(k => {
      data[k] = LS.get(k);
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeOS-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    container.querySelector('#settings-data-msg').textContent = 'Export downloaded.';
  });

  // Import
  container.querySelector('#settings-import-btn').addEventListener('click', () => {
    container.querySelector('#settings-import-file').click();
  });

  container.querySelector('#settings-import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        let count = 0;
        Object.entries(data).forEach(([k, v]) => {
          if (k.startsWith('lifeOS:')) {
            localStorage.setItem(k, v);
            count++;
          }
        });
        container.querySelector('#settings-data-msg').textContent = `Imported ${count} keys. Reload the page.`;
      } catch (err) {
        container.querySelector('#settings-data-msg').textContent = `Import failed: ${err.message}`;
      }
    };
    reader.readAsText(file);
  });

  // Clear all data
  container.querySelector('#settings-clear-btn').addEventListener('click', () => {
    if (!confirm('This will delete ALL Life OS data including your history, logs, and settings. This cannot be undone. Are you sure?')) return;
    LS.keys().filter(k => k.startsWith('lifeOS:')).forEach(k => LS.remove(k));
    container.querySelector('#settings-data-msg').textContent = 'All data cleared. Reload the page to start fresh.';
  });
}

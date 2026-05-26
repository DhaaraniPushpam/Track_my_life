// ═══════════════════════════════════════════════════
// LIFE OS — learnings.js
// Goal CRUD, session log, pacing calc, AI summary
// ═══════════════════════════════════════════════════

function renderLearnings(container) {
  _renderLearningsView(container);
}

function _renderLearningsView(container) {
  const goals = LS.getJSON('lifeOS:learning:goals') || [];
  const alerts = checkLearningAlerts();

  container.innerHTML = `
    <div class="module">
      <div class="module-header">
        <div class="module-title">Learnings <span>& Skills</span></div>
      </div>

      ${alerts.length > 0 ? `
        <div class="learning-alerts">
          ${alerts.map(a => `
            <div class="learning-alert ${a.level}">
              ${a.level === 'critical' ? '⚠' : '↓'} <strong>${a.topic}</strong> is ${a.level === 'critical' ? 'critically behind schedule' : 'behind pace'}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="learning-add-section">
        <button class="btn primary small" id="learning-add-btn">+ New Learning Goal</button>
      </div>

      <div id="learning-goal-form" style="display:none;" class="learning-form">
        <div class="form-row">
          <div class="form-group" style="flex:2;">
            <label>Topic / Skill</label>
            <input type="text" id="learning-topic" placeholder="e.g. TypeScript, Piano, DSA">
          </div>
          <div class="form-group">
            <label>Total Hours Goal</label>
            <input type="number" id="learning-hours" placeholder="50" min="1">
          </div>
          <div class="form-group">
            <label>Target Date</label>
            <input type="date" id="learning-target" value="${addDays(today(), 90)}">
          </div>
        </div>
        <div class="form-group">
          <label>Resources / Notes</label>
          <input type="text" id="learning-resources" placeholder="Book, course, links...">
        </div>
        <div class="flex gap-8">
          <button class="btn primary small" id="learning-save-goal-btn">Create Goal</button>
          <button class="btn small" id="learning-cancel-goal-btn">Cancel</button>
        </div>
      </div>

      <div id="learning-goals-list">
        ${goals.length === 0
          ? '<div class="empty-state">No learning goals yet. Add one to track your progress.</div>'
          : goals.map(g => _renderGoalCard(g, alerts)).join('')}
      </div>
    </div>
  `;

  container.querySelector('#learning-add-btn').addEventListener('click', () => {
    const form = container.querySelector('#learning-goal-form');
    form.style.display = form.style.display === 'none' ? '' : 'none';
  });

  container.querySelector('#learning-cancel-goal-btn').addEventListener('click', () => {
    container.querySelector('#learning-goal-form').style.display = 'none';
  });

  container.querySelector('#learning-save-goal-btn').addEventListener('click', () => {
    const topic = container.querySelector('#learning-topic').value.trim();
    if (!topic) return;
    const goals = LS.getJSON('lifeOS:learning:goals') || [];
    const goal = {
      id: `goal_${Date.now()}`,
      topic,
      totalHours: parseFloat(container.querySelector('#learning-hours').value) || 50,
      targetDate: container.querySelector('#learning-target').value,
      resources: container.querySelector('#learning-resources').value.trim() || null,
      createdAt: today()
    };
    goals.push(goal);
    LS.setJSON('lifeOS:learning:goals', goals);
    _renderLearningsView(container);
  });

  // Goal card event delegation
  container.querySelector('#learning-goals-list').addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const goalId = btn.dataset.goalId;
    const action = btn.dataset.action;

    if (action === 'expand') {
      const card = btn.closest('.learning-goal-card');
      const detail = card.querySelector('.learning-goal-detail');
      if (detail) {
        detail.style.display = detail.style.display === 'none' ? '' : 'none';
        btn.textContent = detail.style.display === 'none' ? 'Expand' : 'Collapse';
      }
    }

    if (action === 'log-session') {
      const goal = (LS.getJSON('lifeOS:learning:goals') || []).find(g => g.id === goalId);
      if (goal) _showSessionForm(container, goal);
    }

    if (action === 'delete-goal') {
      const goals = LS.getJSON('lifeOS:learning:goals') || [];
      LS.setJSON('lifeOS:learning:goals', goals.filter(g => g.id !== goalId));
      _renderLearningsView(container);
    }

    if (action === 'ai-summary') {
      const goal = (LS.getJSON('lifeOS:learning:goals') || []).find(g => g.id === goalId);
      if (!goal) return;
      const apiKey = LS.get('lifeOS:apikey');
      if (!apiKey) { alert('Add an API key in Settings first.'); return; }
      const log = LS.getJSON(`lifeOS:learning:log:${goalId}`) || [];
      const notes = log.map(l => l.notes).filter(Boolean).join('\n');
      if (!notes) { alert('No session notes to summarize.'); return; }

      btn.disabled = true;
      btn.textContent = 'Summarizing…';
      try {
        const system = 'You are a learning coach. Given session notes, write one paragraph summarizing key concepts learned, progress made, and what to focus on next. Be concise and encouraging.';
        const summary = await callClaude(system, notes, 200);
        const summaryEl = btn.closest('.learning-goal-card').querySelector('.ai-summary-text');
        if (summaryEl) {
          summaryEl.textContent = summary;
          summaryEl.parentElement.style.display = '';
        }
        goal.aiSummary = summary;
        const goals = LS.getJSON('lifeOS:learning:goals') || [];
        const idx = goals.findIndex(g => g.id === goalId);
        if (idx >= 0) { goals[idx] = goal; LS.setJSON('lifeOS:learning:goals', goals); }
      } catch (err) {
        btn.textContent = `Error: ${err.message}`;
      } finally {
        btn.disabled = false;
        if (!btn.textContent.startsWith('Error')) btn.textContent = 'AI Summary';
      }
    }

    if (action === 'delete-session') {
      const goalId2 = btn.dataset.goalId;
      const sessionId = parseInt(btn.dataset.sessionId);
      const log = LS.getJSON(`lifeOS:learning:log:${goalId2}`) || [];
      LS.setJSON(`lifeOS:learning:log:${goalId2}`, log.filter(l => l.id !== sessionId));
      _renderLearningsView(container);
    }
  });
}

function _renderGoalCard(goal, alerts) {
  const log = LS.getJSON(`lifeOS:learning:log:${goal.id}`) || [];
  const loggedHours = log.reduce((s, l) => s + l.minutes, 0) / 60;
  const pct = Math.min(100, Math.round((loggedHours / goal.totalHours) * 100));
  const daysLeft = daysBetween(today(), goal.targetDate);
  const alert = alerts.find(a => a.id === goal.id);

  // Pacing: compute expected hours by now
  const totalDays = daysBetween(goal.createdAt || daysAgo(30), goal.targetDate);
  const elapsed = daysBetween(goal.createdAt || daysAgo(30), today());
  const expectedHours = totalDays > 0 ? (elapsed / totalDays) * goal.totalHours : 0;
  const paceStatus = loggedHours >= expectedHours * 0.95 ? 'on-pace' :
                     loggedHours >= expectedHours * 0.75 ? 'slightly-behind' : 'behind';

  return `
    <div class="learning-goal-card ${alert?.level || ''}">
      <div class="learning-goal-header">
        <div class="learning-goal-info">
          <div class="learning-topic">${goal.topic}</div>
          <div class="learning-meta">
            <span class="pace-tag ${paceStatus}">${paceStatus === 'on-pace' ? '↑ On pace' : paceStatus === 'slightly-behind' ? '→ Slightly behind' : '↓ Behind'}</span>
            <span>${loggedHours.toFixed(1)} / ${goal.totalHours}h</span>
            <span>${daysLeft > 0 ? `${daysLeft}d left` : 'Past deadline'}</span>
          </div>
        </div>
        <div class="learning-goal-actions">
          <button class="btn small" data-action="log-session" data-goal-id="${goal.id}">+ Log</button>
          <button class="btn small" data-action="expand" data-goal-id="${goal.id}">Expand</button>
          <button class="btn small" data-action="ai-summary" data-goal-id="${goal.id}">AI Summary</button>
          <button class="btn danger small" data-action="delete-goal" data-goal-id="${goal.id}">×</button>
        </div>
      </div>

      <div class="progress-bar-wrap">
        <div class="progress-bar" style="width:${pct}%"></div>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-top:3px;">${pct}% complete · target ${goal.targetDate}</div>

      ${goal.aiSummary ? `
        <div class="ai-summary-section">
          <div class="ai-summary-label">AI Summary</div>
          <div class="ai-summary-text">${goal.aiSummary}</div>
        </div>
      ` : '<div class="ai-summary-section" style="display:none;"><div class="ai-summary-label">AI Summary</div><div class="ai-summary-text"></div></div>'}

      <div class="learning-goal-detail" style="display:none;">
        ${goal.resources ? `<div class="learning-resources">Resources: ${goal.resources}</div>` : ''}
        <div class="sessions-log">
          ${log.length === 0
            ? '<div style="font-size:12px;color:var(--text3);">No sessions logged yet.</div>'
            : log.slice().reverse().slice(0, 10).map(s => `
              <div class="session-log-item">
                <span class="session-date">${s.date}</span>
                <span class="session-dur">${s.minutes}m</span>
                ${s.notes ? `<span class="session-notes">${s.notes}</span>` : ''}
                <button class="btn danger small" data-action="delete-session" data-goal-id="${goal.id}" data-session-id="${s.id}">×</button>
              </div>
            `).join('')}
        </div>
      </div>
    </div>
  `;
}

function _showSessionForm(container, goal) {
  const existing = container.querySelector('#learning-session-form');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = 'learning-session-form';
  div.className = 'learning-form';
  div.innerHTML = `
    <div class="section-subtitle">Log session: ${goal.topic}</div>
    <div class="form-row">
      <div class="form-group">
        <label>Date</label>
        <input type="date" id="session-date" value="${today()}">
      </div>
      <div class="form-group">
        <label>Duration (min)</label>
        <input type="number" id="session-minutes" placeholder="30" min="1" max="480">
      </div>
    </div>
    <div class="form-group">
      <label>Notes (what did you learn?)</label>
      <textarea id="session-notes" rows="2" placeholder="Topics covered, problems solved, insights..."></textarea>
    </div>
    <div class="flex gap-8">
      <button class="btn primary small" id="session-save-btn">Save Session</button>
      <button class="btn small" id="session-cancel-btn">Cancel</button>
    </div>
  `;

  container.querySelector('#learning-goals-list').before(div);

  div.querySelector('#session-cancel-btn').addEventListener('click', () => div.remove());
  div.querySelector('#session-save-btn').addEventListener('click', () => {
    const minutes = parseInt(div.querySelector('#session-minutes').value) || 0;
    if (!minutes) return;
    const session = {
      id: Date.now(),
      date: div.querySelector('#session-date').value || today(),
      minutes,
      notes: div.querySelector('#session-notes').value.trim() || null
    };
    const log = LS.getJSON(`lifeOS:learning:log:${goal.id}`) || [];
    log.push(session);
    LS.setJSON(`lifeOS:learning:log:${goal.id}`, log);
    div.remove();
    _renderLearningsView(container);
  });
}

// ═══════════════════════════════════════════════════
// LIFE OS — journal.js
// Textarea, mood picker, word count, AI reflection
// ═══════════════════════════════════════════════════

function renderJournal(container) {
  const date = today();
  _renderJournalForDate(container, date);
}

function _renderJournalForDate(container, date) {
  const entry = LS.getJSON(`lifeOS:journal:${date}`) || null;
  const text = entry?.text || '';
  const mood = entry?.mood || null;
  const reflection = entry?.reflection || null;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const moods = [
    { v: 1, label: 'Awful',    emoji: '😞' },
    { v: 2, label: 'Bad',      emoji: '😕' },
    { v: 3, label: 'Okay',     emoji: '😐' },
    { v: 4, label: 'Good',     emoji: '🙂' },
    { v: 5, label: 'Great',    emoji: '😄' }
  ];

  // 14-day mood sparkline data
  const moodData = [];
  for (let i = 13; i >= 0; i--) {
    const d = daysAgo(i);
    const e = LS.getJSON(`lifeOS:journal:${d}`);
    moodData.push(e?.mood || 0);
  }

  container.innerHTML = `
    <div class="module">
      <div class="module-header">
        <div class="module-title">Daily <span>Journal</span></div>
        <div class="module-date">${formatDate(date)}</div>
      </div>

      <div class="journal-mood-row">
        <span class="mood-label-text">How are you feeling?</span>
        <div class="mood-picker" id="mood-picker">
          ${moods.map(m => `
            <button class="mood-btn ${mood === m.v ? 'active' : ''}" data-mood="${m.v}" title="${m.label}">
              <span class="mood-emoji">${m.emoji}</span>
              <span class="mood-name">${m.label}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="journal-write-section">
        <textarea id="journal-text" placeholder="What's on your mind today? What happened? What are you grateful for?">${text}</textarea>
        <div class="journal-meta-row">
          <span class="word-count" id="journal-wordcount">${wordCount} words</span>
          <div class="flex gap-8">
            <button class="btn primary" id="journal-save-btn">Save</button>
            <button class="btn" id="journal-reflect-btn" ${!text.trim() ? 'disabled' : ''}>AI Reflection</button>
          </div>
        </div>
      </div>

      ${reflection ? `
        <div class="journal-reflection">
          <div class="reflection-header">AI Reflection</div>
          <div class="reflection-text">${reflection}</div>
        </div>
      ` : `<div id="journal-reflection-placeholder"></div>`}

      ${entry && entry.savedAt ? `
        <div style="font-size:11px;color:var(--text3);margin-top:8px;">Last saved ${entry.savedAt}</div>
      ` : ''}

      <div class="chart-section">
        <div class="chart-title">14-Day Mood</div>
        ${makeSVGBar(moodData, 5, 520, 70, [])}
      </div>

      <div class="journal-history" id="journal-history">
        <div class="section-subtitle">Recent Entries</div>
        ${_renderJournalHistory()}
      </div>
    </div>
  `;

  // Mood picker
  container.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Word count live update
  const textarea = container.querySelector('#journal-text');
  textarea.addEventListener('input', () => {
    const txt = textarea.value.trim();
    const wc = txt ? txt.split(/\s+/).length : 0;
    container.querySelector('#journal-wordcount').textContent = `${wc} words`;
    container.querySelector('#journal-reflect-btn').disabled = !txt;
  });

  // Save
  container.querySelector('#journal-save-btn').addEventListener('click', () => {
    const text = textarea.value;
    const activeMoodBtn = container.querySelector('.mood-btn.active');
    const mood = activeMoodBtn ? parseInt(activeMoodBtn.dataset.mood) : null;
    const existing = LS.getJSON(`lifeOS:journal:${date}`) || {};
    LS.setJSON(`lifeOS:journal:${date}`, {
      ...existing,
      text,
      mood,
      date,
      savedAt: new Date().toTimeString().slice(0, 5)
    });
    updateIndex(date);
    const btn = container.querySelector('#journal-save-btn');
    btn.textContent = 'Saved!';
    setTimeout(() => { btn.textContent = 'Save'; }, 1200);
  });

  // AI Reflection
  container.querySelector('#journal-reflect-btn').addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) return;
    const apiKey = LS.get('lifeOS:apikey');
    if (!apiKey) {
      const placeholder = container.querySelector('#journal-reflection-placeholder');
      if (placeholder) placeholder.innerHTML = `<div class="journal-reflection"><div class="reflection-text">No API key — go to Settings to add one.</div></div>`;
      return;
    }

    const btn = container.querySelector('#journal-reflect-btn');
    btn.disabled = true;
    btn.textContent = 'Thinking…';

    const activeMoodBtn = container.querySelector('.mood-btn.active');
    const moodLabel = activeMoodBtn ? activeMoodBtn.querySelector('.mood-name').textContent : 'neutral';

    try {
      const system = `You are a thoughtful journaling companion. Read the journal entry and write exactly 2 sentences of empathetic, insightful reflection. Be warm, personal, and encouraging. Don't ask questions. Focus on what's meaningful.`;
      const userMsg = `Mood: ${moodLabel}\n\nEntry:\n${text}`;
      const reflection = await callClaude(system, userMsg, 150);

      const existing = LS.getJSON(`lifeOS:journal:${date}`) || {};
      LS.setJSON(`lifeOS:journal:${date}`, { ...existing, reflection });

      const placeholder = container.querySelector('#journal-reflection-placeholder');
      if (placeholder) {
        placeholder.innerHTML = `
          <div class="journal-reflection">
            <div class="reflection-header">AI Reflection</div>
            <div class="reflection-text">${reflection}</div>
          </div>
        `;
      }
    } catch (e) {
      const placeholder = container.querySelector('#journal-reflection-placeholder');
      if (placeholder) placeholder.innerHTML = `<div class="journal-reflection"><div class="reflection-text">Error: ${e.message}</div></div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'AI Reflection';
    }
  });
}

function _renderJournalHistory() {
  const entries = [];
  for (let i = 1; i <= 7; i++) {
    const d = daysAgo(i);
    const e = LS.getJSON(`lifeOS:journal:${d}`);
    if (e && e.text) {
      entries.push({ date: d, ...e });
    }
  }

  if (entries.length === 0) return '<div class="empty-state">No entries in the last 7 days.</div>';

  const moods = ['', '😞', '😕', '😐', '🙂', '😄'];
  return entries.map(e => `
    <div class="journal-history-entry">
      <div class="journal-history-date">
        ${formatDate(e.date)}
        ${e.mood ? `<span class="history-mood">${moods[e.mood]}</span>` : ''}
      </div>
      <div class="journal-history-preview">${e.text.slice(0, 150)}${e.text.length > 150 ? '…' : ''}</div>
    </div>
  `).join('');
}

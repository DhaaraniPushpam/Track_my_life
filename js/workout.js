// ═══════════════════════════════════════════════════
// LIFE OS — workout.js
// Session log, PR detection, templates, history chart
// ═══════════════════════════════════════════════════

const DEFAULT_TEMPLATES = [
  {
    id: 'push', name: 'Push Day',
    exercises: ['Bench Press', 'Overhead Press', 'Incline DB Press', 'Lateral Raises', 'Tricep Pushdown']
  },
  {
    id: 'pull', name: 'Pull Day',
    exercises: ['Deadlift', 'Pull-ups', 'Barbell Row', 'Face Pulls', 'Bicep Curls']
  },
  {
    id: 'legs', name: 'Leg Day',
    exercises: ['Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Curl', 'Calf Raises']
  },
  {
    id: 'cardio', name: 'Cardio',
    exercises: ['Running', 'Cycling', 'Jump Rope', 'Rowing', 'Stair Climber']
  }
];

function renderWorkout(container) {
  const date = today();
  _renderWorkoutForDate(container, date);
}

function _renderWorkoutForDate(container, date) {
  const session = LS.getJSON(`lifeOS:workout:${date}`) || null;
  const prs = LS.getJSON('lifeOS:prs') || {};
  const streak = getWorkoutStreak();

  // 30-day workout log
  const recent = [];
  for (let i = 0; i < 30; i++) {
    const d = daysAgo(i);
    const s = LS.getJSON(`lifeOS:workout:${d}`);
    if (s) recent.push({ date: d, ...s });
  }

  // Volume chart (last 14 days)
  const chartData = [];
  const chartLabels = [];
  for (let i = 13; i >= 0; i--) {
    const d = daysAgo(i);
    const s = LS.getJSON(`lifeOS:workout:${d}`);
    let vol = 0;
    if (s?.exercises) {
      s.exercises.forEach(ex => {
        (ex.sets || []).forEach(set => { vol += (set.weight || 0) * (set.reps || 0); });
      });
    }
    chartData.push(vol);
    chartLabels.push(i % 7 === 0 ? d.slice(5) : '');
  }

  container.innerHTML = `
    <div class="module">
      <div class="module-header">
        <div class="module-title">Workout <span>Log</span></div>
        <div class="module-date">${formatDate(date)}</div>
      </div>

      <div class="workout-meta-row">
        <div class="workout-streak">
          <span class="streak-number">${streak}</span>
          <span class="streak-label">day streak</span>
        </div>
        <button class="btn primary" id="workout-log-btn">
          ${session ? 'Edit Today\'s Session' : '+ Log Workout'}
        </button>
      </div>

      ${session ? `
        <div class="workout-today-summary">
          <div class="workout-type-tag">${session.type || 'Workout'}</div>
          <div class="workout-duration">${session.duration || 0} min</div>
          <div class="workout-exercises-preview">
            ${(session.exercises || []).slice(0, 3).map(e => `<span class="exercise-chip">${e.name}</span>`).join('')}
            ${(session.exercises || []).length > 3 ? `<span class="exercise-chip">+${(session.exercises || []).length - 3} more</span>` : ''}
          </div>
          ${session.notes ? `<div class="workout-notes">${session.notes}</div>` : ''}
        </div>
      ` : '<div class="empty-state">No workout logged today.</div>'}

      <div id="workout-form" style="display:none;" class="workout-form">
        <div class="form-row">
          <div class="form-group">
            <label>Workout Type</label>
            <select id="workout-type">
              <option value="">Select type</option>
              ${DEFAULT_TEMPLATES.map(t => `<option value="${t.id}" ${session?.type === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
              <option value="other" ${session?.type === 'other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div class="form-group">
            <label>Duration (min)</label>
            <input type="number" id="workout-duration" min="1" max="300" value="${session?.duration || 45}">
          </div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <input type="text" id="workout-notes" placeholder="How did it go? Energy level, etc." value="${session?.notes || ''}">
        </div>

        <div class="exercises-section">
          <div class="exercises-header">
            <span class="section-subtitle">Exercises</span>
            <button class="btn small" id="load-template-btn">Load Template</button>
          </div>
          <div id="exercises-list">
            ${(session?.exercises || []).map((ex, i) => _exerciseHTML(ex, i, prs)).join('')}
          </div>
          <button class="btn small" id="add-exercise-btn">+ Add Exercise</button>
        </div>

        <div class="flex gap-8 mt-12">
          <button class="btn primary" id="workout-save-btn">Save Session</button>
          <button class="btn" id="workout-cancel-btn">Cancel</button>
        </div>
        <div id="workout-msg" style="font-size:12px;color:var(--text3);margin-top:6px;min-height:16px;"></div>
      </div>

      <div class="chart-section">
        <div class="chart-title">14-Day Training Volume (kg·reps)</div>
        ${makeSVGBar(chartData, Math.max(...chartData, 1000), 520, 100, chartLabels)}
      </div>

      <div class="workout-history">
        <div class="section-subtitle">Recent Sessions</div>
        ${recent.length === 0
          ? '<div class="empty-state">No recent workouts.</div>'
          : recent.slice(0, 7).map(s => `
            <div class="workout-history-item">
              <span class="workout-history-date">${formatDate(s.date)}</span>
              <span class="workout-type-tag small">${s.type || 'Workout'}</span>
              <span class="workout-history-dur">${s.duration || 0}m</span>
              <span class="workout-history-exercises">${(s.exercises || []).map(e => e.name).slice(0, 3).join(', ')}</span>
            </div>
          `).join('')}
      </div>
    </div>
  `;

  container.querySelector('#workout-log-btn').addEventListener('click', () => {
    const form = container.querySelector('#workout-form');
    form.style.display = form.style.display === 'none' ? '' : 'none';
  });

  container.querySelector('#workout-cancel-btn').addEventListener('click', () => {
    container.querySelector('#workout-form').style.display = 'none';
  });

  container.querySelector('#add-exercise-btn').addEventListener('click', () => {
    const list = container.querySelector('#exercises-list');
    const idx = list.querySelectorAll('.exercise-block').length;
    const div = document.createElement('div');
    div.innerHTML = _exerciseHTML({ name: '', sets: [{ weight: '', reps: '' }] }, idx, prs);
    list.appendChild(div.firstElementChild);
    _bindExerciseEvents(container, date);
  });

  container.querySelector('#load-template-btn').addEventListener('click', () => {
    const type = container.querySelector('#workout-type').value;
    const tmpl = DEFAULT_TEMPLATES.find(t => t.id === type);
    if (!tmpl) { container.querySelector('#workout-msg').textContent = 'Select a workout type first.'; return; }
    const list = container.querySelector('#exercises-list');
    list.innerHTML = tmpl.exercises.map((name, i) =>
      _exerciseHTML({ name, sets: [{ weight: '', reps: '' }] }, i, prs)
    ).join('');
    _bindExerciseEvents(container, date);
  });

  container.querySelector('#workout-save-btn').addEventListener('click', () => {
    const exercises = _collectExercises(container, prs, date);
    const type = container.querySelector('#workout-type').value;
    const duration = parseInt(container.querySelector('#workout-duration').value) || 0;
    const notes = container.querySelector('#workout-notes').value.trim();

    const sessionData = { type, duration, notes, exercises, date, savedAt: new Date().toISOString() };
    LS.setJSON(`lifeOS:workout:${date}`, sessionData);
    updateIndex(date);

    container.querySelector('#workout-msg').textContent = '✓ Session saved!';
    setTimeout(() => _renderWorkoutForDate(container, date), 800);
  });

  _bindExerciseEvents(container, date);
}

function _exerciseHTML(ex, idx, prs) {
  const pr = prs[ex.name];
  return `
    <div class="exercise-block" data-idx="${idx}">
      <div class="exercise-header-row">
        <input type="text" class="exercise-name-input" placeholder="Exercise name" value="${ex.name || ''}">
        ${pr ? `<span class="pr-badge">PR: ${pr.weight}kg×${pr.reps}</span>` : ''}
        <button class="btn danger small remove-exercise-btn" data-idx="${idx}">×</button>
      </div>
      <div class="sets-list">
        ${(ex.sets || []).map((set, si) => `
          <div class="set-row" data-si="${si}">
            <span class="set-num">Set ${si + 1}</span>
            <input type="number" class="set-weight" placeholder="kg" value="${set.weight || ''}" min="0" step="0.5">
            <span class="set-sep">×</span>
            <input type="number" class="set-reps" placeholder="reps" value="${set.reps || ''}" min="0">
            <button class="btn small remove-set-btn">−</button>
          </div>
        `).join('')}
      </div>
      <button class="btn small add-set-btn">+ Set</button>
    </div>
  `;
}

function _bindExerciseEvents(container, date) {
  container.querySelectorAll('.add-set-btn').forEach(btn => {
    btn.onclick = () => {
      const block = btn.closest('.exercise-block');
      const setList = block.querySelector('.sets-list');
      const si = setList.querySelectorAll('.set-row').length;
      const div = document.createElement('div');
      div.innerHTML = `
        <div class="set-row" data-si="${si}">
          <span class="set-num">Set ${si + 1}</span>
          <input type="number" class="set-weight" placeholder="kg" min="0" step="0.5">
          <span class="set-sep">×</span>
          <input type="number" class="set-reps" placeholder="reps" min="0">
          <button class="btn small remove-set-btn">−</button>
        </div>
      `;
      setList.appendChild(div.firstElementChild);
      _bindExerciseEvents(container, date);
    };
  });

  container.querySelectorAll('.remove-set-btn').forEach(btn => {
    btn.onclick = () => {
      const row = btn.closest('.set-row');
      const setList = row.closest('.sets-list');
      if (setList.querySelectorAll('.set-row').length > 1) {
        row.remove();
        setList.querySelectorAll('.set-row').forEach((r, i) => {
          r.querySelector('.set-num').textContent = `Set ${i + 1}`;
        });
      }
    };
  });

  container.querySelectorAll('.remove-exercise-btn').forEach(btn => {
    btn.onclick = () => btn.closest('.exercise-block').remove();
  });
}

function _collectExercises(container, prs, date) {
  const blocks = container.querySelectorAll('.exercise-block');
  const exercises = [];
  let newPRs = [];

  blocks.forEach(block => {
    const name = block.querySelector('.exercise-name-input').value.trim();
    if (!name) return;
    const sets = [];
    block.querySelectorAll('.set-row').forEach(row => {
      const weight = parseFloat(row.querySelector('.set-weight').value) || 0;
      const reps = parseInt(row.querySelector('.set-reps').value) || 0;
      if (weight > 0 || reps > 0) sets.push({ weight, reps });
    });
    exercises.push({ name, sets });

    // PR detection
    const bestSet = sets.reduce((best, s) => {
      const score = s.weight * s.reps;
      return score > (best.weight * best.reps) ? s : best;
    }, { weight: 0, reps: 0 });

    const existingPR = prs[name];
    if (!existingPR || (bestSet.weight * bestSet.reps > existingPR.weight * existingPR.reps)) {
      if (bestSet.weight > 0 && bestSet.reps > 0) {
        prs[name] = { weight: bestSet.weight, reps: bestSet.reps, date };
        newPRs.push(name);
      }
    }
  });

  if (newPRs.length > 0) {
    LS.setJSON('lifeOS:prs', prs);
  }
  return exercises;
}

// ═══════════════════════════════════════════════════
// LIFE OS — tasks.js
// CRUD tasks, priority, recurring, overdue detection
// ═══════════════════════════════════════════════════

function renderTasks(container) {
  const date = today();
  _renderTasksForDate(container, date);
}

function _renderTasksForDate(container, date) {
  const tasks = LS.getJSON(`lifeOS:tasks:${date}`) || [];
  const done = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const overdue = tasks.filter(t => !t.done && t.time && t.time < new Date().toTimeString().slice(0,5)).length;

  container.innerHTML = `
    <div class="module">
      <div class="module-header">
        <div class="module-title">Tasks <span>& To-Do</span></div>
        <div class="module-date">${formatDate(date)}</div>
      </div>

      <div class="tasks-header-row">
        <div class="tasks-progress-text">
          ${done} / ${total} done
          ${overdue > 0 ? `<span class="overdue-badge">${overdue} overdue</span>` : ''}
        </div>
        <button class="btn primary small" id="tasks-add-btn">+ Add Task</button>
      </div>
      ${total > 0 ? `
        <div class="progress-bar-wrap" style="margin-bottom:12px;">
          <div class="progress-bar" style="width:${total > 0 ? Math.round((done/total)*100) : 0}%"></div>
        </div>
      ` : ''}

      <div id="tasks-form" style="display:none;" class="tasks-form">
        <div class="form-row">
          <div class="form-group" style="flex:2;">
            <label>Task</label>
            <input type="text" id="task-title" placeholder="Task title">
          </div>
          <div class="form-group">
            <label>Time (opt)</label>
            <input type="time" id="task-time">
          </div>
          <div class="form-group">
            <label>Priority</label>
            <select id="task-priority">
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:2;">
            <label>Notes (optional)</label>
            <input type="text" id="task-notes" placeholder="Extra notes">
          </div>
          <div class="form-group">
            <label>Recurring</label>
            <select id="task-recurring">
              <option value="">None</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </div>
        <div class="flex gap-8">
          <button class="btn primary small" id="task-save-btn">Add</button>
          <button class="btn small" id="task-cancel-btn">Cancel</button>
        </div>
      </div>

      <div class="tasks-list" id="tasks-list">
        ${tasks.length === 0
          ? '<div class="empty-state">No tasks for today. Add one above.</div>'
          : _renderTaskGroups(tasks, date)}
      </div>
    </div>
  `;

  // Toggle add form
  container.querySelector('#tasks-add-btn').addEventListener('click', () => {
    const form = container.querySelector('#tasks-form');
    form.style.display = form.style.display === 'none' ? '' : 'none';
    if (form.style.display !== 'none') container.querySelector('#task-title').focus();
  });

  container.querySelector('#task-cancel-btn').addEventListener('click', () => {
    container.querySelector('#tasks-form').style.display = 'none';
  });

  container.querySelector('#task-save-btn').addEventListener('click', () => {
    const title = container.querySelector('#task-title').value.trim();
    if (!title) return;
    const task = {
      id: Date.now(),
      title,
      time: container.querySelector('#task-time').value || null,
      priority: container.querySelector('#task-priority').value,
      notes: container.querySelector('#task-notes').value.trim() || null,
      recurring: container.querySelector('#task-recurring').value || null,
      done: false,
      createdAt: new Date().toISOString()
    };
    _saveTask(date, task);
    _renderTasksForDate(container, date);
  });

  // Keyboard shortcut: Enter in title field
  container.querySelector('#task-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') container.querySelector('#task-save-btn').click();
  });

  // Checkbox toggles
  container.querySelectorAll('.task-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = parseInt(cb.dataset.id);
      const tasks = LS.getJSON(`lifeOS:tasks:${date}`) || [];
      const task = tasks.find(t => t.id === id);
      if (task) {
        task.done = cb.checked;
        task.completedAt = cb.checked ? new Date().toISOString() : null;
        LS.setJSON(`lifeOS:tasks:${date}`, tasks);
        _renderTasksForDate(container, date);
      }
    });
  });

  // Delete task
  container.querySelectorAll('.task-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const tasks = LS.getJSON(`lifeOS:tasks:${date}`) || [];
      LS.setJSON(`lifeOS:tasks:${date}`, tasks.filter(t => t.id !== id));
      _renderTasksForDate(container, date);
    });
  });
}

function _renderTaskGroups(tasks, date) {
  const now = new Date().toTimeString().slice(0, 5);
  const high = tasks.filter(t => t.priority === 'high' && !t.done);
  const normal = tasks.filter(t => t.priority !== 'high' && t.priority !== 'low' && !t.done);
  const low = tasks.filter(t => t.priority === 'low' && !t.done);
  const done = tasks.filter(t => t.done);

  let html = '';
  if (high.length) html += `<div class="task-group-label high">High Priority</div>` + high.map(t => _taskItemHTML(t, now)).join('');
  if (normal.length) html += `<div class="task-group-label">Tasks</div>` + normal.map(t => _taskItemHTML(t, now)).join('');
  if (low.length) html += `<div class="task-group-label low">Low Priority</div>` + low.map(t => _taskItemHTML(t, now)).join('');
  if (done.length) html += `<div class="task-group-label done">Completed (${done.length})</div>` + done.map(t => _taskItemHTML(t, now)).join('');
  return html;
}

function _taskItemHTML(task, now) {
  const isOverdue = !task.done && task.time && task.time < now;
  return `
    <div class="task-item ${task.done ? 'done' : ''} ${isOverdue ? 'overdue' : ''} priority-${task.priority || 'normal'}">
      <label class="task-check-label">
        <input type="checkbox" class="task-check" data-id="${task.id}" ${task.done ? 'checked' : ''}>
        <span class="task-check-box"></span>
      </label>
      <div class="task-item-body">
        <div class="task-title">${task.title}${task.recurring ? ` <span class="recurring-tag">${task.recurring}</span>` : ''}</div>
        <div class="task-meta">
          ${task.time ? `<span class="task-time ${isOverdue ? 'overdue' : ''}">${task.time}</span>` : ''}
          ${task.notes ? `<span class="task-notes">${task.notes}</span>` : ''}
        </div>
      </div>
      <button class="btn danger small task-delete-btn" data-id="${task.id}">×</button>
    </div>
  `;
}

function _saveTask(date, task) {
  const tasks = LS.getJSON(`lifeOS:tasks:${date}`) || [];
  tasks.push(task);
  LS.setJSON(`lifeOS:tasks:${date}`, tasks);
  updateIndex(date);
  // Schedule notification if time is set
  scheduleTaskReminders(date);
}

// Seed recurring tasks from yesterday into today if not already present
function seedRecurringTasks() {
  const date = today();
  const existing = LS.getJSON(`lifeOS:tasks:${date}`) || [];
  if (existing.length > 0) return; // already has tasks

  const yesterday = daysAgo(1);
  const prevTasks = LS.getJSON(`lifeOS:tasks:${yesterday}`) || [];
  const recurring = prevTasks.filter(t => t.recurring);

  if (recurring.length === 0) return;

  const dayOfWeek = new Date().getDay(); // 0=Sun, 6=Sat
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  const toAdd = recurring
    .filter(t => {
      if (t.recurring === 'daily') return true;
      if (t.recurring === 'weekdays') return isWeekday;
      if (t.recurring === 'weekly') {
        const prevDate = new Date(yesterday);
        return prevDate.getDay() === new Date().getDay();
      }
      return false;
    })
    .map(t => ({ ...t, id: Date.now() + Math.random(), done: false, completedAt: null, createdAt: new Date().toISOString() }));

  if (toAdd.length > 0) {
    LS.setJSON(`lifeOS:tasks:${date}`, toAdd);
    updateIndex(date);
  }
}

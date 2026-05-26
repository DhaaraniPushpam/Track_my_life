// ═══════════════════════════════════════════════════
// LIFE OS — meetings.js
// Month calendar grid, hover tooltip (meetings + tasks + journal), CRUD
// ═══════════════════════════════════════════════════

function renderMeetings(container) {
  const date = today();
  _renderMeetingsView(container, date);
}

function _renderMeetingsView(container, selectedDate) {
  const meetings = LS.getJSON(`lifeOS:meetings:${selectedDate}`) || [];
  const now = new Date().toTimeString().slice(0, 5);

  const upcoming = meetings
    .filter(m => !m.done && (!m.time || m.time >= now))
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const past = meetings.filter(m => m.done || (m.time && m.time < now));

  container.innerHTML = `
    <div class="module">
      <div class="module-header">
        <div class="module-title">Meetings <span>& Calendar</span></div>
        <div class="module-date">${formatDate(selectedDate)}</div>
      </div>

      ${_renderMonthCalendar(selectedDate)}

      <div class="meetings-add-section" style="margin-top:16px;">
        <button class="btn primary small" id="meetings-add-btn">+ Add Meeting</button>
      </div>

      <div id="meetings-form" style="display:none;" class="meetings-form">
        <div class="form-row">
          <div class="form-group" style="flex:2;">
            <label>Title</label>
            <input type="text" id="meeting-title" placeholder="Meeting title">
          </div>
          <div class="form-group">
            <label>Date</label>
            <input type="date" id="meeting-date" value="${selectedDate}">
          </div>
          <div class="form-group">
            <label>Time</label>
            <input type="time" id="meeting-time">
          </div>
          <div class="form-group">
            <label>Duration</label>
            <select id="meeting-duration">
              <option value="15">15 min</option>
              <option value="30" selected>30 min</option>
              <option value="45">45 min</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:2;">
            <label>Location / Link</label>
            <input type="text" id="meeting-location" placeholder="Room, Zoom link, etc.">
          </div>
          <div class="form-group" style="flex:2;">
            <label>Notes</label>
            <input type="text" id="meeting-notes" placeholder="Agenda, attendees...">
          </div>
        </div>
        <div class="flex gap-8">
          <button class="btn primary small" id="meeting-save-btn">Save</button>
          <button class="btn small" id="meeting-cancel-btn">Cancel</button>
        </div>
      </div>

      <div id="meetings-list-container">
        ${upcoming.length === 0 && past.length === 0
          ? `<div class="empty-state">No meetings on ${formatDate(selectedDate)}.</div>`
          : ''}

        ${upcoming.length > 0 ? `
          <div class="meetings-section-label">Upcoming</div>
          ${upcoming.map(m => _meetingItemHTML(m, selectedDate)).join('')}
        ` : ''}

        ${past.length > 0 ? `
          <div class="meetings-section-label past">Past / Done</div>
          ${past.map(m => _meetingItemHTML(m, selectedDate)).join('')}
        ` : ''}
      </div>
    </div>
  `;

  // Calendar day click — switch selected date
  container.querySelectorAll('.cal-day[data-date]').forEach(cell => {
    cell.addEventListener('click', e => {
      if (e.target.closest('.cal-tooltip')) return;
      const d = cell.dataset.date;
      _renderMeetingsView(container, d);
    });
  });

  // Tooltip: show on mouseenter, hide on mouseleave
  container.querySelectorAll('.cal-day[data-date]').forEach(cell => {
    cell.addEventListener('mouseenter', () => _showTooltip(cell));
    cell.addEventListener('mouseleave', () => _hideTooltip(cell));
  });

  // Month nav
  container.querySelector('#cal-prev-month').addEventListener('click', () => {
    const [y, m] = selectedDate.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    const newDate = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2,'0')}-01`;
    _renderMeetingsView(container, newDate);
  });
  container.querySelector('#cal-next-month').addEventListener('click', () => {
    const [y, m] = selectedDate.split('-').map(Number);
    const next = new Date(y, m, 1);
    const newDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2,'0')}-01`;
    _renderMeetingsView(container, newDate);
  });

  // Toggle form
  container.querySelector('#meetings-add-btn').addEventListener('click', () => {
    const form = container.querySelector('#meetings-form');
    form.style.display = form.style.display === 'none' ? '' : 'none';
  });
  container.querySelector('#meeting-cancel-btn').addEventListener('click', () => {
    container.querySelector('#meetings-form').style.display = 'none';
  });

  container.querySelector('#meeting-save-btn').addEventListener('click', () => {
    const title = container.querySelector('#meeting-title').value.trim();
    if (!title) return;
    const mDate = container.querySelector('#meeting-date').value || selectedDate;
    const meeting = {
      id: Date.now(),
      title,
      time: container.querySelector('#meeting-time').value || null,
      duration: parseInt(container.querySelector('#meeting-duration').value),
      location: container.querySelector('#meeting-location').value.trim() || null,
      notes: container.querySelector('#meeting-notes').value.trim() || null,
      done: false,
      createdAt: new Date().toISOString()
    };
    const list = LS.getJSON(`lifeOS:meetings:${mDate}`) || [];
    list.push(meeting);
    LS.setJSON(`lifeOS:meetings:${mDate}`, list);
    updateIndex(mDate);
    scheduleMeetingReminders(mDate);
    _renderMeetingsView(container, selectedDate);
  });

  // Delete & done
  container.querySelectorAll('.meeting-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const mDate = btn.dataset.date || selectedDate;
      const m = LS.getJSON(`lifeOS:meetings:${mDate}`) || [];
      LS.setJSON(`lifeOS:meetings:${mDate}`, m.filter(x => x.id !== id));
      _renderMeetingsView(container, selectedDate);
    });
  });

  container.querySelectorAll('.meeting-done-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const m = LS.getJSON(`lifeOS:meetings:${selectedDate}`) || [];
      const item = m.find(x => x.id === id);
      if (item) {
        item.done = !item.done;
        LS.setJSON(`lifeOS:meetings:${selectedDate}`, m);
        _renderMeetingsView(container, selectedDate);
      }
    });
  });
}

// ── Month calendar grid ───────────────────────────

function _renderMonthCalendar(selectedDate) {
  const [y, mo] = selectedDate.split('-').map(Number);
  const firstDay = new Date(y, mo - 1, 1);
  const lastDay  = new Date(y, mo, 0);
  const todayStr = today();

  // Monday-first offset
  const startOffset = (firstDay.getDay() + 6) % 7;

  const monthLabel = firstDay.toLocaleDateString('en', { month: 'long', year: 'numeric' });

  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const headerCells = dayNames.map(d => `<div class="cal-header-cell">${d}</div>`).join('');

  let cells = '';
  // Empty leading cells
  for (let i = 0; i < startOffset; i++) {
    cells += `<div class="cal-day empty"></div>`;
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const meetingList = LS.getJSON(`lifeOS:meetings:${dateStr}`) || [];
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;

    const chips = meetingList.slice(0, 3).map(m =>
      `<div class="cal-meeting-chip">${m.time ? m.time + ' ' : ''}${m.title}</div>`
    ).join('');
    const overflow = meetingList.length > 3
      ? `<div class="cal-meeting-overflow">+${meetingList.length - 3} more</div>`
      : '';

    cells += `
      <div class="cal-day ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" data-date="${dateStr}">
        <div class="cal-day-num">${d}</div>
        <div class="cal-chips">${chips}${overflow}</div>
      </div>
    `;
  }

  return `
    <div class="cal-wrap">
      <div class="cal-nav">
        <button class="btn small" id="cal-prev-month">‹</button>
        <div class="cal-month-label">${monthLabel}</div>
        <button class="btn small" id="cal-next-month">›</button>
      </div>
      <div class="cal-grid">
        ${headerCells}
        ${cells}
      </div>
    </div>
  `;
}

// ── Tooltip (meetings + tasks + journal) ─────────

function _showTooltip(cell) {
  _hideTooltip(cell);
  const dateStr = cell.dataset.date;
  if (!dateStr) return;

  const meetings = LS.getJSON(`lifeOS:meetings:${dateStr}`) || [];
  const tasks    = LS.getJSON(`lifeOS:tasks:${dateStr}`) || [];
  const journal  = LS.getJSON(`lifeOS:journal:${dateStr}`) || null;
  const moods    = ['', '😞', '😕', '😐', '🙂', '😄'];

  if (!meetings.length && !tasks.length && !journal) return;

  let html = `<div class="cal-tooltip">`;

  if (meetings.length) {
    html += `<div class="cal-tt-section-title">Meetings</div>`;
    meetings.forEach(m => {
      const endTime = m.time ? _addMinutesToTime(m.time, m.duration || 30) : null;
      html += `
        <div class="cal-tt-meeting">
          <div class="cal-tt-meeting-title">${m.title}</div>
          ${m.time ? `<div class="cal-tt-meta">${m.time}${endTime ? ' – ' + endTime : ''} · ${m.duration}m</div>` : ''}
          ${m.location ? `<div class="cal-tt-meta">📍 ${m.location}</div>` : ''}
          ${m.notes ? `<div class="cal-tt-meta">${m.notes}</div>` : ''}
        </div>
      `;
    });
  }

  if (tasks.length) {
    const done  = tasks.filter(t => t.done).length;
    html += `<div class="cal-tt-section-title" style="margin-top:8px;">Tasks <span style="color:var(--text3);font-weight:400;">${done}/${tasks.length}</span></div>`;
    tasks.slice(0, 6).forEach(t => {
      html += `<div class="cal-tt-task ${t.done ? 'done' : ''}">${t.done ? '✓' : '○'} ${t.title}</div>`;
    });
    if (tasks.length > 6) html += `<div class="cal-tt-meta">+${tasks.length - 6} more</div>`;
  }

  if (journal && journal.text) {
    html += `<div class="cal-tt-section-title" style="margin-top:8px;">Journal ${journal.mood ? moods[journal.mood] : ''}</div>`;
    html += `<div class="cal-tt-journal">${journal.text.slice(0, 160)}${journal.text.length > 160 ? '…' : ''}</div>`;
  }

  html += `</div>`;

  cell.insertAdjacentHTML('beforeend', html);

  // Flip tooltip if it overflows right edge
  const tooltip = cell.querySelector('.cal-tooltip');
  if (tooltip) {
    const rect = tooltip.getBoundingClientRect();
    if (rect.right > window.innerWidth - 16) {
      tooltip.classList.add('flip-left');
    }
    if (rect.bottom > window.innerHeight - 16) {
      tooltip.classList.add('flip-up');
    }
  }
}

function _hideTooltip(cell) {
  const existing = cell.querySelector('.cal-tooltip');
  if (existing) existing.remove();
}

// ── Meeting item row ──────────────────────────────

function _meetingItemHTML(meeting, date) {
  const endTime = meeting.time ? _addMinutesToTime(meeting.time, meeting.duration || 30) : null;
  return `
    <div class="meeting-item ${meeting.done ? 'done' : ''}">
      <div class="meeting-time-col">
        ${meeting.time ? `<div class="meeting-time">${meeting.time}</div>` : '<div class="meeting-time">—</div>'}
        ${endTime ? `<div class="meeting-end">${endTime}</div>` : ''}
        ${meeting.duration ? `<div class="meeting-dur">${meeting.duration}m</div>` : ''}
      </div>
      <div class="meeting-body">
        <div class="meeting-title">${meeting.title}</div>
        ${meeting.location ? `<div class="meeting-location">📍 ${meeting.location}</div>` : ''}
        ${meeting.notes ? `<div class="meeting-notes">${meeting.notes}</div>` : ''}
      </div>
      <div class="meeting-actions">
        <button class="btn small meeting-done-btn" data-id="${meeting.id}" data-date="${date}">${meeting.done ? 'Undone' : 'Done'}</button>
        <button class="btn danger small meeting-delete-btn" data-id="${meeting.id}" data-date="${date}">×</button>
      </div>
    </div>
  `;
}

function _addMinutesToTime(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

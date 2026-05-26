// ═══════════════════════════════════════════════════
// LIFE OS — meetings.js
// Meeting CRUD, week timeline, 5-min notifications
// ═══════════════════════════════════════════════════

function renderMeetings(container) {
  const date = today();
  _renderMeetingsView(container, date);
}

function _renderMeetingsView(container, date) {
  const meetings = LS.getJSON(`lifeOS:meetings:${date}`) || [];
  const now = new Date().toTimeString().slice(0, 5);

  // Build week view data (today + 6 days)
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(date, i - (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1));
    weekDays.push({ date: d, meetings: LS.getJSON(`lifeOS:meetings:${d}`) || [] });
  }

  const upcoming = meetings
    .filter(m => !m.done && m.time >= now)
    .sort((a, b) => a.time.localeCompare(b.time));
  const past = meetings.filter(m => m.time < now || m.done);

  container.innerHTML = `
    <div class="module">
      <div class="module-header">
        <div class="module-title">Meetings <span>& Calendar</span></div>
        <div class="module-date">${formatDate(date)}</div>
      </div>

      <div class="meetings-week-nav">
        ${weekDays.map(wd => `
          <div class="week-day-col ${wd.date === date ? 'active' : ''}" data-date="${wd.date}">
            <div class="week-day-name">${new Date(wd.date + 'T12:00').toLocaleDateString('en', {weekday:'short'})}</div>
            <div class="week-day-num">${parseInt(wd.date.slice(8))}</div>
            ${wd.meetings.length > 0 ? `<div class="week-day-dot"></div>` : ''}
          </div>
        `).join('')}
      </div>

      <div class="meetings-add-section">
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
            <input type="date" id="meeting-date" value="${date}">
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
          ? '<div class="empty-state">No meetings today.</div>'
          : ''}

        ${upcoming.length > 0 ? `
          <div class="meetings-section-label">Upcoming</div>
          ${upcoming.map(m => _meetingItemHTML(m, date)).join('')}
        ` : ''}

        ${past.length > 0 ? `
          <div class="meetings-section-label past">Past / Done</div>
          ${past.map(m => _meetingItemHTML(m, date)).join('')}
        ` : ''}
      </div>

      ${weekDays.some(wd => wd.meetings.length > 0) ? `
        <div class="chart-section">
          <div class="chart-title">This Week</div>
          ${_renderWeekTimeline(weekDays)}
        </div>
      ` : ''}
    </div>
  `;

  // Week nav day switching
  container.querySelectorAll('.week-day-col').forEach(col => {
    col.addEventListener('click', () => {
      const d = col.dataset.date;
      _renderMeetingsView(container, d);
    });
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
    const mDate = container.querySelector('#meeting-date').value || date;
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
    const meetings = LS.getJSON(`lifeOS:meetings:${mDate}`) || [];
    meetings.push(meeting);
    LS.setJSON(`lifeOS:meetings:${mDate}`, meetings);
    updateIndex(mDate);
    scheduleMeetingReminders(mDate);
    _renderMeetingsView(container, date);
  });

  // Delete & done buttons
  container.querySelectorAll('.meeting-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const mDate = btn.dataset.date || date;
      const m = LS.getJSON(`lifeOS:meetings:${mDate}`) || [];
      LS.setJSON(`lifeOS:meetings:${mDate}`, m.filter(x => x.id !== id));
      _renderMeetingsView(container, date);
    });
  });

  container.querySelectorAll('.meeting-done-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const m = LS.getJSON(`lifeOS:meetings:${date}`) || [];
      const item = m.find(x => x.id === id);
      if (item) {
        item.done = !item.done;
        LS.setJSON(`lifeOS:meetings:${date}`, m);
        _renderMeetingsView(container, date);
      }
    });
  });
}

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

function _renderWeekTimeline(weekDays) {
  const w = 520, h = 80;
  const colW = w / 7;
  const startHour = 8, endHour = 20;
  const hourSpan = endHour - startHour;

  let rects = '';
  weekDays.forEach((wd, col) => {
    wd.meetings.forEach(m => {
      if (!m.time) return;
      const [mh, mm] = m.time.split(':').map(Number);
      const startFrac = Math.max(0, (mh + mm / 60 - startHour) / hourSpan);
      const durFrac = Math.min(1 - startFrac, ((m.duration || 30) / 60) / hourSpan);
      if (startFrac >= 1) return;
      const x = col * colW + 2;
      const y = startFrac * h;
      const bh = Math.max(4, durFrac * h);
      rects += `<rect x="${x}" y="${y}" width="${colW - 4}" height="${bh}" fill="var(--accent)" opacity="0.7" rx="1"/>`;
      if (bh > 14) {
        rects += `<text x="${x + (colW-4)/2}" y="${y + bh/2 + 4}" text-anchor="middle" font-size="9" fill="var(--bg)">${m.time}</text>`;
      }
    });
  });

  // Hour lines
  let lines = '';
  for (let hr = startHour; hr <= endHour; hr += 2) {
    const y = ((hr - startHour) / hourSpan) * h;
    lines += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="var(--border)" stroke-width="0.5"/>`;
    lines += `<text x="0" y="${y - 2}" font-size="8" fill="var(--text3)">${hr}:00</text>`;
  }

  // Day labels
  let dayLabels = weekDays.map((wd, col) => {
    const name = new Date(wd.date + 'T12:00').toLocaleDateString('en', { weekday: 'short' });
    return `<text x="${col * colW + colW / 2}" y="${h + 14}" text-anchor="middle" font-size="9" fill="var(--text2)">${name}</text>`;
  }).join('');

  return `<svg width="${w}" height="${h + 20}" style="overflow:visible;">${lines}${rects}${dayLabels}</svg>`;
}

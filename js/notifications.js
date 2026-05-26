// ═══════════════════════════════════════════════════
// LIFE OS — notifications.js
// Browser notification API + setTimeout scheduling
// ═══════════════════════════════════════════════════

const scheduledTimers = [];

function initNotifications() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  scheduleTaskReminders(today());
  scheduleMeetingReminders(today());
}

function scheduleTaskReminders(date) {
  const tasks = LS.getJSON(`lifeOS:tasks:${date}`) || [];
  const now = Date.now();

  tasks.forEach(task => {
    if (task.done || !task.time) return;
    const [h, m] = task.time.split(':').map(Number);
    const fireAt = new Date(date + `T${task.time}:00`).getTime();
    const delay = fireAt - now;
    if (delay > 0 && delay < 86400000) {
      const tid = setTimeout(() => {
        fireNotification('Task Due', task.title, '📋');
      }, delay);
      scheduledTimers.push(tid);
    }
  });
}

function scheduleMeetingReminders(date) {
  const meetings = LS.getJSON(`lifeOS:meetings:${date}`) || [];
  const now = Date.now();

  meetings.forEach(meeting => {
    if (!meeting.time) return;
    const fireAt = new Date(date + `T${meeting.time}:00`).getTime() - 5 * 60 * 1000;
    const delay = fireAt - now;
    if (delay > 0 && delay < 86400000) {
      const tid = setTimeout(() => {
        fireNotification('Meeting in 5 min', meeting.title, '📅');
      }, delay);
      scheduledTimers.push(tid);
    }
  });
}

function fireNotification(title, body, icon) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: icon || '/favicon.ico' });
  } catch (e) {
    // silently ignore (e.g. blocked by browser policy)
  }
}

function clearScheduledTimers() {
  scheduledTimers.forEach(t => clearTimeout(t));
  scheduledTimers.length = 0;
}

// ── Alert checks (used by sidebar + dashboard) ───
function checkExpenseAlerts() {
  const goals = getGoals();
  const budgets = goals.budgets || {};
  const month = thisMonth();
  const expenses = LS.getJSON(`lifeOS:expense:${month}`) || [];
  const totals = {};
  expenses.forEach(e => {
    totals[e.category] = (totals[e.category] || 0) + e.amount;
  });
  return Object.entries(totals)
    .filter(([cat, amt]) => budgets[cat.toLowerCase()] && amt > budgets[cat.toLowerCase()])
    .map(([cat, amt]) => ({ category: cat, spent: amt, budget: budgets[cat.toLowerCase()] }));
}

function checkLearningAlerts() {
  const goals = LS.getJSON('lifeOS:learning:goals') || [];
  const today_ = today();
  const alerts = [];

  goals.forEach(g => {
    const log = LS.getJSON(`lifeOS:learning:log:${g.id}`) || [];
    const loggedHours = log.reduce((s, l) => s + l.minutes, 0) / 60;
    const createdAt = g.createdAt || daysAgo(30);
    const totalDays = daysBetween(createdAt, g.targetDate);
    const elapsed = daysBetween(createdAt, today_);
    const timeRatio = totalDays > 0 ? elapsed / totalDays : 0;
    const progressRatio = g.totalHours > 0 ? loggedHours / g.totalHours : 1;
    const expected = timeRatio * g.totalHours;
    const isBehind = loggedHours < expected * 0.85;
    const isCritical = timeRatio > 0.8 && progressRatio < 0.6;

    if (isCritical) {
      alerts.push({ id: g.id, topic: g.topic, level: 'critical' });
    } else if (isBehind) {
      alerts.push({ id: g.id, topic: g.topic, level: 'behind' });
    }
  });

  return alerts;
}

function updateSidebarBadges() {
  const expAlerts = checkExpenseAlerts();
  const learnAlerts = checkLearningAlerts();

  const expBadge = document.querySelector('[data-module="expenses"] .nav-badge');
  if (expBadge) {
    if (expAlerts.length > 0) {
      expBadge.textContent = expAlerts.length;
      expBadge.style.display = '';
    } else {
      expBadge.style.display = 'none';
    }
  }

  const learnBadge = document.querySelector('[data-module="learnings"] .nav-badge');
  if (learnBadge) {
    const critCount = learnAlerts.filter(a => a.level === 'critical').length;
    if (critCount > 0) {
      learnBadge.textContent = '!';
      learnBadge.style.display = '';
      learnBadge.className = 'nav-badge';
    } else if (learnAlerts.length > 0) {
      learnBadge.textContent = learnAlerts.length;
      learnBadge.style.display = '';
      learnBadge.className = 'nav-badge amber';
    } else {
      learnBadge.style.display = 'none';
    }
  }
}

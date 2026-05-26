// ═══════════════════════════════════════════════════
// LIFE OS — dashboard.js
// Life Score ring, TODAY/WEEK/MONTH/QUARTER/YEAR views
// ═══════════════════════════════════════════════════

let currentRange = 'today';

function renderDashboard(container) {
  container.innerHTML = `
    <div class="module" id="dashboard-module">
      <div class="module-header">
        <div class="module-title">Life <span>OS</span> Dashboard</div>
        <div id="dashboard-range" class="flex gap-8">
          ${['today','week','month','quarter','year'].map(r =>
            `<button class="range-btn${r === currentRange ? ' active' : ''}" data-range="${r}">${r.toUpperCase()}</button>`
          ).join('')}
        </div>
      </div>

      <div id="learning-alerts"></div>
      <div id="dashboard-body"></div>
    </div>
  `;

  container.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentRange = btn.dataset.range;
      container.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDashboardBody(container.querySelector('#dashboard-body'), currentRange);
    });
  });

  // Learning alerts banner
  const alerts = checkLearningAlerts();
  const alertsDiv = container.querySelector('#learning-alerts');
  if (alerts.length > 0) {
    alertsDiv.innerHTML = alerts.map(a =>
      `<div class="alert ${a.level === 'critical' ? 'red' : ''}">
        ⚠ <strong>${a.topic}</strong>: ${a.level === 'critical' ? 'Critical — less than 20% time, less than 60% done' : 'Behind pace on learning goal'}
        <span class="alert-close" onclick="this.parentElement.remove()">×</span>
      </div>`
    ).join('');
  }

  renderDashboardBody(container.querySelector('#dashboard-body'), currentRange);
}

function renderDashboardBody(el, range) {
  if (range === 'today') renderToday(el);
  else if (range === 'week') renderWeekMonth(el, 7);
  else if (range === 'month') renderWeekMonth(el, 30);
  else if (range === 'quarter') renderQuarterYear(el, 90);
  else renderQuarterYear(el, 365);
}

// ── Life Score ring ──────────────────────────────
function renderLifeScore(summary, prevSummary) {
  const score = summary.score || 0;
  const prevScore = prevSummary ? prevSummary.score : score;
  const delta = score - prevScore;
  const deltaStr = delta === 0 ? '→ same as before' :
    delta > 0 ? `↑ +${delta} vs prior period` : `↓ ${delta} vs prior period`;
  const deltaClass = delta > 0 ? 'up' : delta < 0 ? 'down' : '';

  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? '#c8f04a' : score >= 50 ? '#f0a030' : '#ff4444';

  const comps = summary.components || {};

  return `
    <div class="score-row">
      <div class="score-ring-wrap" style="width:100px;height:100px;">
        <svg width="100" height="100">
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="#222" stroke-width="6"/>
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="6"
            stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
            stroke-linecap="butt"
            transform="rotate(-90 50 50)"/>
        </svg>
        <div class="score-number">${score}</div>
      </div>
      <div class="score-meta">
        <div class="score-label">Life Score</div>
        <div class="score-title" style="font-size:36px;font-family:var(--mono);">${score}<span style="font-size:16px;color:var(--text2)">/100</span></div>
        <div class="score-delta ${deltaClass}">${deltaStr}</div>
      </div>
      <div class="score-breakdown">
        ${[
          ['Nutrition', comps.nutrition || 0, 20],
          ['Sleep', comps.sleep || 0, 15],
          ['Movement', comps.movement || 0, 20],
          ['Hydration', comps.hydration || 0, 10],
          ['Tasks', comps.tasks || 0, 15],
          ['Learning', comps.learning || 0, 10],
          ['Journal', comps.journal || 0, 10]
        ].map(([label, val, max]) => `
          <div class="score-item">
            <div class="score-item-label">${label}</div>
            <div class="score-item-val">${val}<span style="color:var(--text3);font-size:11px">/${max}</span></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ── TODAY view ───────────────────────────────────
function renderToday(el) {
  const s = getDailySummary(today());
  const prevS = getDailySummary(daysAgo(1));
  const goals = getGoals();
  const meetings = LS.getJSON(`lifeOS:meetings:${today()}`) || [];

  // Next meeting
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = meetings
    .filter(m => {
      const [h, mn] = m.time.split(':').map(Number);
      return h * 60 + mn >= nowMinutes;
    })
    .sort((a, b) => a.time.localeCompare(b.time));
  const nextMeeting = upcoming[0] || null;

  // Last workout
  let lastWorkoutName = 'None logged';
  for (let i = 0; i < 7; i++) {
    const w = LS.getJSON(`lifeOS:workout:${daysAgo(i)}`) || [];
    if (w.length > 0) { lastWorkoutName = w[w.length-1].name; break; }
  }

  // Learning
  const lGoals = LS.getJSON('lifeOS:learning:goals') || [];
  const learningAlerts = checkLearningAlerts();
  const mostBehind = learningAlerts.find(a => a.level === 'critical') ||
    learningAlerts.find(a => a.level === 'behind');

  // Expenses today
  const monthExpenses = LS.getJSON(`lifeOS:expense:${thisMonth()}`) || [];
  const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const monthBudgetTotal = Object.values(goals.budgets || {}).reduce((s, v) => s + v, 0);

  // Sleep sparkline (7 days)
  const sleepVals = [];
  for (let i = 6; i >= 0; i--) {
    const sl = LS.getJSON(`lifeOS:sleep:${daysAgo(i)}`);
    sleepVals.push(sl ? sl.hours : 0);
  }

  // Water circle
  const waterPct = Math.min(1, s.waterMl / s.waterGoal);

  // Overdue tasks
  const todayTasks = LS.getJSON(`lifeOS:tasks:${today()}`) || [];
  let overdueCnt = 0;
  const nowMs = Date.now();
  todayTasks.forEach(t => {
    if (!t.done && t.time) {
      const fireAt = new Date(today() + `T${t.time}:00`).getTime();
      if (fireAt < nowMs) overdueCnt++;
    }
  });

  el.innerHTML = `
    ${renderLifeScore(s, prevS)}

    <div class="today-grid">
      ${makeCard('🔥 CALORIES', `${s.cal}`, `/ ${s.calGoal} kcal`, s.cal/s.calGoal, false)}
      ${makeCard('💪 PROTEIN', `${Math.round(s.protein)}g`, `/ ${s.proteinGoal}g goal`, s.protein/s.proteinGoal, false)}
      ${makeWaterCard(s.waterMl, s.waterGoal)}
      ${makeSleepCard(s.sleepHours, s.sleepGoal, sleepVals)}
      ${makeCard('👟 STEPS', s.steps.toLocaleString(), `/ ${s.stepsGoal.toLocaleString()} goal`, s.steps/s.stepsGoal, false)}
      ${makeCard('⚡ ACTIVE', `${s.activeMin}`, 'minutes today', s.activeMin/60, false)}
      ${makeCard('📍 DISTANCE', `${(s.distance||0).toFixed(1)}`, 'km today', (s.distance||0)/5, false)}
      ${makeExpenseCard(s.spentToday, monthTotal, monthBudgetTotal)}
      ${makeTaskCard(s.tasksDone, s.tasksTotal, overdueCnt)}
      ${makeMeetingCard(nextMeeting)}
      ${makeJournalCard(s.journaled)}
      ${makeWorkoutCard(s.workedOut, lastWorkoutName)}
      ${makeLearningCard(lGoals.length, mostBehind)}
    </div>
  `;
}

function makeCard(label, main, sub, pct, over) {
  const fillClass = pct >= 1 ? (over ? 'over' : '') : pct >= 0.7 ? '' : 'warn';
  const barWidth = Math.min(100, Math.round(pct * 100));
  return `
    <div class="today-card">
      <div class="tc-label">${label}</div>
      <div class="tc-main">${main}</div>
      <div class="tc-sub">${sub}</div>
      <div class="tc-bar"><div class="tc-bar-fill ${fillClass}" style="width:${barWidth}%"></div></div>
    </div>
  `;
}

function makeWaterCard(ml, goal) {
  const pct = Math.min(1, ml / goal);
  return `
    <div class="today-card" style="display:flex;align-items:center;gap:10px;">
      <div style="flex-shrink:0">
        ${makeCircleProgress(ml, goal, 60)}
      </div>
      <div>
        <div class="tc-label">💧 WATER</div>
        <div class="tc-main" style="font-size:20px">${ml}</div>
        <div class="tc-sub">/ ${goal}ml</div>
      </div>
    </div>
  `;
}

function makeSleepCard(hours, goal, sparkVals) {
  const debt = Math.max(0, goal - hours);
  return `
    <div class="today-card">
      <div class="tc-label">😴 SLEEP</div>
      <div class="tc-main">${hours}h</div>
      <div class="tc-sub">${debt > 0 ? `-${debt.toFixed(1)}h debt` : 'goal met'}</div>
      <div style="margin-top:8px">${makeSparkline(sparkVals, 150, 28)}</div>
    </div>
  `;
}

function makeExpenseCard(today_, monthTotal, monthBudget) {
  const pct = monthBudget > 0 ? monthTotal / monthBudget : 0;
  return `
    <div class="today-card">
      <div class="tc-label">💸 EXPENSES</div>
      <div class="tc-main">₹${today_.toLocaleString()}</div>
      <div class="tc-sub">Month: ₹${monthTotal.toLocaleString()} / ₹${monthBudget.toLocaleString()}</div>
      <div class="tc-bar"><div class="tc-bar-fill ${pct >= 1 ? 'over' : ''}" style="width:${Math.min(100,pct*100)}%"></div></div>
    </div>
  `;
}

function makeTaskCard(done, total, overdue) {
  const pct = total > 0 ? done / total : 0;
  return `
    <div class="today-card">
      ${overdue > 0 ? `<div class="tc-badge">${overdue} overdue</div>` : ''}
      <div class="tc-label">✅ TASKS</div>
      <div class="tc-main">${done}<span style="font-size:16px;color:var(--text2)">/${total}</span></div>
      <div class="tc-sub">${total > 0 ? Math.round(pct*100) : 0}% complete</div>
      <div class="tc-bar"><div class="tc-bar-fill" style="width:${Math.round(pct*100)}%"></div></div>
    </div>
  `;
}

function makeMeetingCard(meeting) {
  return `
    <div class="today-card">
      <div class="tc-label">📅 NEXT MEETING</div>
      ${meeting ? `
        <div class="tc-main" style="font-size:18px">${meeting.time}</div>
        <div class="tc-sub" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${meeting.title}</div>
      ` : `
        <div class="tc-main" style="font-size:18px;color:var(--text3)">—</div>
        <div class="tc-sub">None today</div>
      `}
    </div>
  `;
}

function makeJournalCard(journaled) {
  return `
    <div class="today-card">
      <div class="tc-label">📓 JOURNAL</div>
      <div class="tc-main" style="font-size:28px">${journaled ? '✓' : '○'}</div>
      <div class="tc-sub" style="color:${journaled ? 'var(--green)' : 'var(--text3)'}">${journaled ? 'Written today' : 'Not yet'}</div>
    </div>
  `;
}

function makeWorkoutCard(worked, lastName) {
  return `
    <div class="today-card">
      <div class="tc-label">🏋️ WORKOUT</div>
      <div class="tc-main" style="font-size:22px;color:${worked ? 'var(--accent)' : 'var(--text3)'}">${worked ? '✓' : '—'}</div>
      <div class="tc-sub" style="max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${lastName}</div>
    </div>
  `;
}

function makeLearningCard(count, mostBehind) {
  return `
    <div class="today-card">
      <div class="tc-label">📚 LEARNING</div>
      <div class="tc-main">${count}</div>
      <div class="tc-sub">${count === 0 ? 'No active goals' :
        mostBehind ? `⚠ ${mostBehind.topic}` : 'All on pace'}</div>
    </div>
  `;
}

// ── WEEK / MONTH view ─────────────────────────────
function renderWeekMonth(el, days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) dates.push(daysAgo(i));

  const labels = dates.map(d => {
    const dt = new Date(d + 'T00:00:00');
    return days <= 7 ? ['Su','Mo','Tu','We','Th','Fr','Sa'][dt.getDay()] : String(dt.getDate());
  });

  // Aggregate data
  const calVals = [], proteinVals = [], waterVals = [], sleepVals = [],
    stepsVals = [], taskRates = [];

  dates.forEach(d => {
    const food = LS.getJSON(`lifeOS:food:${d}`) || [];
    calVals.push(food.reduce((s, f) => s + (f.cal||0), 0));
    proteinVals.push(food.reduce((s, f) => s + (f.protein||0), 0));

    const water = LS.getJSON(`lifeOS:water:${d}`) || [];
    waterVals.push(water.reduce((s, w) => s + (w.ml||0), 0));

    const sleep = LS.getJSON(`lifeOS:sleep:${d}`);
    sleepVals.push(sleep ? sleep.hours : 0);

    const fit = LS.getJSON(`lifeOS:fit:cache:${d}`) || {};
    const mov = LS.getJSON(`lifeOS:movement:${d}`) || [];
    stepsVals.push(fit.steps || mov.reduce((s, m) => s + (m.steps||0), 0));

    const tasks = LS.getJSON(`lifeOS:tasks:${d}`) || [];
    const done = tasks.filter(t => t.done).length;
    taskRates.push(tasks.length > 0 ? Math.round((done/tasks.length)*100) : 0);
  });

  const goals = getGoals();
  const avgSleep = sleepVals.length > 0 ? (sleepVals.reduce((s,v)=>s+v,0)/sleepVals.filter(v=>v>0).length || 0) : 0;
  const avgSteps = stepsVals.length > 0 ? Math.round(stepsVals.reduce((s,v)=>s+v,0)/stepsVals.length) : 0;

  // Expense breakdown
  const month = thisMonth();
  const expenses = LS.getJSON(`lifeOS:expense:${month}`) || [];
  const byCategory = {};
  const CATS = ['food','transport','health','entertainment','subscriptions','misc'];
  CATS.forEach(c => { byCategory[c] = 0; });
  expenses.forEach(e => {
    const cat = (e.category || '').toLowerCase();
    if (days <= 7) {
      const expDate = e.date;
      if (dates.includes(expDate)) byCategory[cat] = (byCategory[cat]||0) + e.amount;
    } else {
      byCategory[cat] = (byCategory[cat]||0) + e.amount;
    }
  });

  // Streaks
  const streaks = [
    { label: 'Water Streak', val: getWaterStreak(), unit: 'days' },
    { label: 'Workout Streak', val: getWorkoutStreak(), unit: 'days' },
    { label: 'Journal Streak', val: getJournalStreak(), unit: 'days' },
    { label: 'Sleep Goal', val: getSleepStreak(), unit: 'days' },
    { label: 'Step Goal', val: getStepStreak(), unit: 'days' },
  ];

  const W = Math.min(700, window.innerWidth - 120);
  const prevS = getDailySummary(daysAgo(days));
  const curS = getDailySummary(today());

  el.innerHTML = `
    ${renderLifeScore(curS, prevS)}

    <div class="streaks-row">
      ${streaks.map(s => `
        <div class="streak-item">
          <div class="streak-num">${s.val}</div>
          <div class="streak-label">${s.label}</div>
        </div>
      `).join('')}
    </div>

    <div class="chart-section">
      <div class="chart-section-title">🔥 Calories (kcal) — avg ${Math.round(calVals.reduce((s,v)=>s+v,0)/calVals.length||0)}</div>
      <div class="chart-wrap">${makeSVGBar(calVals, goals.calories, W, 100, labels)}</div>
    </div>

    <div class="chart-section">
      <div class="chart-section-title">💪 Protein (g) — avg ${Math.round(proteinVals.reduce((s,v)=>s+v,0)/proteinVals.length||0)}g</div>
      <div class="chart-wrap">${makeSVGLine(proteinVals, goals.protein, W, 80, labels)}</div>
    </div>

    <div class="chart-section">
      <div class="chart-section-title">💧 Water (ml) — avg ${Math.round(waterVals.reduce((s,v)=>s+v,0)/waterVals.length||0)}ml</div>
      <div class="chart-wrap">${makeSVGBar(waterVals, goals.water, W, 80, labels)}</div>
    </div>

    <div class="chart-section">
      <div class="chart-section-title">😴 Sleep (hours) — avg <span class="badge">${avgSleep.toFixed(1)}h</span></div>
      <div class="chart-wrap">${makeSVGBar(sleepVals, goals.sleep, W, 80, labels)}</div>
    </div>

    <div class="chart-section">
      <div class="chart-section-title">👟 Steps — avg <span class="badge">${avgSteps.toLocaleString()}</span></div>
      <div class="chart-wrap">${makeSVGBar(stepsVals, goals.steps, W, 80, labels)}</div>
    </div>

    <div class="chart-section">
      <div class="chart-section-title">✅ Task Completion Rate (%)</div>
      <div class="chart-wrap">${makeSVGLine(taskRates, 100, W, 80, labels)}</div>
    </div>

    <div class="chart-section">
      <div class="chart-section-title">💸 Expenses by Category</div>
      <div class="chart-wrap">
        ${renderExpenseBreakdown(byCategory, goals.budgets || {})}
      </div>
    </div>

    ${renderLearningProgress()}
  `;
}

function renderExpenseBreakdown(byCategory, budgets) {
  const CATS = ['food','transport','health','entertainment','subscriptions','misc'];
  const catColors = { food:'#44cc88', transport:'#4488ff', health:'#ff88aa', entertainment:'#aa88ff', subscriptions:'#f0a030', misc:'#888' };
  const total = Object.values(byCategory).reduce((s,v)=>s+v,0);
  if (total === 0) return '<p style="color:var(--text3);font-size:13px;padding:10px 0">No expenses in this period</p>';

  let html = '<div style="display:flex;flex-direction:column;gap:8px;">';
  CATS.forEach(cat => {
    const amt = byCategory[cat] || 0;
    const budget = budgets[cat] || 1;
    const pct = Math.min(100, (amt / budget) * 100);
    const over = amt > budget;
    html += `
      <div class="budget-row">
        <div class="budget-cat" style="text-transform:capitalize">${cat}</div>
        <div class="budget-bar-wrap">
          <div class="budget-bar">
            <div class="budget-fill ${over ? 'over' : ''}" style="width:${pct}%;background:${over ? 'var(--red)' : catColors[cat]}"></div>
          </div>
        </div>
        <div class="budget-nums" style="color:${over ? 'var(--red)' : 'var(--text2)'}">₹${amt.toLocaleString()} / ₹${budget.toLocaleString()}</div>
      </div>
    `;
  });
  html += '</div>';
  return html;
}

function renderLearningProgress() {
  const goals = LS.getJSON('lifeOS:learning:goals') || [];
  if (goals.length === 0) return '';

  let html = `<div class="chart-section"><div class="chart-section-title">📚 Learning Progress</div>`;
  goals.forEach(g => {
    const log = LS.getJSON(`lifeOS:learning:log:${g.id}`) || [];
    const logged = log.reduce((s, l) => s + l.minutes, 0) / 60;
    const pct = Math.min(100, Math.round((logged / g.totalHours) * 100));
    const daysLeft = daysBetween(today(), g.targetDate);
    const alerts = checkLearningAlerts();
    const alert = alerts.find(a => a.id === g.id);
    const statusClass = alert ? (alert.level === 'critical' ? 'critical' : 'behind') : 'ontrack';

    html += `
      <div class="learning-goal-card">
        <div class="lg-header">
          <div class="lg-title">${g.topic}</div>
          <div class="lg-status ${statusClass}">${statusClass === 'critical' ? '⚠ CRITICAL' : statusClass === 'behind' ? '⚠ Behind' : '✓ On pace'}</div>
        </div>
        <div class="lg-progress">
          <div class="lg-progress-bar-wrap">
            <div class="lg-progress-bar">
              <div class="lg-progress-fill ${statusClass}" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="lg-meta">${logged.toFixed(1)}h / ${g.totalHours}h (${pct}%) · ${Math.max(0,daysLeft)} days left</div>
        </div>
      </div>
    `;
  });
  html += '</div>';
  return html;
}

// ── QUARTER / YEAR view ───────────────────────────
function renderQuarterYear(el, days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) dates.push(daysAgo(i));

  // Weekly aggregates
  const bucketSize = days <= 90 ? 7 : 30;
  const buckets = [];
  for (let i = 0; i < dates.length; i += bucketSize) {
    const chunk = dates.slice(i, i + bucketSize);
    const label = days <= 90 ? `W${Math.floor(i/7)+1}` : new Date(chunk[0]+'T00:00:00').toLocaleDateString('en-US',{month:'short'});
    let calSum=0, proteinSum=0, waterSum=0, sleepSum=0, sleepCnt=0, stepsSum=0;
    chunk.forEach(d => {
      const food = LS.getJSON(`lifeOS:food:${d}`) || [];
      calSum += food.reduce((s,f) => s+(f.cal||0), 0);
      proteinSum += food.reduce((s,f) => s+(f.protein||0), 0);
      const water = LS.getJSON(`lifeOS:water:${d}`) || [];
      waterSum += water.reduce((s,w) => s+(w.ml||0), 0);
      const sleep = LS.getJSON(`lifeOS:sleep:${d}`);
      if (sleep && sleep.hours > 0) { sleepSum += sleep.hours; sleepCnt++; }
      const fit = LS.getJSON(`lifeOS:fit:cache:${d}`) || {};
      stepsSum += fit.steps || 0;
    });
    buckets.push({
      label,
      cal: Math.round(calSum / chunk.length),
      protein: Math.round(proteinSum / chunk.length),
      water: Math.round(waterSum / chunk.length),
      sleep: sleepCnt > 0 ? parseFloat((sleepSum/sleepCnt).toFixed(1)) : 0,
      steps: Math.round(stepsSum / chunk.length)
    });
  }

  const goals = getGoals();
  const W = Math.min(700, window.innerWidth - 120);
  const labels = buckets.map(b => b.label);

  // Trend computation vs prior half
  const half = Math.floor(buckets.length / 2);
  const cur = buckets.slice(half);
  const prev = buckets.slice(0, half);
  const avg = (arr, key) => arr.length > 0 ? arr.reduce((s,b) => s+(b[key]||0), 0)/arr.length : 0;

  function trendArrow(curVal, prevVal) {
    if (prevVal === 0) return '<span class="trend-flat">→</span>';
    const pct = (curVal - prevVal) / prevVal;
    if (pct > 0.03) return '<span class="trend-up">↑</span>';
    if (pct < -0.03) return '<span class="trend-down">↓</span>';
    return '<span class="trend-flat">→</span>';
  }

  // Biggest wins
  const wins = computeBiggestWins(dates);

  const curS = getDailySummary(today());
  const prevS = getDailySummary(daysAgo(days));

  el.innerHTML = `
    ${renderLifeScore(curS, prevS)}

    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:20px;">
      ${[
        ['Calories', avg(cur,'cal'), avg(prev,'cal'), goals.calories, 'kcal'],
        ['Protein', avg(cur,'protein'), avg(prev,'protein'), goals.protein, 'g'],
        ['Water', avg(cur,'water'), avg(prev,'water'), goals.water, 'ml'],
        ['Sleep', avg(cur,'sleep'), avg(prev,'sleep'), goals.sleep, 'h'],
        ['Steps', avg(cur,'steps'), avg(prev,'steps'), goals.steps, ''],
      ].map(([label, curVal, prevVal, goal, unit]) => `
        <div class="today-card">
          <div class="tc-label">${label} ${trendArrow(curVal, prevVal)}</div>
          <div class="tc-main" style="font-size:20px">${Math.round(curVal).toLocaleString()}${unit}</div>
          <div class="tc-sub">avg · goal ${goal.toLocaleString()}${unit}</div>
          <div class="tc-bar"><div class="tc-bar-fill ${curVal >= goal ? '' : 'warn'}" style="width:${Math.min(100,Math.round(curVal/goal*100))}%"></div></div>
        </div>
      `).join('')}
    </div>

    <div class="chart-section">
      <div class="chart-section-title">🔥 Avg Daily Calories — ${days <= 90 ? 'by week' : 'by month'}</div>
      <div class="chart-wrap">${makeSVGBar(buckets.map(b=>b.cal), goals.calories, W, 100, labels)}</div>
    </div>

    <div class="chart-section">
      <div class="chart-section-title">👟 Avg Daily Steps</div>
      <div class="chart-wrap">${makeSVGBar(buckets.map(b=>b.steps), goals.steps, W, 80, labels)}</div>
    </div>

    <div class="chart-section">
      <div class="chart-section-title">😴 Avg Sleep Hours</div>
      <div class="chart-wrap">${makeSVGLine(buckets.map(b=>b.sleep), goals.sleep, W, 80, labels)}</div>
    </div>

    <div class="chart-section">
      <div class="chart-section-title">🏆 Biggest Wins</div>
      <div class="wins-grid">
        ${wins.map(w => `
          <div class="win-card">
            <div class="win-title">${w.label}</div>
            <div class="win-value">${w.value}</div>
          </div>
        `).join('')}
      </div>
    </div>

    ${renderLearningProgress()}
  `;
}

function computeBiggestWins(dates) {
  const wins = [];
  const goals = getGoals();

  // Longest water streak
  const wStreak = getWaterStreak();
  wins.push({ label: 'Longest Water Streak', value: `${wStreak} days` });

  // Longest workout streak
  const workStreak = getWorkoutStreak();
  wins.push({ label: 'Longest Workout Streak', value: `${workStreak} days` });

  // Most consistent metric (highest % of days goal met)
  let bestMetric = '', bestPct = 0;
  const metricChecks = [
    ['Calories', d => { const f=LS.getJSON(`lifeOS:food:${d}`)||[]; return f.reduce((s,x)=>s+(x.cal||0),0) >= goals.calories*0.9; }],
    ['Water', d => { const w=LS.getJSON(`lifeOS:water:${d}`)||[]; return w.reduce((s,x)=>s+(x.ml||0),0) >= goals.water; }],
    ['Sleep', d => { const s=LS.getJSON(`lifeOS:sleep:${d}`); return !!(s && s.hours >= goals.sleep); }],
  ];
  metricChecks.forEach(([name, checkFn]) => {
    const metDays = dates.filter(checkFn).length;
    const pct = dates.length > 0 ? metDays / dates.length : 0;
    if (pct > bestPct) { bestPct = pct; bestMetric = name; }
  });
  wins.push({ label: 'Most Consistent Metric', value: `${bestMetric} — ${Math.round(bestPct*100)}% of days` });

  // Best expense category (most under budget)
  const month = thisMonth();
  const expenses = LS.getJSON(`lifeOS:expense:${month}`) || [];
  const budgets = goals.budgets || {};
  const totals = {};
  expenses.forEach(e => { totals[e.category] = (totals[e.category]||0) + e.amount; });
  let bestSaving = -Infinity, bestCat = '';
  Object.entries(budgets).forEach(([cat, budget]) => {
    const spent = totals[cat] || 0;
    const saving = budget - spent;
    if (saving > bestSaving) { bestSaving = saving; bestCat = cat; }
  });
  if (bestCat) wins.push({ label: `Best Spending — ${bestCat}`, value: `₹${Math.round(bestSaving).toLocaleString()} under budget` });

  // Journal consistency
  const journalDays = dates.filter(d => { const j=LS.getJSON(`lifeOS:journal:${d}`); return !!(j&&j.text&&j.text.trim()); }).length;
  wins.push({ label: 'Journal Consistency', value: `${journalDays} / ${dates.length} days` });

  return wins.slice(0, 6);
}

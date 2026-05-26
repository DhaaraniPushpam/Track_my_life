// ═══════════════════════════════════════════════════
// LIFE OS — sleep.js
// Bedtime/wake form, debt calc, Fit pull, 30-day chart
// ═══════════════════════════════════════════════════

function renderSleep(container) {
  const date = today();
  _renderSleepForDate(container, date);
}

function _renderSleepForDate(container, date) {
  const entry = LS.getJSON(`lifeOS:sleep:${date}`) || null;
  const goals = getGoals();
  const goalHours = goals.sleep || 7.5;

  // Build 30-day sleep data
  const chartData = [];
  const chartLabels = [];
  let totalDebt = 0;
  for (let i = 29; i >= 0; i--) {
    const d = daysAgo(i);
    const e = LS.getJSON(`lifeOS:sleep:${d}`);
    const hrs = e ? e.duration : 0;
    chartData.push(hrs);
    chartLabels.push(i % 7 === 0 ? d.slice(5) : '');
    totalDebt += Math.max(0, goalHours - hrs);
  }

  const hours = entry ? entry.duration : null;
  const quality = entry ? entry.quality : null;
  const qualityLabels = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Great'];
  const qualityColors = ['', '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#c8f04a'];

  container.innerHTML = `
    <div class="module">
      <div class="module-header">
        <div class="module-title">Sleep <span>Tracker</span></div>
        <div class="module-date">${formatDate(date)}</div>
      </div>

      <div class="sleep-main">
        <div class="sleep-summary-card ${hours === null ? 'empty' : hours >= goalHours ? 'good' : 'bad'}">
          ${hours === null
            ? '<div class="sleep-no-data">No sleep logged for today</div>'
            : `
              <div class="sleep-hours">${hours.toFixed(1)}<span class="sleep-unit">hrs</span></div>
              <div class="sleep-quality-label" style="color:${qualityColors[quality] || 'var(--text2)'}">
                ${qualityLabels[quality] || ''}
              </div>
              <div class="sleep-vs-goal">${hours >= goalHours ? '↑' : '↓'} ${Math.abs(hours - goalHours).toFixed(1)}h ${hours >= goalHours ? 'over' : 'under'} goal</div>
            `}
        </div>

        <div class="sleep-debt-card">
          <div class="sleep-debt-label">30-Day Sleep Debt</div>
          <div class="sleep-debt-value">${totalDebt.toFixed(1)} hrs</div>
          <div class="sleep-debt-sub">${totalDebt <= 5 ? 'Well rested' : totalDebt <= 15 ? 'Moderate deficit' : 'High deficit'}</div>
        </div>
      </div>

      <div class="sleep-form">
        <div class="form-row">
          <div class="form-group">
            <label>Bedtime</label>
            <input type="time" id="sleep-bedtime" value="${entry ? entry.bedtime : '23:00'}">
          </div>
          <div class="form-group">
            <label>Wake Time</label>
            <input type="time" id="sleep-wake" value="${entry ? entry.wake : '07:00'}">
          </div>
          <div class="form-group">
            <label>Quality (1-5)</label>
            <select id="sleep-quality">
              <option value="">Select</option>
              ${[1,2,3,4,5].map(n => `<option value="${n}" ${entry && entry.quality === n ? 'selected' : ''}>${n} – ${qualityLabels[n]}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Notes (optional)</label>
          <input type="text" id="sleep-notes" placeholder="e.g. woke up twice, vivid dreams" value="${entry ? (entry.notes || '') : ''}">
        </div>
        <div class="flex gap-8">
          <button class="btn primary" id="sleep-save-btn">Save Sleep Log</button>
          ${entry ? '<button class="btn danger" id="sleep-clear-btn">Clear</button>' : ''}
        </div>
        <div id="sleep-msg" style="font-size:12px;color:var(--text3);margin-top:6px;"></div>
      </div>

      <div class="chart-section">
        <div class="chart-title">30-Day Sleep Duration</div>
        ${makeSVGBar(chartData, goalHours, 520, 120, chartLabels)}
      </div>
    </div>
  `;

  container.querySelector('#sleep-save-btn').addEventListener('click', () => {
    const bedtime = container.querySelector('#sleep-bedtime').value;
    const wake = container.querySelector('#sleep-wake').value;
    const quality = parseInt(container.querySelector('#sleep-quality').value) || null;
    const notes = container.querySelector('#sleep-notes').value.trim();

    if (!bedtime || !wake) {
      container.querySelector('#sleep-msg').textContent = 'Please enter both bedtime and wake time.';
      return;
    }

    const duration = _calcSleepDuration(bedtime, wake);
    const sleepEntry = { bedtime, wake, duration, quality, notes, date };
    LS.setJSON(`lifeOS:sleep:${date}`, sleepEntry);
    updateIndex(date);
    container.querySelector('#sleep-msg').textContent = `Saved: ${duration.toFixed(1)} hours sleep`;
    _renderSleepForDate(container, date);
  });

  const clearBtn = container.querySelector('#sleep-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      LS.remove(`lifeOS:sleep:${date}`);
      _renderSleepForDate(container, date);
    });
  }
}

function _calcSleepDuration(bedtime, wake) {
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let bedMins = bh * 60 + bm;
  let wakeMins = wh * 60 + wm;
  if (wakeMins <= bedMins) wakeMins += 24 * 60; // past midnight
  return (wakeMins - bedMins) / 60;
}

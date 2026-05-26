// ═══════════════════════════════════════════════════
// LIFE OS — fit.js
// Google Fit OAuth 2.0 implicit flow + REST API
// ═══════════════════════════════════════════════════

const FIT_SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/fitness.sleep.read'
].join(' ');

const FIT_DATA_TYPES = {
  steps:     'com.google.step_count.delta',
  activeMin: 'com.google.active_minutes',
  distance:  'com.google.distance.delta',
  cal:       'com.google.calories.expended',
  sleep:     'com.google.sleep.segment',
  heart:     'com.google.heart_minutes'
};

// ── Token management ─────────────────────────────
function getFitToken() {
  return LS.getJSON('lifeOS:fit:token');
}

function saveFitToken(accessToken, expiresIn) {
  LS.setJSON('lifeOS:fit:token', {
    access_token: accessToken,
    expires_at: Date.now() + (expiresIn - 60) * 1000
  });
}

function clearFitToken() {
  LS.remove('lifeOS:fit:token');
}

function isFitConnected() {
  const t = getFitToken();
  return !!(t && t.access_token && t.expires_at > Date.now());
}

function getFitClientId() {
  return LS.get('lifeOS:fit:clientid') || '';
}

// ── OAuth implicit flow ──────────────────────────
function fitConnect(clientId) {
  if (!clientId) {
    alert('Please enter your Google OAuth Client ID first.');
    return;
  }
  const redirectUri = window.location.href.split('#')[0].split('?')[0];
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: FIT_SCOPES,
    include_granted_scopes: 'true'
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  window.location.href = authUrl;
}

function handleFitCallback() {
  const hash = window.location.hash;
  if (!hash.includes('access_token')) return false;
  const params = new URLSearchParams(hash.slice(1));
  const token = params.get('access_token');
  const expiresIn = parseInt(params.get('expires_in') || '3600', 10);
  if (token) {
    saveFitToken(token, expiresIn);
    // Clean URL
    history.replaceState(null, '', window.location.pathname);
    return true;
  }
  return false;
}

// ── Dataset aggregate fetch ───────────────────────
async function fitAggregate(dataTypeName, startMs, endMs) {
  const t = getFitToken();
  if (!t) throw new Error('NOT_CONNECTED');

  const body = {
    aggregateBy: [{ dataTypeName }],
    bucketByTime: { durationMillis: endMs - startMs },
    startTimeMillis: startMs,
    endTimeMillis: endMs
  };

  const resp = await fetch(
    'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${t.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );

  if (resp.status === 401) {
    clearFitToken();
    window.dispatchEvent(new CustomEvent('fitDisconnected'));
    throw new Error('TOKEN_EXPIRED');
  }

  if (!resp.ok) throw new Error(`Fit API ${resp.status}`);
  return resp.json();
}

function extractFitValue(bucket, aggregateIdx) {
  try {
    const ds = bucket.dataset[aggregateIdx || 0];
    if (!ds || !ds.point || ds.point.length === 0) return 0;
    const val = ds.point[0].value[0];
    return val.fpVal || val.intVal || 0;
  } catch { return 0; }
}

// ── Per-day Fit data fetch (with 1h cache) ────────
async function fetchFitDay(dateString) {
  const cacheKey = `lifeOS:fit:cache:${dateString}`;
  const cached = LS.getJSON(cacheKey);
  if (cached && cached.ts && (Date.now() - cached.ts) < 3600000) {
    return cached;
  }

  if (!isFitConnected()) return null;

  const start = new Date(dateString + 'T00:00:00').getTime();
  const end = new Date(dateString + 'T23:59:59').getTime();

  try {
    const [stepsData, activeData, distData, calData] = await Promise.all([
      fitAggregate(FIT_DATA_TYPES.steps, start, end),
      fitAggregate(FIT_DATA_TYPES.activeMin, start, end),
      fitAggregate(FIT_DATA_TYPES.distance, start, end),
      fitAggregate(FIT_DATA_TYPES.cal, start, end)
    ]);

    const steps = extractFitValue(stepsData.bucket?.[0] || {});
    const activeMin = extractFitValue(activeData.bucket?.[0] || {});
    const distance = parseFloat(extractFitValue(distData.bucket?.[0] || {}).toFixed(2));
    const cal = Math.round(extractFitValue(calData.bucket?.[0] || {}));

    const result = { steps, activeMin, distance, cal, ts: Date.now() };
    LS.setJSON(cacheKey, result);
    return result;
  } catch (e) {
    console.warn('Fit fetch failed:', e.message);
    return null;
  }
}

async function fetchFitSleep(days) {
  if (!isFitConnected()) return [];

  const end = Date.now();
  const start = end - days * 86400000;

  try {
    const data = await fitAggregate(FIT_DATA_TYPES.sleep, start, end);
    const segments = [];
    (data.bucket || []).forEach(b => {
      (b.dataset || []).forEach(ds => {
        (ds.point || []).forEach(p => {
          if (p.value && p.value.length > 0) {
            segments.push({
              start: parseInt(p.startTimeNanos) / 1e6,
              end: parseInt(p.endTimeNanos) / 1e6,
              type: p.value[0].intVal
            });
          }
        });
      });
    });
    return segments;
  } catch (e) {
    return [];
  }
}

async function getFitToday() {
  return fetchFitDay(today());
}

async function getFitLast30Days() {
  if (!isFitConnected()) return [];
  const results = [];
  for (let i = 0; i < 30; i++) {
    const d = daysAgo(i);
    const data = await fetchFitDay(d);
    results.unshift({ date: d, ...(data || { steps: 0, activeMin: 0, distance: 0, cal: 0 }) });
  }
  return results;
}

// ── Render Fit module ─────────────────────────────
function renderFit(container) {
  const connected = isFitConnected();
  const clientId = getFitClientId();

  if (!connected) {
    container.innerHTML = `
      <div class="module">
        <div class="module-header">
          <div class="module-title">Google <span>Fit</span> Integration</div>
        </div>

        <div class="fit-setup">
          <h2>Connect Google Fit</h2>
          <p style="font-size:13px;color:var(--text2);margin-bottom:14px;">
            Connect your Google Fit account to automatically sync steps, active minutes,
            distance, calories burned, and sleep data.
          </p>
          <ol>
            <li>Go to <strong style="color:var(--accent)">console.cloud.google.com</strong> and create an OAuth 2.0 Client ID</li>
            <li>Set Authorized JavaScript Origins to your current URL: <code style="font-family:var(--mono);font-size:11px;color:var(--accent)">${window.location.origin}</code></li>
            <li>Enable the Fitness API in your project</li>
            <li>Paste your Client ID below and click Connect</li>
          </ol>
          <div class="form-row">
            <div class="form-group">
              <label>Google OAuth Client ID</label>
              <input type="text" id="fit-client-id" placeholder="xxxx.apps.googleusercontent.com" value="${clientId}">
            </div>
          </div>
          <div class="flex gap-8 mt-8">
            <button class="btn primary" id="fit-connect-btn">Connect Google Fit</button>
            <button class="btn" id="fit-save-id-btn">Save Client ID</button>
          </div>
          <div id="fit-msg" style="margin-top:10px;font-size:12px;color:var(--text3)"></div>
        </div>

        <div style="margin-top:20px;padding:14px;background:var(--bg1);border:1px solid var(--border);">
          <p style="font-size:12px;color:var(--text2);line-height:1.7">
            <strong style="color:var(--text)">Note:</strong> Google Fit data will appear in the Movement module and Dashboard once connected.
            Movement data is cached for 1 hour to minimize API calls. You can also log movement manually at any time.
          </p>
        </div>
      </div>
    `;

    container.querySelector('#fit-save-id-btn').addEventListener('click', () => {
      const id = container.querySelector('#fit-client-id').value.trim();
      if (id) {
        LS.set('lifeOS:fit:clientid', id);
        container.querySelector('#fit-msg').textContent = 'Client ID saved.';
      }
    });

    container.querySelector('#fit-connect-btn').addEventListener('click', () => {
      const id = container.querySelector('#fit-client-id').value.trim();
      if (!id) {
        container.querySelector('#fit-msg').textContent = 'Please enter your Client ID first.';
        return;
      }
      LS.set('lifeOS:fit:clientid', id);
      fitConnect(id);
    });

  } else {
    const t = getFitToken();
    const expiresIn = Math.round((t.expires_at - Date.now()) / 60000);

    container.innerHTML = `
      <div class="module">
        <div class="module-header">
          <div class="module-title">Google <span>Fit</span> Integration</div>
          <button class="btn danger small" id="fit-disconnect-btn">Disconnect</button>
        </div>

        <div class="fit-connected-banner">
          <div class="icon">✓</div>
          <div class="text">
            <strong>Connected to Google Fit</strong><br>
            Token expires in ~${expiresIn} minutes
          </div>
        </div>

        <div style="background:var(--bg1);border:1px solid var(--border);padding:14px 16px;">
          <h3 style="font-family:var(--mono);font-size:11px;color:var(--text2);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">Data Sync Status</h3>
          <p style="font-size:13px;color:var(--text2);margin-bottom:8px;">
            Fitness data is fetched on Dashboard load and cached for 1 hour per day.
          </p>
          <p style="font-size:12px;color:var(--text3);">Syncing: Steps · Active Minutes · Distance · Calories · Sleep</p>
          <div class="flex gap-8 mt-12">
            <button class="btn" id="fit-refresh-btn">Refresh Today's Data</button>
          </div>
          <div id="fit-refresh-msg" style="margin-top:8px;font-size:12px;color:var(--text3)"></div>
        </div>
      </div>
    `;

    container.querySelector('#fit-disconnect-btn').addEventListener('click', () => {
      clearFitToken();
      renderFit(container);
      updateSidebarFitStatus();
    });

    container.querySelector('#fit-refresh-btn').addEventListener('click', async () => {
      const msg = container.querySelector('#fit-refresh-msg');
      msg.textContent = 'Refreshing…';
      LS.remove(`lifeOS:fit:cache:${today()}`);
      try {
        await fetchFitDay(today());
        msg.textContent = 'Refreshed successfully.';
      } catch (e) {
        msg.textContent = `Error: ${e.message}`;
      }
    });
  }
}

function updateSidebarFitStatus() {
  const dot = document.querySelector('.fit-dot');
  const label = document.querySelector('#fit-status-label');
  if (dot) dot.className = 'fit-dot' + (isFitConnected() ? ' connected' : '');
  if (label) label.textContent = isFitConnected() ? 'Fit Connected' : 'Fit Not Connected';
}

window.addEventListener('fitDisconnected', () => {
  updateSidebarFitStatus();
});

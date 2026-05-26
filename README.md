# Life OS

A personal life management dashboard that runs entirely in your browser — no backend, no accounts, no tracking.

Track your daily health, fitness, finances, and personal growth in one place. Works offline, installs as a home screen app on Android, and deploys for free on GitHub Pages.

---

## Features

- **Dashboard** — Daily Life Score (0–100) built from 7 weighted components: nutrition, sleep, movement, hydration, tasks, learning, and journaling
- **Food** — Log meals and macros (calories, protein, carbs, fat) with optional AI-powered nutrition estimation via Claude
- **Water** — Hydration tracking with daily goal progress
- **Sleep** — Log bedtime, wake time, hours, and sleep quality
- **Movement** — Manual step and activity logging
- **Workout** — Strength training tracker with exercise templates, set/rep/weight logging, and personal best tracking
- **Tasks** — Daily to-do list with priorities and recurring task support
- **Meetings** — Schedule and log meetings with duration and notes
- **Journal** — Daily reflections with mood tracking and AI-powered summaries
- **Learnings** — Goal-based learning tracker with pacing alerts (are you on track to hit your target hours?)
- **Expenses** — Budget tracking across 6 categories with monthly views (INR)
- **Google Fit** — OAuth 2.0 integration for automatic step count, active minutes, and calories

---

## Tech Stack

- Vanilla HTML, CSS, JavaScript — no frameworks, no build tools, no dependencies
- All data stored in browser `localStorage` — nothing leaves your device
- Optional: [Anthropic Claude API](https://console.anthropic.com/) for AI features (food parsing, journal summaries)
- Optional: Google Fit OAuth 2.0 for fitness data sync

---

## Deploy to GitHub Pages

1. Fork or clone this repository
2. Go to **Settings → Pages** in your GitHub repo
3. Set source to `main` branch, root `/`
4. Your app will be live at `https://yourusername.github.io/track_my_life`

---

## Install on Android

1. Open the GitHub Pages URL (`https://yourusername.github.io/track_my_life`) in **Chrome on Android**
2. Tap the three-dot menu → **"Add to Home screen"**
3. Tap **Add** — the app icon appears on your home screen
4. Opens full-screen with no browser UI, just like a native app

---

## Optional Setup

### AI Features (Claude API)
1. Get an API key from [console.anthropic.com](https://console.anthropic.com/)
2. Open the app → **Settings → AI Integration**
3. Paste your key and save

Enables: automatic nutrition parsing from food descriptions, journal reflection summaries, learning goal summaries.

### Google Fit Integration
1. Create an OAuth 2.0 Client ID in [Google Cloud Console](https://console.cloud.google.com/) (Web application type)
2. Add your GitHub Pages URL as an authorised redirect URI
3. Open the app → **Settings → Google Fit** → paste the Client ID
4. Click **Connect Fit** in the sidebar

---

## Data & Privacy

- All data lives in your browser's `localStorage` under `lifeOS:*` keys
- Nothing is sent to any server except optional Anthropic API calls (food/journal AI) and Google Fit (if connected)
- Use **Settings → Export Data** to back up as JSON
- Use **Settings → Import Data** to restore on another device or browser
- Data on your phone and PC are independent — use export/import to move data between devices

---

## License

MIT

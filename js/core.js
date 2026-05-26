// ═══════════════════════════════════════════════════
// LIFE OS — core.js
// localStorage helpers, date utils, goals, index manifest,
// daily summary cache, and 30-day seed data
// ═══════════════════════════════════════════════════

// ── localStorage helpers ─────────────────────────
const LS = {
  get(key) { return localStorage.getItem(key); },
  set(key, val) { localStorage.setItem(key, val); },
  remove(key) { localStorage.removeItem(key); },
  getJSON(key) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
    catch { return null; }
  },
  setJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
  keys() { return Object.keys(localStorage); },
  clear() { localStorage.clear(); }
};

// ── Date utils ───────────────────────────────────
function dateStr(d) {
  const dt = d || new Date();
  return dt.toISOString().slice(0, 10);
}

function monthStr(d) {
  const dt = d || new Date();
  return dt.toISOString().slice(0, 7);
}

function today() { return dateStr(new Date()); }
function thisMonth() { return monthStr(new Date()); }

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateStr(d);
}

function addDays(dateString, n) {
  const d = new Date(dateString + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return dateStr(d);
}

function dateRange(startStr, endStr) {
  const result = [];
  let current = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  while (current <= end) {
    result.push(dateStr(current));
    current.setDate(current.getDate() + 1);
  }
  return result;
}

function dayOfWeek(dateString) {
  return new Date(dateString + 'T00:00:00').getDay();
}

function formatDate(dateString) {
  const d = new Date(dateString + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function tsToday() { return new Date().setHours(0,0,0,0); }

function daysBetween(d1, d2) {
  const a = new Date(d1 + 'T00:00:00');
  const b = new Date(d2 + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// ── Goals / settings ─────────────────────────────
const DEFAULT_GOALS = {
  calories: 2000,
  protein: 120,
  water: 2500,
  sleep: 7.5,
  steps: 10000,
  budgets: {
    food: 8000,
    transport: 3000,
    health: 2000,
    entertainment: 2000,
    subscriptions: 1500,
    misc: 1500
  }
};

function getGoals() {
  return LS.getJSON('lifeOS:goals') || Object.assign({}, DEFAULT_GOALS);
}

function saveGoals(g) {
  LS.setJSON('lifeOS:goals', g);
}

// ── Index manifest ───────────────────────────────
function getIndex() {
  return LS.getJSON('lifeOS:index') || { dates: [], months: [] };
}

function updateIndex(date) {
  const idx = getIndex();
  const m = date.slice(0, 7);
  if (!idx.dates.includes(date)) {
    idx.dates.push(date);
    idx.dates.sort();
    if (idx.dates.length > 400) idx.dates.shift();
  }
  if (!idx.months.includes(m)) {
    idx.months.push(m);
    idx.months.sort();
  }
  LS.setJSON('lifeOS:index', idx);
}

// ── Daily summary cache ──────────────────────────
function computeDailySummary(date) {
  const goals = getGoals();

  // Food
  const food = LS.getJSON(`lifeOS:food:${date}`) || [];
  const cal = food.reduce((s, f) => s + (f.cal || 0), 0);
  const protein = food.reduce((s, f) => s + (f.protein || 0), 0);
  const carbs = food.reduce((s, f) => s + (f.carbs || 0), 0);
  const fat = food.reduce((s, f) => s + (f.fat || 0), 0);

  // Water
  const water = LS.getJSON(`lifeOS:water:${date}`) || [];
  const waterMl = water.reduce((s, w) => s + (w.ml || 0), 0);

  // Sleep
  const sleep = LS.getJSON(`lifeOS:sleep:${date}`) || null;
  const sleepHours = sleep ? sleep.hours : 0;

  // Tasks
  const tasks = LS.getJSON(`lifeOS:tasks:${date}`) || [];
  const tasksTotal = tasks.length;
  const tasksDone = tasks.filter(t => t.done).length;
  const tasksRate = tasksTotal > 0 ? (tasksDone / tasksTotal) : 0;

  // Steps (from fit cache or manual movement)
  const fitCache = LS.getJSON(`lifeOS:fit:cache:${date}`) || {};
  const movements = LS.getJSON(`lifeOS:movement:${date}`) || [];
  const steps = fitCache.steps || movements.reduce((s, m) => s + (m.steps || 0), 0);
  const activeMin = fitCache.activeMin || movements.reduce((s, m) => s + (m.duration || 0), 0);
  const distance = fitCache.distance || 0;
  const calBurned = fitCache.cal || 0;

  // Journal
  const journal = LS.getJSON(`lifeOS:journal:${date}`) || null;
  const journaled = !!(journal && journal.text && journal.text.trim().length > 0);

  // Workouts
  const workouts = LS.getJSON(`lifeOS:workout:${date}`) || [];
  const workedOut = workouts.length > 0;

  // Expenses
  const expenses = LS.getJSON(`lifeOS:expense:${date.slice(0,7)}`) || [];
  const todayExpenses = expenses.filter(e => e.date === date);
  const spentToday = todayExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  // Meetings
  const meetings = LS.getJSON(`lifeOS:meetings:${date}`) || [];

  // Life Score computation
  const nutritionScore = Math.min(1, cal / goals.calories) * 0.5 +
    (protein >= goals.protein ? 0.5 : protein / goals.protein * 0.5);
  const sleepScore = sleepHours >= goals.sleep ? 1 :
    sleepHours >= goals.sleep * 0.85 ? 0.7 :
    sleepHours >= goals.sleep * 0.7 ? 0.4 : 0.1;
  const movementScore = steps >= goals.steps ? 1 :
    steps >= goals.steps * 0.7 ? 0.6 :
    steps >= goals.steps * 0.4 ? 0.3 : 0;
  const hydrationScore = waterMl >= goals.water ? 1 :
    waterMl >= goals.water * 0.7 ? 0.6 : waterMl / goals.water;
  const taskScore = tasksRate;
  const journalScore = journaled ? 1 : 0;

  // Learning pace score
  const lGoals = LS.getJSON('lifeOS:learning:goals') || [];
  let learningScore = 1;
  if (lGoals.length > 0) {
    const paces = lGoals.map(g => {
      const log = LS.getJSON(`lifeOS:learning:log:${g.id}`) || [];
      const logged = log.reduce((s, l) => s + l.minutes, 0) / 60;
      const totalDays = daysBetween(dateStr(new Date(g.createdAt || daysAgo(30))), g.targetDate);
      const elapsed = daysBetween(dateStr(new Date(g.createdAt || daysAgo(30))), date);
      const expected = totalDays > 0 ? (elapsed / totalDays) * g.totalHours : 0;
      return expected > 0 ? Math.min(1, logged / expected) : 1;
    });
    learningScore = paces.reduce((s, p) => s + p, 0) / paces.length;
  }

  const score = Math.round(
    nutritionScore * 20 +
    sleepScore * 15 +
    movementScore * 20 +
    hydrationScore * 10 +
    taskScore * 15 +
    learningScore * 10 +
    journalScore * 10
  );

  return {
    date, cal, protein, carbs, fat,
    calGoal: goals.calories, proteinGoal: goals.protein,
    waterMl, waterGoal: goals.water,
    sleepHours, sleepGoal: goals.sleep,
    steps, stepsGoal: goals.steps,
    activeMin, distance, calBurned,
    tasksTotal, tasksDone, tasksRate,
    journaled, workedOut,
    lastWorkout: workouts[workouts.length - 1] || null,
    spentToday, meetings, journal,
    score,
    components: {
      nutrition: Math.round(nutritionScore * 20),
      sleep: Math.round(sleepScore * 15),
      movement: Math.round(movementScore * 20),
      hydration: Math.round(hydrationScore * 10),
      tasks: Math.round(taskScore * 15),
      learning: Math.round(learningScore * 10),
      journal: Math.round(journalScore * 10)
    }
  };
}

function getDailySummary(date) {
  const isToday = date === today();
  if (!isToday) {
    const cached = LS.getJSON(`lifeOS:summary:${date}`);
    if (cached) return cached;
  }
  const summary = computeDailySummary(date);
  if (!isToday) LS.setJSON(`lifeOS:summary:${date}`, summary);
  return summary;
}

// ── Seed data (30 days) ──────────────────────────
function seedData() {
  if (LS.get('lifeOS:seeded')) return;

  const foods = [
    { text: 'Oats with banana and milk', cal: 380, protein: 14, carbs: 68, fat: 7 },
    { text: '2 chapatis with dal and sabzi', cal: 420, protein: 16, carbs: 72, fat: 8 },
    { text: 'Rice, rajma curry', cal: 550, protein: 18, carbs: 95, fat: 10 },
    { text: 'Chicken breast with salad', cal: 320, protein: 42, carbs: 12, fat: 8 },
    { text: 'Idli sambar (3 pieces)', cal: 280, protein: 9, carbs: 52, fat: 3 },
    { text: 'Paneer tikka (150g)', cal: 310, protein: 22, carbs: 8, fat: 20 },
    { text: 'Egg omelette (3 eggs)', cal: 260, protein: 20, carbs: 2, fat: 18 },
    { text: 'Protein shake', cal: 180, protein: 30, carbs: 10, fat: 3 },
    { text: 'Mixed dal khichdi', cal: 360, protein: 14, carbs: 65, fat: 6 },
    { text: 'Grilled fish with vegetables', cal: 290, protein: 38, carbs: 15, fat: 7 },
    { text: 'Pav bhaji (2 pav)', cal: 480, protein: 12, carbs: 78, fat: 14 },
    { text: 'Dosa with chutney (2)', cal: 320, protein: 7, carbs: 58, fat: 8 },
    { text: 'Upma', cal: 250, protein: 6, carbs: 42, fat: 7 },
    { text: 'Aloo paratha with curd', cal: 430, protein: 11, carbs: 70, fat: 14 },
    { text: 'Mixed nuts (30g)', cal: 175, protein: 5, carbs: 7, fat: 15 },
    { text: 'Greek yogurt with fruit', cal: 190, protein: 16, carbs: 22, fat: 3 },
    { text: 'Poha', cal: 250, protein: 5, carbs: 48, fat: 4 },
    { text: 'Samosa (2)', cal: 280, protein: 5, carbs: 36, fat: 14 },
    { text: 'Chole bhature (1 plate)', cal: 620, protein: 20, carbs: 90, fat: 22 },
    { text: 'Palak paneer with roti', cal: 490, protein: 22, carbs: 60, fat: 18 },
  ];

  const workoutTemplates = [
    { name: 'Push Day', exercises: [
      { name: 'Bench Press', sets: [{reps:8,weight:80},{reps:8,weight:80},{reps:6,weight:85}] },
      { name: 'Overhead Press', sets: [{reps:10,weight:50},{reps:8,weight:55},{reps:8,weight:55}] },
      { name: 'Tricep Pushdown', sets: [{reps:12,weight:30},{reps:12,weight:30},{reps:10,weight:35}] },
    ]},
    { name: 'Pull Day', exercises: [
      { name: 'Deadlift', sets: [{reps:5,weight:120},{reps:5,weight:125},{reps:4,weight:130}] },
      { name: 'Barbell Row', sets: [{reps:8,weight:70},{reps:8,weight:75},{reps:8,weight:75}] },
      { name: 'Bicep Curl', sets: [{reps:12,weight:20},{reps:12,weight:20},{reps:10,weight:22.5}] },
    ]},
    { name: 'Legs', exercises: [
      { name: 'Squat', sets: [{reps:8,weight:100},{reps:8,weight:105},{reps:6,weight:110}] },
      { name: 'Leg Press', sets: [{reps:10,weight:180},{reps:10,weight:190},{reps:8,weight:200}] },
      { name: 'Calf Raise', sets: [{reps:15,weight:60},{reps:15,weight:60},{reps:12,weight:65}] },
    ]},
    { name: 'Cardio', exercises: [
      { name: 'Treadmill Run', sets: [{reps:1,weight:0}] },
      { name: 'Jump Rope', sets: [{reps:1,weight:0}] },
    ]},
  ];

  const journalTexts = [
    "Had a productive day at work. Finished the design review and got good feedback. Feeling good about the direction we're taking. Need to follow up with the team tomorrow on the implementation timeline.",
    "Struggled to focus today. Too many distractions. Tried to get the report done but kept getting pulled into meetings. Will block time tomorrow morning for deep work. On the bright side, had a great workout.",
    "Good day overall. Met my nutrition goals and slept well last night. The new morning routine is starting to feel natural. Read for 45 minutes before bed which felt great.",
    "Interesting conversation with a mentor today about career direction. Lots to think about. The project is moving along well but I'm feeling the pressure of the deadline. Need to manage my energy better.",
    "Rest day — took it easy. Did some light stretching and a long walk. Cooked a proper meal at home which felt nice. Feeling recharged and ready for the week.",
    "Crushed it today. Everything clicked. Hit a new PR on deadlifts and also closed a big piece of work. These days make the effort feel worth it.",
    "Feeling behind on the learning goals. Need to be more intentional about carving out study time each day. Added it to the morning block. Also: drank way too little water today.",
    "Mediocre day. Nothing went wrong but nothing exciting happened either. These flat days are good for maintenance but I want more momentum. Going to review my goals tomorrow.",
  ];

  const moodCycle = ['great','good','good','okay','good','okay','low','good','great','good'];
  const taskTemplates = ['Review PRs','Team standup','Send weekly update','Prep for meeting','Read documentation','Exercise','Meal prep','Call family','Review finances','Study session','Code review','Write journal'];
  const meetingTitles = ['Weekly Sync','Design Review','1:1 with Manager','Sprint Planning','Product Demo','Code Review Session','All Hands','Client Call'];
  const expenses = [
    { category:'food', note:'Lunch at Saravana Bhavan' },
    { category:'transport', note:'Ola to office' },
    { category:'food', note:'Groceries - BigBasket' },
    { category:'health', note:'Gym membership' },
    { category:'entertainment', note:'Netflix subscription' },
    { category:'food', note:'Coffee + snacks' },
    { category:'transport', note:'Metro monthly pass' },
    { category:'food', note:'Dinner with friends' },
    { category:'subscriptions', note:'Spotify + YouTube' },
    { category:'misc', note:'New book' },
    { category:'health', note:'Vitamins & supplements' },
    { category:'entertainment', note:'Movie ticket' },
    { category:'food', note:'Swiggy order' },
    { category:'transport', note:'Auto + cab' },
    { category:'misc', note:'Household items' },
  ];
  const expenseAmounts = { food: [120,340,180,260,80,450,200], transport: [120,200,80,350], health: [1200,650,300], entertainment: [199,499,280], subscriptions: [199,129,499], misc: [350,180,600,420] };

  const idx = { dates: [], months: [] };

  for (let i = 29; i >= 0; i--) {
    const d = daysAgo(i);
    const m = d.slice(0, 7);
    idx.dates.push(d);
    if (!idx.months.includes(m)) idx.months.push(m);

    // Food (2-4 entries per day)
    const numFood = 2 + Math.floor(Math.random() * 3);
    const dayFoods = [];
    const shuffled = [...foods].sort(() => Math.random() - 0.5).slice(0, numFood);
    const baseHours = [8, 13, 16, 20];
    shuffled.forEach((f, fi) => {
      dayFoods.push({
        id: `f${d}${fi}`,
        text: f.text,
        cal: f.cal + Math.round((Math.random()-0.5)*40),
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        ts: new Date(d + `T${String(baseHours[fi]).padStart(2,'0')}:${String(Math.floor(Math.random()*50)).padStart(2,'0')}:00`).getTime()
      });
    });
    LS.setJSON(`lifeOS:food:${d}`, dayFoods);

    // Water (6-10 entries)
    const numWater = 6 + Math.floor(Math.random() * 5);
    const dayWater = [];
    for (let w = 0; w < numWater; w++) {
      const amounts = [150, 250, 350, 500];
      dayWater.push({
        ml: amounts[Math.floor(Math.random() * amounts.length)],
        ts: new Date(d + `T${String(7+w*2).padStart(2,'0')}:00:00`).getTime()
      });
    }
    LS.setJSON(`lifeOS:water:${d}`, dayWater);

    // Sleep (skip some days randomly)
    if (Math.random() > 0.1) {
      const bedH = 22 + Math.floor(Math.random() * 2);
      const bedM = Math.floor(Math.random() * 60);
      const wakeH = 6 + Math.floor(Math.random() * 2);
      const wakeM = Math.floor(Math.random() * 60);
      const hours = wakeH + wakeM/60 + (24 - bedH - bedM/60);
      const prevDay = daysAgo(i+1);
      LS.setJSON(`lifeOS:sleep:${d}`, {
        bedtime: `${String(bedH).padStart(2,'0')}:${String(bedM).padStart(2,'0')}`,
        wake: `${String(wakeH).padStart(2,'0')}:${String(wakeM).padStart(2,'0')}`,
        hours: Math.round(hours * 10) / 10,
        quality: 3 + Math.floor(Math.random() * 3),
        notes: '',
        source: 'manual'
      });
    }

    // Tasks (3-6 per day)
    const numTasks = 3 + Math.floor(Math.random() * 4);
    const dayTasks = [];
    const shuffledTasks = [...taskTemplates].sort(() => Math.random() - 0.5).slice(0, numTasks);
    shuffledTasks.forEach((t, ti) => {
      const doneProb = i > 0 ? 0.75 : 0.5;
      dayTasks.push({
        id: `t${d}${ti}`,
        title: t,
        time: `${String(9+ti*2).padStart(2,'0')}:00`,
        priority: ['high','medium','medium','low'][Math.floor(Math.random()*4)],
        done: Math.random() < doneProb,
        recurring: ti === 0 ? 'daily' : 'none',
        date: d
      });
    });
    LS.setJSON(`lifeOS:tasks:${d}`, dayTasks);

    // Meetings (0-2 per day, more on weekdays)
    const dow = new Date(d + 'T00:00:00').getDay();
    if (dow >= 1 && dow <= 5 && Math.random() > 0.4) {
      const numMeet = 1 + Math.floor(Math.random() * 2);
      const dayMeetings = [];
      for (let mi = 0; mi < numMeet; mi++) {
        const title = meetingTitles[Math.floor(Math.random() * meetingTitles.length)];
        const hour = 9 + mi * 3 + Math.floor(Math.random() * 2);
        dayMeetings.push({
          id: `m${d}${mi}`,
          title,
          time: `${String(hour).padStart(2,'0')}:00`,
          duration: [30,45,60][Math.floor(Math.random()*3)],
          attendees: '',
          notes: '',
          date: d
        });
      }
      LS.setJSON(`lifeOS:meetings:${d}`, dayMeetings);
    }

    // Journal (5 out of 7 days approx)
    if (Math.random() > 0.25) {
      const text = journalTexts[Math.floor(Math.random() * journalTexts.length)];
      const mood = moodCycle[(29-i) % moodCycle.length];
      LS.setJSON(`lifeOS:journal:${d}`, {
        text,
        mood,
        wordcount: text.split(' ').length
      });
    }

    // Workouts (4 per week approx)
    if (dow >= 1 && dow <= 5 && Math.random() > 0.2) {
      const template = workoutTemplates[(29-i) % 4];
      const wAdj = i;
      const session = {
        id: `w${d}0`,
        name: template.name,
        exercises: template.exercises.map(ex => ({
          name: ex.name,
          sets: ex.sets.map(s => ({
            reps: s.reps,
            weight: s.weight + (s.weight > 0 ? Math.floor((29-wAdj)/8) * 2.5 : 0)
          }))
        }))
      };
      LS.setJSON(`lifeOS:workout:${d}`, [session]);
    }

    // Movement (simulate fit data)
    const baseSteps = 6000 + Math.floor(Math.random() * 6000);
    LS.setJSON(`lifeOS:fit:cache:${d}`, {
      steps: baseSteps,
      activeMin: 20 + Math.floor(Math.random() * 40),
      distance: parseFloat((baseSteps * 0.0008).toFixed(2)),
      cal: 200 + Math.floor(Math.random() * 300),
      ts: Date.now()
    });
  }

  // Expenses (monthly)
  const monthExpenses = [];
  const curMonth = thisMonth();
  const prevMonth = daysAgo(31).slice(0, 7);
  [curMonth, prevMonth].forEach(mon => {
    expenses.forEach((exp, ei) => {
      const dayNum = 1 + Math.floor(Math.random() * 27);
      const expDate = `${mon}-${String(dayNum).padStart(2,'0')}`;
      const amounts = expenseAmounts[exp.category] || [200];
      monthExpenses.push({
        id: `e${mon}${ei}`,
        amount: amounts[Math.floor(Math.random() * amounts.length)],
        category: exp.category,
        note: exp.note,
        date: expDate
      });
    });
    LS.setJSON(`lifeOS:expense:${mon}`, monthExpenses.filter(e => e.date.startsWith(mon)));
  });

  // Personal bests (from workout data)
  const pbs = {};
  for (let i = 29; i >= 0; i--) {
    const d = daysAgo(i);
    const workouts = LS.getJSON(`lifeOS:workout:${d}`) || [];
    workouts.forEach(w => {
      w.exercises.forEach(ex => {
        const maxW = Math.max(...ex.sets.map(s => s.weight));
        if (!pbs[ex.name] || maxW > pbs[ex.name]) {
          pbs[ex.name] = maxW;
        }
      });
    });
  }
  LS.setJSON('lifeOS:pbs', pbs);

  // Learning goals
  const lGoals = [
    {
      id: 'lg1',
      topic: 'System Design',
      targetDate: addDays(today(), 60),
      totalHours: 40,
      createdAt: daysAgo(20)
    },
    {
      id: 'lg2',
      topic: 'Machine Learning Fundamentals',
      targetDate: addDays(today(), 30),
      totalHours: 25,
      createdAt: daysAgo(25)
    }
  ];
  LS.setJSON('lifeOS:learning:goals', lGoals);

  // Learning logs
  const sysDesignNotes = [
    'Covered CAP theorem and consistency models. Understanding tradeoffs between availability and partition tolerance.',
    'Studied load balancing strategies: round robin, least connections, IP hash. Practiced drawing system diagrams.',
    'Deep dive into database sharding. Horizontal vs vertical scaling. Consistent hashing rings.',
    'Studied message queues (Kafka, RabbitMQ). Understanding event-driven architecture patterns.',
    'Reviewed CDN architecture and caching strategies. Cache invalidation is indeed one of the hard problems.',
    'Practiced designing URL shortener and rate limiter systems. Getting better at estimation.',
  ];
  const lg1Log = [];
  [18,16,14,11,8,5].forEach((dago, i) => {
    lg1Log.push({
      date: daysAgo(dago),
      minutes: 45 + Math.floor(Math.random() * 30),
      notes: sysDesignNotes[i]
    });
  });
  LS.setJSON('lifeOS:learning:log:lg1', lg1Log);

  const mlNotes = [
    'Linear regression basics. Cost function, gradient descent. Implemented from scratch in Python.',
    'Logistic regression and classification. Understanding sigmoid function and decision boundaries.',
    'Studied overfitting and regularization (L1, L2). Cross-validation techniques.',
  ];
  const lg2Log = [];
  [20, 15, 10].forEach((dago, i) => {
    lg2Log.push({
      date: daysAgo(dago),
      minutes: 60,
      notes: mlNotes[i]
    });
  });
  LS.setJSON('lifeOS:learning:log:lg2', lg2Log);

  // Workout templates
  LS.setJSON('lifeOS:workout:templates', workoutTemplates.map((t, i) => ({
    id: `tmpl${i}`,
    name: t.name,
    exercises: t.exercises.map(ex => ({
      name: ex.name,
      sets: ex.sets.map(s => ({ reps: s.reps, weight: s.weight }))
    }))
  })));

  // Save index
  LS.setJSON('lifeOS:index', idx);

  // Mark seeded
  LS.set('lifeOS:seeded', '1');
}

// ── App init ─────────────────────────────────────
function initApp() {
  // Build today's index entry
  updateIndex(today());
  // Goals default init
  if (!LS.getJSON('lifeOS:goals')) saveGoals(DEFAULT_GOALS);
}

// ── Utility: get streak ──────────────────────────
function getStreak(checkFn) {
  let streak = 0;
  let d = today();
  for (let i = 0; i <= 365; i++) {
    d = daysAgo(i);
    if (checkFn(d)) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function getWaterStreak() {
  return getStreak(d => {
    const water = LS.getJSON(`lifeOS:water:${d}`) || [];
    const ml = water.reduce((s, w) => s + w.ml, 0);
    return ml >= getGoals().water;
  });
}

function getWorkoutStreak() {
  let streak = 0;
  for (let i = 0; i <= 365; i++) {
    const d = daysAgo(i);
    const w = LS.getJSON(`lifeOS:workout:${d}`) || [];
    if (w.length > 0) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function getJournalStreak() {
  return getStreak(d => {
    const j = LS.getJSON(`lifeOS:journal:${d}`);
    return !!(j && j.text && j.text.trim().length > 10);
  });
}

function getSleepStreak() {
  return getStreak(d => {
    const s = LS.getJSON(`lifeOS:sleep:${d}`);
    return !!(s && s.hours >= getGoals().sleep);
  });
}

function getStepStreak() {
  return getStreak(d => {
    const fit = LS.getJSON(`lifeOS:fit:cache:${d}`) || {};
    const mov = LS.getJSON(`lifeOS:movement:${d}`) || [];
    const steps = fit.steps || mov.reduce((s, m) => s + (m.steps || 0), 0);
    return steps >= getGoals().steps;
  });
}

// ── Claude API helper ─────────────────────────────
async function callClaude(systemPrompt, userMessage, maxTokens = 300) {
  const apiKey = LS.get('lifeOS:apikey');
  if (!apiKey) throw new Error('NO_API_KEY');

  const resp = await fetch('http://localhost:6655/anthropic/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }

  const data = await resp.json();
  return data.content[0]?.text || '';
}

// ── SVG chart helpers ─────────────────────────────
function makeSVGBar(values, goalValue, width, height, labels) {
  if (!values || values.length === 0) return `<svg width="${width}" height="${height}"></svg>`;
  const max = Math.max(...values, goalValue || 0) * 1.1 || 1;
  const pad = { top: 10, right: 10, bottom: labels ? 24 : 10, left: 36 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const barW = Math.max(2, W / values.length - 2);
  const gap = W / values.length;

  let bars = '';
  values.forEach((v, i) => {
    const bh = Math.max(0, (v / max) * H);
    const x = pad.left + i * gap + (gap - barW) / 2;
    const y = pad.top + H - bh;
    const pct = goalValue ? v / goalValue : 0;
    const fill = pct >= 1 ? '#c8f04a' : pct >= 0.7 ? '#c8f04a88' : '#333';
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${fill}"/>`;
    if (labels && labels[i]) {
      bars += `<text x="${(x + barW/2).toFixed(1)}" y="${(pad.top + H + 14).toFixed(1)}" text-anchor="middle" fill="#555" font-size="9" font-family="JetBrains Mono,monospace">${labels[i]}</text>`;
    }
  });

  // Goal line
  let goalLine = '';
  if (goalValue) {
    const gy = (pad.top + H - (goalValue / max) * H).toFixed(1);
    goalLine = `<line x1="${pad.left}" y1="${gy}" x2="${pad.left + W}" y2="${gy}" stroke="#c8f04a44" stroke-dasharray="3,3" stroke-width="1"/>`;
  }

  // Y axis labels
  const yLabels = [0, Math.round(max/2), Math.round(max)];
  let yAxis = '';
  yLabels.forEach(v => {
    const y = (pad.top + H - (v / max) * H).toFixed(1);
    yAxis += `<text x="${(pad.left-4).toFixed(1)}" y="${y}" text-anchor="end" fill="#444" font-size="9" font-family="JetBrains Mono,monospace" dominant-baseline="middle">${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}</text>`;
  });

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${yAxis}${goalLine}${bars}</svg>`;
}

function makeSVGLine(values, goalValue, width, height, labels) {
  if (!values || values.length === 0) return `<svg width="${width}" height="${height}"></svg>`;
  const max = Math.max(...values, goalValue || 0) * 1.1 || 1;
  const pad = { top: 10, right: 10, bottom: labels ? 24 : 10, left: 36 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;

  const points = values.map((v, i) => {
    const x = pad.left + (i / (values.length - 1 || 1)) * W;
    const y = pad.top + H - (v / max) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  let goalLine = '';
  if (goalValue) {
    const gy = (pad.top + H - (goalValue / max) * H).toFixed(1);
    goalLine = `<line x1="${pad.left}" y1="${gy}" x2="${pad.left+W}" y2="${gy}" stroke="#c8f04a44" stroke-dasharray="3,3" stroke-width="1"/>`;
  }

  let labelsHTML = '';
  if (labels) {
    values.forEach((v, i) => {
      const x = pad.left + (i / (values.length - 1 || 1)) * W;
      labelsHTML += `<text x="${x.toFixed(1)}" y="${(pad.top+H+14).toFixed(1)}" text-anchor="middle" fill="#555" font-size="9" font-family="JetBrains Mono,monospace">${labels[i] || ''}</text>`;
    });
  }

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${goalLine}
    <polyline points="${points}" fill="none" stroke="#c8f04a" stroke-width="1.5"/>
    ${values.map((v,i) => {
      const x = pad.left + (i/(values.length-1||1))*W;
      const y = pad.top + H - (v/max)*H;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="#c8f04a"/>`;
    }).join('')}
    ${labelsHTML}
  </svg>`;
}

function makeSparkline(values, width, height) {
  if (!values || values.length < 2) return `<svg width="${width}" height="${height}"></svg>`;
  const max = Math.max(...values) || 1;
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><polyline points="${points}" fill="none" stroke="#c8f04a" stroke-width="1.5"/></svg>`;
}

function makeCircleProgress(value, max, size) {
  const pct = Math.min(1, value / max);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const cx = size / 2, cy = size / 2;
  const color = pct >= 1 ? '#c8f04a' : pct >= 0.5 ? '#c8f04a88' : '#333';
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#222" stroke-width="4"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="4"
      stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
      stroke-linecap="butt"
      transform="rotate(-90 ${cx} ${cy})"/>
  </svg>`;
}

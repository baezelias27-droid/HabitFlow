/* ══════════════════════════════════════════════════════════════
   habitFlow — script.js
   Vanilla JS · Modular · Scalable · Firebase-ready
   ══════════════════════════════════════════════════════════════

   ESTRUCTURA:
   1. CONFIG & CONSTANTS
   2. STORAGE MODULE         (localStorage / Firebase-ready)
   3. AUTH MODULE            (simulated / Firebase-ready)
   4. STATE MODULE           (in-memory app state)
   5. UI HELPERS             (toast, modal, navigation)
   6. HABITS MODULE          (CRUD + rendering)
   7. GOALS MODULE           (checklist)
   8. ANALYTICS MODULE       (wellness chart)
   9. STATS MODULE           (percentages, streak)
   10. PROFILE MODULE
   11. INIT
   ══════════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════
   1. CONFIG & CONSTANTS
══════════════════════════════════════ */
const CONFIG = {
  APP_KEY: 'habitflow_v1',
  DAYS: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
  DAYS_FULL: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
  // Default active days: Mon–Fri active, Sat–Sun rest
  DEFAULT_ACTIVE_DAYS: [true, true, true, true, true, false, false],
  WELLNESS_VARS: [
    { key: 'energia',      label: 'Energía',      color: '#f59e0b' },
    { key: 'animo',        label: 'Ánimo',         color: '#10b981' },
    { key: 'sueno',        label: 'Sueño',         color: '#6366f1' },
    { key: 'enfoque',      label: 'Enfoque',       color: '#3b82f6' },
    { key: 'estres',       label: 'Estrés',        color: '#ef4444' },
    { key: 'productividad',label: 'Productividad', color: '#8b5cf6' },
    { key: 'motivacion',   label: 'Motivación',    color: '#ec4899' },
    { key: 'hidratacion',  label: 'Hidratación',   color: '#14b8a6' },
  ],
};

/* ══════════════════════════════════════
   2. STORAGE MODULE
   → Swap localStorage calls for Firestore here
══════════════════════════════════════ */
const Storage = {
  get(key) {
    try {
      const raw = localStorage.getItem(`${CONFIG.APP_KEY}_${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  set(key, value) {
    try {
      localStorage.setItem(`${CONFIG.APP_KEY}_${key}`, JSON.stringify(value));
    } catch (e) { console.warn('Storage error:', e); }
  },
  remove(key) {
    localStorage.removeItem(`${CONFIG.APP_KEY}_${key}`);
  },
};

/* ══════════════════════════════════════
   3. AUTH MODULE
   → Firebase: firebase.auth().onAuthStateChanged(), signIn, createUser
══════════════════════════════════════ */
const Auth = {
  // Current session key
  SESSION_KEY: 'session',
  USER_KEY: 'users',

  init() {
    // TODO Firebase: replace with firebase.auth().onAuthStateChanged(user => { ... })
    const session = Storage.get(this.SESSION_KEY);
    if (session) {
      State.currentUser = session;
      UI.showApp();
    } else {
      UI.showAuth();
    }
  },

  login(email, password, remember) {
    const users = Storage.get(this.USER_KEY) || {};
    const user = users[email];
    if (!user) return { ok: false, msg: 'Usuario no encontrado.' };
    if (user.password !== password) return { ok: false, msg: 'Contraseña incorrecta.' };
    const session = { email, name: user.name };
    if (remember) Storage.set(this.SESSION_KEY, session);
    State.currentUser = session;
    return { ok: true };
    /* TODO Firebase:
       firebase.auth().signInWithEmailAndPassword(email, password)
         .then(cred => { State.currentUser = cred.user; UI.showApp(); })
         .catch(err => UI.toast(err.message, 'danger'));
    */
  },

  register(name, email, password) {
    if (!name || !email || !password) return { ok: false, msg: 'Completa todos los campos.' };
    if (password.length < 6) return { ok: false, msg: 'Mínimo 6 caracteres en contraseña.' };
    const users = Storage.get(this.USER_KEY) || {};
    if (users[email]) return { ok: false, msg: 'Ya existe una cuenta con ese email.' };
    users[email] = { name, password };
    Storage.set(this.USER_KEY, users);
    const session = { email, name };
    Storage.set(this.SESSION_KEY, session);
    State.currentUser = session;
    return { ok: true };
    /* TODO Firebase:
       firebase.auth().createUserWithEmailAndPassword(email, password)
         .then(cred => cred.user.updateProfile({ displayName: name }))
         .then(() => { State.currentUser = firebase.auth().currentUser; UI.showApp(); })
         .catch(err => UI.toast(err.message, 'danger'));
    */
  },

  logout() {
    Storage.remove(this.SESSION_KEY);
    State.currentUser = null;
    UI.showAuth();
    /* TODO Firebase: firebase.auth().signOut(); */
  },
};

/* ══════════════════════════════════════
   4. STATE MODULE
══════════════════════════════════════ */
const State = {
  currentUser: null,
  habits: [],           // Array of habit objects
  activeDays: [...CONFIG.DEFAULT_ACTIVE_DAYS], // 7 booleans
  goals: [],            // Array of goal objects
  wellnessActive: ['energia', 'animo', 'sueno'], // active wellness vars
  wellnessData: {},     // { varKey: [d0,d1,d2,d3,d4,d5,d6] }
  completions: {},      // { habitId: { 'YYYY-WW': [bool*7] } }
  theme: 'light',

  load() {
    this.habits       = Storage.get('habits')       || [];
    this.activeDays   = Storage.get('activeDays')   || [...CONFIG.DEFAULT_ACTIVE_DAYS];
    this.goals        = Storage.get('goals')        || [];
    this.wellnessActive = Storage.get('wellnessActive') || ['energia', 'animo', 'sueno'];
    this.wellnessData = Storage.get('wellnessData') || {};
    this.completions  = Storage.get('completions')  || {};
    this.theme        = Storage.get('theme')        || 'light';
  },

  save() {
    Storage.set('habits',        this.habits);
    Storage.set('activeDays',    this.activeDays);
    Storage.set('goals',         this.goals);
    Storage.set('wellnessActive',this.wellnessActive);
    Storage.set('wellnessData',  this.wellnessData);
    Storage.set('completions',   this.completions);
    Storage.set('theme',         this.theme);
  },

  // Get ISO week key "YYYY-WW"
  getWeekKey(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    const wn = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${d.getFullYear()}-${String(wn).padStart(2, '0')}`;
  },

  // Ensure completions structure exists
  ensureCompletion(habitId, weekKey) {
    if (!this.completions[habitId]) this.completions[habitId] = {};
    if (!this.completions[habitId][weekKey]) {
      this.completions[habitId][weekKey] = [false, false, false, false, false, false, false];
    }
    return this.completions[habitId][weekKey];
  },
};

/* ══════════════════════════════════════
   5. UI HELPERS
══════════════════════════════════════ */
const UI = {
  currentSection: 'dashboard',
  wellnessChart: null,

  // ── Navigation ─────────────────────
  showApp() {
    document.getElementById('auth-overlay').classList.add('fade-out');
    setTimeout(() => {
      document.getElementById('auth-overlay').style.display = 'none';
      document.getElementById('app').classList.remove('hidden');
    }, 400);
    Profile.render();
    Habits.renderTable();
    Habits.renderManageCards();
    Goals.render();
    Analytics.renderToggles();
    Analytics.renderDailyInputs();
    Analytics.renderChart();
    Stats.update();
    this.updateGreeting();
    this.applyTheme(State.theme);
  },

  showAuth() {
    document.getElementById('auth-overlay').style.display = '';
    document.getElementById('auth-overlay').classList.remove('fade-out');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-panel').classList.add('active');
    document.getElementById('register-panel').classList.remove('active');
  },

  navigate(section) {
    // Deactivate old section
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Activate new
    document.getElementById(`section-${section}`).classList.add('active');
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    document.getElementById('page-title').textContent =
      document.querySelector(`[data-section="${section}"] span:last-child`).textContent;

    this.currentSection = section;
    this.closeSidebar();

    // Lazy render on navigate
    if (section === 'analytics') Analytics.renderChart();
    if (section === 'profile')   Profile.render();
    if (section === 'habits')    Habits.renderManageCards();
  },

  // ── Sidebar (mobile) ───────────────
  openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    this.getOrCreateBackdrop().classList.add('visible');
  },
  closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    const bd = document.querySelector('.sidebar-backdrop');
    if (bd) bd.classList.remove('visible');
  },
  getOrCreateBackdrop() {
    let bd = document.querySelector('.sidebar-backdrop');
    if (!bd) {
      bd = document.createElement('div');
      bd.className = 'sidebar-backdrop';
      bd.addEventListener('click', () => this.closeSidebar());
      document.body.appendChild(bd);
    }
    return bd;
  },

  // ── Theme ──────────────────────────
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('theme-icon').textContent  = theme === 'dark' ? '◐' : '◑';
    document.getElementById('theme-label').textContent = theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
  },
  toggleTheme() {
    State.theme = State.theme === 'light' ? 'dark' : 'light';
    this.applyTheme(State.theme);
    State.save();
    // Rebuild chart for theme colors
    Analytics.renderChart();
  },

  // ── Toast ──────────────────────────
  toast(msg, type = 'default') {
    const tc = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    tc.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  },

  // ── Modal (Habit) ──────────────────
  openHabitModal(habitId = null) {
    const modal = document.getElementById('modal-habit');
    document.getElementById('modal-habit-title').textContent = habitId ? 'Editar hábito' : 'Nuevo hábito';
    document.getElementById('habit-edit-id').value = habitId || '';

    // Build day mini buttons
    const row = document.getElementById('habit-days-mini');
    row.innerHTML = '';
    // Default: inherit global active days
    const habit = habitId ? State.habits.find(h => h.id === habitId) : null;
    const habitDays = habit ? habit.days : [...State.activeDays];

    CONFIG.DAYS.forEach((d, i) => {
      const btn = document.createElement('button');
      btn.className = `day-mini-btn${habitDays[i] ? ' active' : ''}`;
      btn.textContent = d;
      btn.dataset.idx = i;
      btn.addEventListener('click', () => btn.classList.toggle('active'));
      row.appendChild(btn);
    });

    if (habit) {
      document.getElementById('habit-name').value  = habit.name;
      document.getElementById('habit-emoji').value = habit.emoji || '';
      document.getElementById('habit-color').value = habit.color || '#18181b';
    } else {
      document.getElementById('habit-name').value  = '';
      document.getElementById('habit-emoji').value = '';
      document.getElementById('habit-color').value = '#18181b';
    }

    modal.classList.remove('hidden');
  },
  closeHabitModal() {
    document.getElementById('modal-habit').classList.add('hidden');
  },

  // ── Greeting ──────────────────────
  updateGreeting() {
    const name = State.currentUser?.name || 'usuario';
    document.getElementById('user-greeting').textContent = `Hola, ${name.split(' ')[0]}`;
  },

  // ── Empty state helper ─────────────
  toggleEmpty(id, show) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('visible', show);
  },
};

/* ══════════════════════════════════════
   6. HABITS MODULE
══════════════════════════════════════ */
const Habits = {
  // ── CRUD ─────────────────────────
  add(data) {
    const habit = {
      id: `h_${Date.now()}`,
      name: data.name.trim(),
      emoji: data.emoji.trim() || '✦',
      color: data.color,
      days: data.days,
      createdAt: Date.now(),
    };
    State.habits.push(habit);
    State.save();
    return habit;
  },

  update(id, data) {
    const idx = State.habits.findIndex(h => h.id === id);
    if (idx === -1) return;
    State.habits[idx] = { ...State.habits[idx], ...data };
    State.save();
  },

  delete(id) {
    State.habits = State.habits.filter(h => h.id !== id);
    delete State.completions[id];
    State.save();
  },

  // ── Toggle completion ─────────────
  toggleDay(habitId, dayIdx) {
    const wk = State.getWeekKey();
    const arr = State.ensureCompletion(habitId, wk);
    arr[dayIdx] = !arr[dayIdx];
    State.save();
    Stats.update();
    this.renderTable();
    Profile.render();
  },

  // ── Render table (dashboard) ──────
  renderTable() {
    const thead = document.getElementById('table-header-row');
    const tbody = document.getElementById('habit-table-body');

    // Header
    thead.innerHTML = '<th class="col-habit">Hábito</th>';
    CONFIG.DAYS.forEach((d, i) => {
      const th = document.createElement('th');
      th.className = `th-day${State.activeDays[i] ? '' : ' rest'}`;
      th.textContent = d;
      thead.appendChild(th);
    });
    const thPct = document.createElement('th');
    thPct.textContent = '%';
    thead.appendChild(thPct);

    // Body
    tbody.innerHTML = '';
    const wk = State.getWeekKey();

    State.habits.forEach(habit => {
      const row = document.createElement('tr');
      row.style.setProperty('--habit-color', habit.color || '#18181b');

      // Name cell
      const tdName = document.createElement('td');
      tdName.innerHTML = `
        <div class="habit-cell-name">
          <span class="habit-emoji">${habit.emoji || '✦'}</span>
          <span class="habit-name-text">${escHtml(habit.name)}</span>
        </div>`;
      row.appendChild(tdName);

      // Day cells
      const arr = State.ensureCompletion(habit.id, wk);
      let done = 0, possible = 0;

      CONFIG.DAYS.forEach((d, i) => {
        const td = document.createElement('td');
        const isActive = State.activeDays[i] && habit.days[i];

        const box = document.createElement('span');
        if (!isActive) {
          box.className = 'check-cell rest-day';
          box.textContent = '–';
        } else {
          possible++;
          if (arr[i]) { done++; box.className = 'check-cell checked'; box.textContent = '✓'; }
          else         { box.className = 'check-cell'; }
          box.addEventListener('click', () => this.toggleDay(habit.id, i));
        }
        td.appendChild(box);
        row.appendChild(td);
      });

      // % cell
      const pct = possible > 0 ? Math.round((done / possible) * 100) : 0;
      const tdPct = document.createElement('td');
      tdPct.className = 'pct-cell';
      tdPct.textContent = `${pct}%`;
      row.appendChild(tdPct);

      tbody.appendChild(row);
    });

    UI.toggleEmpty('habits-empty', State.habits.length === 0);
  },

  // ── Render manage cards (section-habits) ──
  renderManageCards() {
    const grid = document.getElementById('habit-cards-grid');
    grid.innerHTML = '';

    State.habits.forEach(habit => {
      const card = document.createElement('div');
      card.className = 'habit-manage-card';
      card.style.setProperty('--habit-color', habit.color);

      const activeDaysLabels = CONFIG.DAYS.filter((_, i) => habit.days[i]);

      card.innerHTML = `
        <div class="hmc-header">
          <div class="hmc-info">
            <span class="hmc-emoji">${habit.emoji || '✦'}</span>
            <span class="hmc-name">${escHtml(habit.name)}</span>
          </div>
          <div class="hmc-actions">
            <button class="hmc-btn edit" data-id="${habit.id}" title="Editar">✎</button>
            <button class="hmc-btn delete" data-id="${habit.id}" title="Eliminar">✕</button>
          </div>
        </div>
        <div class="hmc-color-bar" style="background:${habit.color}"></div>
        <div class="hmc-days-row">
          ${activeDaysLabels.map(d => `<span class="hmc-day-pill">${d}</span>`).join('')}
        </div>`;

      card.querySelector('.edit').addEventListener('click', () => {
        UI.openHabitModal(habit.id);
      });
      card.querySelector('.delete').addEventListener('click', () => {
        this.delete(habit.id);
        this.renderManageCards();
        this.renderTable();
        Stats.update();
        Profile.render();
        UI.toast('Hábito eliminado');
      });

      grid.appendChild(card);
    });

    UI.toggleEmpty('habit-manage-empty', State.habits.length === 0);
  },

  // ── Render day toggles (section-habits) ──
  renderDayToggles() {
    const row = document.getElementById('day-toggle-row');
    row.innerHTML = '';
    CONFIG.DAYS_FULL.forEach((d, i) => {
      const btn = document.createElement('button');
      btn.className = `day-toggle-btn${State.activeDays[i] ? ' active' : ''}`;
      btn.textContent = d;
      btn.addEventListener('click', () => {
        State.activeDays[i] = !State.activeDays[i];
        btn.classList.toggle('active', State.activeDays[i]);
        State.save();
        this.renderTable();
        Stats.update();
      });
      row.appendChild(btn);
    });
  },

  // ── Save from modal ───────────────
  saveFromModal() {
    const name  = document.getElementById('habit-name').value.trim();
    const emoji = document.getElementById('habit-emoji').value.trim();
    const color = document.getElementById('habit-color').value;
    const editId = document.getElementById('habit-edit-id').value;

    if (!name) { UI.toast('Escribe un nombre para el hábito', 'danger'); return; }

    const days = Array.from(document.querySelectorAll('#habit-days-mini .day-mini-btn'))
      .map(btn => btn.classList.contains('active'));

    const data = { name, emoji: emoji || '✦', color, days };

    if (editId) {
      this.update(editId, data);
      UI.toast('Hábito actualizado', 'success');
    } else {
      this.add(data);
      UI.toast('Hábito creado', 'success');
    }

    UI.closeHabitModal();
    this.renderTable();
    this.renderManageCards();
    Stats.update();
    Profile.render();
  },
};

/* ══════════════════════════════════════
   7. GOALS MODULE
══════════════════════════════════════ */
const Goals = {
  add(text) {
    if (!text.trim()) return;
    State.goals.push({ id: `g_${Date.now()}`, text: text.trim(), done: false });
    State.save();
    this.render();
  },

  toggle(id) {
    const g = State.goals.find(g => g.id === id);
    if (g) g.done = !g.done;
    State.save();
    this.render();
    Profile.render();
  },

  delete(id) {
    State.goals = State.goals.filter(g => g.id !== id);
    State.save();
    this.render();
    Profile.render();
  },

  render() {
    const list = document.getElementById('goal-list');
    list.innerHTML = '';
    State.goals.forEach(g => {
      const li = document.createElement('li');
      li.className = `goal-item${g.done ? ' done' : ''}`;

      const check = document.createElement('span');
      check.className = `goal-check${g.done ? ' checked' : ''}`;
      check.textContent = g.done ? '✓' : '';
      check.addEventListener('click', () => this.toggle(g.id));

      const txt = document.createElement('span');
      txt.className = 'goal-text';
      txt.textContent = g.text;

      const del = document.createElement('button');
      del.className = 'goal-delete';
      del.textContent = '✕';
      del.addEventListener('click', () => this.delete(g.id));

      li.append(check, txt, del);
      list.appendChild(li);
    });
    UI.toggleEmpty('goals-empty', State.goals.length === 0);
  },
};

/* ══════════════════════════════════════
   8. ANALYTICS MODULE
══════════════════════════════════════ */
const Analytics = {
  // ── Variable toggles ──────────────
  renderToggles() {
    const row = document.getElementById('variable-toggle-row');
    row.innerHTML = '';
    CONFIG.WELLNESS_VARS.forEach(v => {
      const btn = document.createElement('button');
      btn.className = `var-toggle-btn${State.wellnessActive.includes(v.key) ? ' active' : ''}`;
      btn.textContent = v.label;
      btn.dataset.key = v.key;
      btn.addEventListener('click', () => {
        if (State.wellnessActive.includes(v.key)) {
          if (State.wellnessActive.length === 1) { UI.toast('Selecciona al menos una variable', 'danger'); return; }
          State.wellnessActive = State.wellnessActive.filter(k => k !== v.key);
        } else {
          State.wellnessActive.push(v.key);
        }
        btn.classList.toggle('active', State.wellnessActive.includes(v.key));
        State.save();
        this.renderDailyInputs();
        this.renderChart();
      });
      row.appendChild(btn);
    });
  },

  // ── Daily value inputs ────────────
  renderDailyInputs() {
    const grid = document.getElementById('daily-grid');
    grid.innerHTML = '';
    const wk = State.getWeekKey();

    State.wellnessActive.forEach(key => {
      const varDef = CONFIG.WELLNESS_VARS.find(v => v.key === key);
      if (!varDef) return;

      if (!State.wellnessData[wk]) State.wellnessData[wk] = {};
      if (!State.wellnessData[wk][key]) State.wellnessData[wk][key] = [0,0,0,0,0,0,0];

      const group = document.createElement('div');
      group.className = 'daily-var-group';

      const lbl = document.createElement('div');
      lbl.className = 'daily-var-label';
      lbl.textContent = varDef.label;

      const daysWrap = document.createElement('div');
      daysWrap.className = 'daily-days-inputs';

      CONFIG.DAYS.forEach((d, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'day-value-wrap';

        const dayLbl = document.createElement('span');
        dayLbl.className = 'day-value-label';
        dayLbl.textContent = d;

        const inp = document.createElement('input');
        inp.type = 'number';
        inp.className = 'day-value-input';
        inp.min = 0; inp.max = 10;
        inp.value = State.wellnessData[wk][key][i] || 0;
        inp.dataset.key = key;
        inp.dataset.day = i;

        inp.addEventListener('input', () => {
          let val = parseInt(inp.value) || 0;
          if (val < 0) val = 0;
          if (val > 10) val = 10;
          inp.value = val;
          State.wellnessData[wk][key][i] = val;
          State.save();
          this.renderChart();
        });

        wrap.append(dayLbl, inp);
        daysWrap.appendChild(wrap);
      });

      group.append(lbl, daysWrap);
      grid.appendChild(group);
    });
  },

  // ── Chart ─────────────────────────
  renderChart() {
    const ctx = document.getElementById('wellness-chart');
    if (!ctx) return;

    if (this.chart) { this.chart.destroy(); this.chart = null; }

    const isDark = State.theme === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
    const tickColor = isDark ? '#78716c' : '#a1a1aa';

    const wk = State.getWeekKey();
    const datasets = State.wellnessActive.map(key => {
      const varDef = CONFIG.WELLNESS_VARS.find(v => v.key === key);
      const data = (State.wellnessData[wk]?.[key]) || [0,0,0,0,0,0,0];
      return {
        label: varDef?.label || key,
        data,
        borderColor: varDef?.color,
        backgroundColor: varDef?.color + '22',
        borderWidth: 2,
        pointBackgroundColor: varDef?.color,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: .4,
      };
    });

    this.chart = new Chart(ctx, {
      type: 'line',
      data: { labels: CONFIG.DAYS, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: tickColor, font: { family: "'DM Sans'" }, boxWidth: 12 },
          },
          tooltip: { backgroundColor: isDark ? '#1c1c1a' : '#fff', titleColor: isDark ? '#fafaf9' : '#18181b', bodyColor: isDark ? '#a8a29e' : '#71717a', borderColor: isDark ? '#2a2a28' : '#e8e8e4', borderWidth: 1 },
        },
        scales: {
          x: { ticks: { color: tickColor, font: { family: "'DM Sans'" } }, grid: { color: gridColor } },
          y: { min: 0, max: 10, ticks: { color: tickColor, font: { family: "'DM Sans'" }, stepSize: 2 }, grid: { color: gridColor } },
        },
      },
    });
  },
};

/* ══════════════════════════════════════
   9. STATS MODULE
══════════════════════════════════════ */
const Stats = {
  // Weekly % for current week
  getWeeklyPct() {
    if (State.habits.length === 0) return 0;
    const wk = State.getWeekKey();
    let total = 0, done = 0;
    State.habits.forEach(h => {
      const arr = State.ensureCompletion(h.id, wk);
      CONFIG.DAYS.forEach((_, i) => {
        if (State.activeDays[i] && h.days[i]) { total++; if (arr[i]) done++; }
      });
    });
    return total > 0 ? Math.round((done / total) * 100) : 0;
  },

  // Simulated monthly: average of last 4 weeks including current
  getMonthlyPct() {
    const pct = this.getWeeklyPct();
    // Simulate nearby weeks based on stored completions
    const allWeeks = new Set();
    Object.values(State.completions).forEach(hc => Object.keys(hc).forEach(w => allWeeks.add(w)));
    if (allWeeks.size <= 1) return pct;
    let sum = 0; let count = 0;
    allWeeks.forEach(wk => {
      let t = 0, d = 0;
      State.habits.forEach(h => {
        const arr = State.completions[h.id]?.[wk] || [];
        CONFIG.DAYS.forEach((_, i) => {
          if (State.activeDays[i] && h.days[i]) { t++; if (arr[i]) d++; }
        });
      });
      if (t > 0) { sum += d / t; count++; }
    });
    return count > 0 ? Math.round((sum / count) * 100) : pct;
  },

  getAnnualPct() {
    return Math.round((this.getMonthlyPct() * 0.85 + this.getWeeklyPct() * 0.15));
  },

  // Streak: consecutive days with ≥ 1 completed habit
  getStreak() {
    const wk = State.getWeekKey();
    const today = new Date();
    const todayIdx = (today.getDay() + 6) % 7; // Mon=0
    let streak = 0;
    for (let i = todayIdx; i >= 0; i--) {
      if (!State.activeDays[i]) continue;
      let anyDone = State.habits.some(h => {
        const arr = State.completions[h.id]?.[wk] || [];
        return h.days[i] && arr[i];
      });
      if (anyDone) streak++;
      else break;
    }
    return streak;
  },

  getCompletedThisWeek() {
    const wk = State.getWeekKey();
    let done = 0;
    State.habits.forEach(h => {
      const arr = State.ensureCompletion(h.id, wk);
      arr.forEach((v, i) => { if (v && State.activeDays[i] && h.days[i]) done++; });
    });
    return done;
  },

  update() {
    const weekly  = this.getWeeklyPct();
    const monthly = this.getMonthlyPct();
    const annual  = this.getAnnualPct();
    const streak  = this.getStreak();

    // Dashboard
    this.animateValue('dash-weekly',  weekly  + '%');
    this.animateValue('dash-monthly', monthly + '%');
    this.animateValue('dash-annual',  annual  + '%');
    this.animateValue('dash-streak',  streak  + ' días');

    setBarWidth('bar-weekly',  weekly);
    setBarWidth('bar-monthly', monthly);
    setBarWidth('bar-annual',  annual);

    // Week range label
    const now = new Date();
    const mon = new Date(now); mon.setDate(now.getDate() - (now.getDay() + 6) % 7);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const fmt = d => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const weekRangeEl = document.getElementById('week-range');
    if (weekRangeEl) weekRangeEl.textContent = `${fmt(mon)} – ${fmt(sun)}`;
  },

  animateValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  },
};

/* ══════════════════════════════════════
   10. PROFILE MODULE
══════════════════════════════════════ */
const Profile = {
  render() {
    const name  = State.currentUser?.name  || 'Usuario';
    const email = State.currentUser?.email || '';

    document.getElementById('profile-name-display').textContent  = name;
    document.getElementById('profile-email-display').textContent = email;
    document.getElementById('profile-avatar').textContent = name.charAt(0).toUpperCase();
    document.getElementById('profile-name-input').value = name;

    const weekly  = Stats.getWeeklyPct();
    const monthly = Stats.getMonthlyPct();
    const annual  = Stats.getAnnualPct();
    const general = Math.round((weekly + monthly + annual) / 3);

    document.getElementById('prof-habits-count').textContent = State.habits.length;
    document.getElementById('prof-streak').textContent = Stats.getStreak();
    document.getElementById('prof-completed').textContent = Stats.getCompletedThisWeek();
    document.getElementById('prof-general').textContent = general + '%';
    document.getElementById('prof-weekly').textContent  = weekly  + '%';
    document.getElementById('prof-monthly').textContent = monthly + '%';
    document.getElementById('prof-annual').textContent  = annual  + '%';
    document.getElementById('prof-goals').textContent   = State.goals.filter(g => g.done).length;
  },

  saveName() {
    const name = document.getElementById('profile-name-input').value.trim();
    if (!name) return;
    State.currentUser.name = name;
    Storage.set(Auth.SESSION_KEY, State.currentUser);
    this.render();
    UI.updateGreeting();
    UI.toast('Perfil actualizado', 'success');
  },
};

/* ══════════════════════════════════════
   UTILITY FUNCTIONS
══════════════════════════════════════ */
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function setBarWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = pct + '%';
}
function $(id) { return document.getElementById(id); }

/* ══════════════════════════════════════
   11. INIT — Event Binding & Bootstrap
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  // Load persisted state
  State.load();

  // ── AUTH EVENTS ─────────────────────
  $('go-register').addEventListener('click', () => {
    $('login-panel').classList.remove('active');
    $('register-panel').classList.add('active');
  });
  $('go-login').addEventListener('click', () => {
    $('register-panel').classList.remove('active');
    $('login-panel').classList.add('active');
  });

  $('btn-login').addEventListener('click', () => {
    const email    = $('login-email').value.trim();
    const password = $('login-password').value;
    const remember = $('remember-me').checked;
    if (!email || !password) { UI.toast('Completa todos los campos', 'danger'); return; }
    const result = Auth.login(email, password, remember);
    if (result.ok) {
      UI.showApp();
    } else {
      UI.toast(result.msg, 'danger');
    }
  });

  $('btn-register').addEventListener('click', () => {
    const name     = $('reg-name').value.trim();
    const email    = $('reg-email').value.trim();
    const password = $('reg-password').value;
    const result = Auth.register(name, email, password);
    if (result.ok) {
      UI.showApp();
      UI.toast(`Bienvenido, ${name}! 🎉`, 'success');
    } else {
      UI.toast(result.msg, 'danger');
    }
  });

  $('btn-logout').addEventListener('click', () => Auth.logout());

  // ── NAVIGATION ──────────────────────
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      UI.navigate(item.dataset.section);
    });
  });

  // ── SIDEBAR MOBILE ──────────────────
  $('hamburger').addEventListener('click', () => UI.openSidebar());
  $('sidebar-close').addEventListener('click', () => UI.closeSidebar());

  // ── THEME TOGGLE ────────────────────
  $('theme-toggle').addEventListener('click', () => UI.toggleTheme());

  // ── HABIT MODAL ─────────────────────
  $('btn-open-add-habit').addEventListener('click',  () => UI.openHabitModal());
  $('btn-open-add-habit2').addEventListener('click', () => UI.openHabitModal());
  $('modal-habit-close').addEventListener('click',   () => UI.closeHabitModal());
  $('btn-cancel-habit').addEventListener('click',    () => UI.closeHabitModal());
  $('btn-save-habit').addEventListener('click',      () => Habits.saveFromModal());

  // Close modal on overlay click
  $('modal-habit').addEventListener('click', (e) => {
    if (e.target === $('modal-habit')) UI.closeHabitModal();
  });

  // Enter key in habit name
  $('habit-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Habits.saveFromModal();
  });

  // ── GOALS ───────────────────────────
  $('btn-add-goal').addEventListener('click', () => {
    const val = $('goal-input').value;
    Goals.add(val);
    $('goal-input').value = '';
  });
  $('goal-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btn-add-goal').click();
  });

  // ── PROFILE ─────────────────────────
  $('btn-save-profile').addEventListener('click', () => Profile.saveName());
  $('profile-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Profile.saveName();
  });

  // ── INIT AUTH ───────────────────────
  // Render day toggles early (before auth check so they're ready)
  Habits.renderDayToggles();
  Goals.render();
  Analytics.renderToggles();

  Auth.init();

  /* ──────────────────────────────────────
     TODO: Firebase Setup
     ──────────────────────────────────────
     1. Install Firebase SDK via npm or CDN
     2. Initialize:
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db   = getFirestore(app);

     3. Replace Auth.login with signInWithEmailAndPassword()
     4. Replace Auth.register with createUserWithEmailAndPassword()
     5. Replace Storage.get/set with Firestore reads/writes
        - Collection: users/{uid}/habits
        - Collection: users/{uid}/goals
        - Collection: users/{uid}/completions/{weekKey}
        - Collection: users/{uid}/wellnessData/{weekKey}
     6. Use onAuthStateChanged to reactively show/hide app
     ────────────────────────────────────── */
});

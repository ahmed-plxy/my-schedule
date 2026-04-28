
(() => {
  const STORAGE_KEY = 'jadouliProStateV1';
  const LEGACY_KEYS = ['studyPlanStateV5', 'fullPlanProgress'];

  const themePresets = {
    midnight: {
      label: 'Midnight',
      '--bg': '#050816',
      '--bg-gradient': '#111a33',
      '--card-bg': 'rgba(12, 18, 35, 0.82)',
      '--glass': 'rgba(8, 12, 24, 0.72)',
      '--text-main': '#f8fbff',
      '--text-dim': '#aeb8d4',
      '--line': 'rgba(255,255,255,0.08)',
      '--accent': '#5eead4',
      '--success': '#22c55e',
      '--phys-color': '#facc15',
      '--bio-color': '#86efac',
      '--chem-color': '#60a5fa',
      '--sol-color': '#f87171',
      '--eng-color': '#c4b5fd',
      '--shadow-color': 'rgba(34,197,94,0.18)'
    },
    ocean: {
      label: 'Ocean',
      '--bg': '#04111a',
      '--bg-gradient': '#0b2a44',
      '--card-bg': 'rgba(8, 24, 38, 0.82)',
      '--glass': 'rgba(5, 18, 29, 0.72)',
      '--text-main': '#f3fbff',
      '--text-dim': '#a4c4d8',
      '--line': 'rgba(255,255,255,0.08)',
      '--accent': '#38bdf8',
      '--success': '#22c55e',
      '--phys-color': '#f59e0b',
      '--bio-color': '#94d7aa',
      '--chem-color': '#60a5fa',
      '--sol-color': '#fb7185',
      '--eng-color': '#a78bfa',
      '--shadow-color': 'rgba(56,189,248,0.18)'
    },
    sunrise: {
      label: 'Sunrise',
      '--bg': '#171008',
      '--bg-gradient': '#4d220d',
      '--card-bg': 'rgba(36, 21, 10, 0.84)',
      '--glass': 'rgba(29, 17, 8, 0.74)',
      '--text-main': '#fffaf3',
      '--text-dim': '#d3bda6',
      '--line': 'rgba(255,255,255,0.08)',
      '--accent': '#fbbf24',
      '--success': '#f97316',
      '--phys-color': '#fde047',
      '--bio-color': '#bef264',
      '--chem-color': '#60a5fa',
      '--sol-color': '#fb7185',
      '--eng-color': '#f0abfc',
      '--shadow-color': 'rgba(251,191,36,0.18)'
    },
    ember: {
      label: 'Ember',
      '--bg': '#150708',
      '--bg-gradient': '#45181c',
      '--card-bg': 'rgba(34, 10, 14, 0.84)',
      '--glass': 'rgba(24, 8, 11, 0.74)',
      '--text-main': '#fff7f7',
      '--text-dim': '#e0b3b7',
      '--line': 'rgba(255,255,255,0.08)',
      '--accent': '#fb7185',
      '--success': '#f43f5e',
      '--phys-color': '#facc15',
      '--bio-color': '#86efac',
      '--chem-color': '#60a5fa',
      '--sol-color': '#ff6b6b',
      '--eng-color': '#f9a8d4',
      '--shadow-color': 'rgba(244,63,94,0.18)'
    }
  };

  const subjectMeta = {
    phys: { label: 'فيزياء', icon: '⚡' },
    chem: { label: 'كيمياء', icon: '🧪' },
    bio: { label: 'أحياء', icon: '🌿' },
    sol: { label: 'حل', icon: '✅' },
    eng: { label: 'إنجليزي', icon: '✍️' },
    rev: { label: 'مراجعة', icon: '♻️' }
  };

  const state = loadState();

  const els = {
    progressFill: document.getElementById('bar-fill'),
    progressText: document.getElementById('percent-val'),
    progressLabel: document.getElementById('progressLabel'),
    streak: document.getElementById('streakCount'),
    completed: document.getElementById('completedCount'),
    remaining: document.getElementById('remainingCount'),
    level: document.getElementById('levelCount'),
    subject: document.getElementById('subjectCount'),
    heroTitle: document.getElementById('heroTitle'),
    heroSubtitle: document.getElementById('heroSubtitle'),
    reminder: document.getElementById('reminderBanner'),
    nextTask: document.getElementById('nextTaskBox'),
    weekGrid: document.getElementById('weekGrid'),
    weeksContainer: document.getElementById('weeksContainer'),
    examGrid: document.getElementById('examGrid'),
    focusModal: document.getElementById('focusModal'),
    focusTitle: document.getElementById('focusTitle'),
    focusMeta: document.getElementById('focusMeta'),
    focusTimer: document.getElementById('focusTimer'),
    focusStartPause: document.getElementById('focusStartPause'),
    focusReset: document.getElementById('focusReset'),
    focusDoneNext: document.getElementById('focusDoneNext'),
    focusClose: document.getElementById('focusClose'),
    toastHost: document.getElementById('toastHost'),
    themeButtons: document.getElementById('themeButtons'),
    searchInput: document.getElementById('searchInput'),
    filterButtons: document.querySelectorAll('[data-filter]'),
    openFocusBtn: document.getElementById('openFocusBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importInput: document.getElementById('importInput'),
    resetBtn: document.getElementById('resetBtn'),
    expandAllBtn: document.getElementById('expandAllBtn'),
    collapseAllBtn: document.getElementById('collapseAllBtn'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    currentStatus: document.getElementById('currentStatus'),
    scheduleHint: document.getElementById('scheduleHint'),
    currentWeekTag: document.getElementById('currentWeekTag'),
    weekCount: document.getElementById('weekCount'),
    currentDayTag: document.getElementById('currentDayTag'),
  };

  const dataset = buildDataset(studyWeeks);
  const todayIso = localIso(new Date());

  let focusTicker = null;
  let countdownTicker = null;

  initThemePicker();
  bindEvents();
  renderAll(true);
  startTicker();
  maybeOpenCurrentWeek();
  setActiveFilterButtons();
  setSearchValue();
  showInitialTip();

  function loadState() {
    const defaultState = {
      theme: 'midnight',
      filter: 'all',
      search: '',
      collapsedWeeks: {},
      completed: {},
      focus: { taskId: null, remaining: 25 * 60, running: false },
    };

    const saved = readJSON(STORAGE_KEY);
    if (saved) {
      return normalizeState(saved, defaultState);
    }

    const migrated = migrateLegacyState(defaultState);
    saveState(migrated);
    return migrated;
  }

  function normalizeState(saved, fallback) {
    const next = {
      ...fallback,
      ...saved,
      focus: {
        ...fallback.focus,
        ...(saved.focus || {}),
      },
      collapsedWeeks: typeof saved.collapsedWeeks === 'object' && saved.collapsedWeeks ? saved.collapsedWeeks : fallback.collapsedWeeks,
      completed: typeof saved.completed === 'object' && saved.completed ? saved.completed : {},
    };

    if (!Object.keys(next.completed).length && saved.done && typeof saved.done === 'object') {
      Object.entries(saved.done).forEach(([id, value]) => {
        if (!value) return;
        const match = String(id).match(/task-(\d+)-(\d+)/);
        if (!match) return;
        const week = Number(match[1]);
        const day = Number(match[2]);
        const sourceIndex = (week - 1) * 7 + (day - 1);
        dataset.items
          .filter(item => item.sourceIndex === sourceIndex)
          .forEach(item => { next.completed[item.id] = true; });
      });
    }

    if (!themePresets[next.theme]) next.theme = fallback.theme;
    if (!['all', 'done', 'pending'].includes(next.filter)) next.filter = fallback.filter;
    if (typeof next.search !== 'string') next.search = '';
    return next;
  }

  function migrateLegacyState(fallback) {
    const migrated = structuredCloneSafe(fallback);
    const completed = {};

    // Legacy V5 state: {done: {task-01-01:true...}}
    const v5 = readJSON('studyPlanStateV5');
    if (v5 && v5.done && typeof v5.done === 'object') {
      Object.entries(v5.done).forEach(([id, value]) => {
        if (!value) return;
        const match = String(id).match(/task-(\d+)-(\d+)/);
        if (!match) return;
        const week = Number(match[1]);
        const day = Number(match[2]);
        const sourceIndex = (week - 1) * 7 + (day - 1);
        dataset.items
          .filter(item => item.sourceIndex === sourceIndex)
          .forEach(item => { completed[item.id] = true; });
      });
    }

    // Legacy flat array of done indices
    const flat = readJSON('fullPlanProgress');
    if (flat && typeof flat === 'object') {
      Object.entries(flat).forEach(([k, value]) => {
        if (!value) return;
        const idx = Number(k);
        if (!Number.isInteger(idx)) return;
        dataset.items
          .filter(item => item.sourceIndex === idx)
          .forEach(item => { completed[item.id] = true; });
      });
    }

    migrated.completed = completed;
    migrated.theme = 'midnight';
    migrated.filter = 'all';
    migrated.search = '';
    migrated.collapsedWeeks = defaultCollapsedWeeks();
    migrated.focus = { taskId: null, remaining: 25 * 60, running: false };
    return migrated;
  }

  function saveState(next = state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function readJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function structuredCloneSafe(value) {
    try {
      return structuredClone(value);
    } catch {
      return JSON.parse(JSON.stringify(value));
    }
  }

  function buildDataset(weeks) {
    const items = [];
    const days = [];
    weeks.forEach((week, weekIndex) => {
      week.days.forEach((day, dayIndex) => {
        const enrichedItems = day.items.map((item, itemIndex) => {
          const id = [
            `w${String(weekIndex + 1).padStart(2, '0')}`,
            `d${String(dayIndex + 1).padStart(2, '0')}`,
            `i${String(itemIndex + 1).padStart(2, '0')}`,
            `s${String(item.sourceIndex).padStart(2, '0')}`,
          ].join('-');
          const enriched = {
            ...item,
            id,
            weekIndex,
            weekTitle: week.title,
            dayIndex,
            dayLabel: day.label,
            dayDate: day.date,
            dayKey: day.date,
            isMainItem: itemIndex === 0,
          };
          items.push(enriched);
          return enriched;
        });

        const dayEntry = {
          ...day,
          weekIndex,
          weekTitle: week.title,
          dayIndex,
          items: enrichedItems,
        };
        days.push(dayEntry);
      });
    });

    return { weeks, days, items };
  }

  function defaultCollapsedWeeks() {
    const collapsed = {};
    const current = findCurrentWeekIndex();
    dataset.weeks.forEach((_, idx) => {
      collapsed[idx] = idx !== current;
    });
    return collapsed;
  }

  function findCurrentWeekIndex() {
    const idx = dataset.weeks.findIndex(week => week.days.some(day => day.date === todayIso));
    return idx >= 0 ? idx : 0;
  }

  function localIso(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function bindEvents() {
    els.themeButtons.addEventListener('click', e => {
      const btn = e.target.closest('button[data-theme]');
      if (!btn) return;
      setTheme(btn.dataset.theme);
    });

    els.filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        state.filter = btn.dataset.filter;
        saveState();
        setActiveFilterButtons();
        renderAll();
      });
    });

    els.searchInput.addEventListener('input', () => {
      state.search = els.searchInput.value;
      saveState();
      renderAll();
    });

    els.clearSearchBtn.addEventListener('click', () => {
      state.search = '';
      els.searchInput.value = '';
      saveState();
      renderAll();
      toast('تم مسح البحث');
    });

    els.openFocusBtn.addEventListener('click', () => openFocusForNext());
    els.exportBtn.addEventListener('click', exportState);
    els.importBtn.addEventListener('click', () => els.importInput.click());
    els.importInput.addEventListener('change', handleImport);
    els.resetBtn.addEventListener('click', resetProgress);
    els.expandAllBtn.addEventListener('click', () => {
      dataset.weeks.forEach((_, idx) => state.collapsedWeeks[idx] = false);
      saveState();
      renderAll();
      toast('تم فتح كل الأسابيع');
    });
    els.collapseAllBtn.addEventListener('click', () => {
      dataset.weeks.forEach((_, idx) => state.collapsedWeeks[idx] = true);
      saveState();
      renderAll();
      toast('تم إغلاق كل الأسابيع');
    });

    els.focusStartPause.addEventListener('click', toggleFocusTimer);
    els.focusReset.addEventListener('click', resetFocusTimer);
    els.focusDoneNext.addEventListener('click', completeFocusAndNext);
    els.focusClose.addEventListener('click', closeFocus);
    els.focusModal.addEventListener('click', e => {
      if (e.target === els.focusModal) closeFocus();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (isFocusOpen()) closeFocus();
      }
    });
  }

  function initThemePicker() {
    const buttons = Object.entries(themePresets).map(([key, meta]) => {
      return `<button class="theme-pill" type="button" data-theme="${key}">${meta.label}</button>`;
    }).join('');
    els.themeButtons.innerHTML = buttons;
    setTheme(state.theme, false);
  }

  function setTheme(themeKey, persist = true) {
    const preset = themePresets[themeKey] || themePresets.midnight;
    Object.entries(preset).forEach(([key, value]) => {
      if (key.startsWith('--')) document.documentElement.style.setProperty(key, value);
    });
    state.theme = themeKey;
    if (persist) saveState();
    document.querySelectorAll('[data-theme]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === themeKey);
    });
  }

  function setActiveFilterButtons() {
    els.filterButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.filter === state.filter));
  }

  function setSearchValue() {
    els.searchInput.value = state.search || '';
  }

  function showInitialTip() {
    const count = dataset.items.length;
    const done = getDoneItems().length;
    if (done === 0) {
      toast('نسخة الجدول الجديدة جاهزة ✨');
    } else {
      toast(`تم استرجاع ${done} من ${count} مهمة`);
    }
  }

  function getDoneMap() {
    return state.completed || {};
  }

  function isDone(itemId) {
    return !!getDoneMap()[itemId];
  }

  function getDoneItems() {
    return dataset.items.filter(item => isDone(item.id));
  }

  function getDayProgress(day) {
    const total = day.items.length;
    const done = day.items.filter(item => isDone(item.id)).length;
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  function getWeekProgress(weekIndex) {
    const week = dataset.weeks[weekIndex];
    const weekItems = week.days.flatMap(day => day.items);
    const done = weekItems.filter(item => isDone(item.id)).length;
    const total = weekItems.length;
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  function getOverallProgress() {
    const done = getDoneItems().length;
    const total = dataset.items.length;
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  function getCompletedDays() {
    return dataset.days.filter(day => day.items.every(item => isDone(item.id)));
  }

  function getCompletedDaySet() {
    const set = new Set();
    dataset.days.forEach(day => {
      if (day.items.some(item => isDone(item.id))) set.add(day.date);
    });
    return set;
  }

  function calculateStreak() {
    const touchedDays = getCompletedDaySet();
    if (!touchedDays.size) return 0;

    const orderedDays = [...dataset.days]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(day => day.date);

    let anchor = null;
    for (let i = orderedDays.length - 1; i >= 0; i--) {
      if (touchedDays.has(orderedDays[i])) {
        anchor = orderedDays[i];
        break;
      }
    }
    if (!anchor) return 0;

    let streak = 0;
    let cursor = anchor;
    while (touchedDays.has(cursor)) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function addDays(iso, delta) {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + delta);
    return localIso(d);
  }

  function getTopSubject() {
    const counts = { phys: 0, chem: 0, bio: 0, sol: 0, eng: 0 };
    getDoneItems().forEach(item => {
      if (counts[item.type] !== undefined) counts[item.type] += 1;
    });
    const ordered = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!ordered[0] || ordered[0][1] === 0) return '—';
    return subjectMeta[ordered[0][0]]?.label || '—';
  }

  function getLevel(doneCount) {
    return Math.floor(doneCount / 5) + 1;
  }

  function getNextLevelProgress(doneCount) {
    const level = getLevel(doneCount);
    const start = (level - 1) * 5;
    const end = level * 5;
    return { level, start, end, percent: Math.min(100, ((doneCount - start) / 5) * 100) };
  }

  function getNextIncompleteItem() {
    return dataset.items.find(item => !isDone(item.id)) || null;
  }

  function getCurrentDay() {
    return dataset.days.find(day => day.date === todayIso) || null;
  }

  function getCurrentWeekIndexFromDate(dateIso) {
    return dataset.weeks.findIndex(week => week.days.some(day => day.date === dateIso));
  }

  function getReminderText() {
    const next = getNextIncompleteItem();
    if (!next) return 'أنت خلصت الجدول كله 🔥';
    const doneCount = getDoneItems().length;
    const remaining = dataset.items.length - doneCount;
    const currentDay = getCurrentDay();
    if (currentDay) {
      const dayProgress = getDayProgress(currentDay);
      if (dayProgress.percent === 100) return `اليوم مكتمل، ممتاز 👏 المتبقي ${remaining} مهمة`;
      return `اليوم عندك ${dayProgress.total - dayProgress.done} مهمة لسه مفتوحة`;
    }
    return `عندك ${remaining} مهمة متبقية`;
  }

  function buildTaskSearchIndex(day, item) {
    return [
      day.label,
      day.date,
      day.weekTitle,
      item.text,
      subjectMeta[item.type]?.label || '',
    ].join(' ').toLowerCase();
  }

  function taskMatchesFilters(day, item) {
    const query = state.search.trim().toLowerCase();
    const matchesSearch = !query || buildTaskSearchIndex(day, item).includes(query);
    const matchesStatus = state.filter === 'all'
      || (state.filter === 'done' && isDone(item.id))
      || (state.filter === 'pending' && !isDone(item.id));
    return matchesSearch && matchesStatus;
  }

  function applyThemeBodyClass() {
    document.body.dataset.theme = state.theme;
  }

  function renderAll(scrollToCurrent = false) {
    applyThemeBodyClass();
    setTheme(state.theme, false);
    renderHeader();
    renderScheduleMap();
    renderWeeks(scrollToCurrent);
    renderExams();
    updateCountdownCards();
    syncFocusState();
    renderToastHint();
  }

  function renderHeader() {
    const done = getDoneItems().length;
    const total = dataset.items.length;
    const progress = getOverallProgress();
    const streak = calculateStreak();
    const levelInfo = getNextLevelProgress(done);
    const remaining = total - done;
    const currentDay = getCurrentDay();
    const currentWeekIndex = currentDay ? getCurrentWeekIndexFromDate(currentDay.date) : findCurrentWeekIndex();

    els.progressFill.style.width = `${progress.percent}%`;
    els.progressText.textContent = `${progress.percent}%`;
    els.progressLabel.textContent = `تم إنجاز ${done} من ${total} مهمة`;

    els.streak.textContent = streak;
    els.completed.textContent = done;
    els.remaining.textContent = remaining;
    els.level.textContent = `Lv ${levelInfo.level}`;
    els.subject.textContent = getTopSubject();
    els.heroTitle.textContent = `جدولي الدراسي`;
    els.heroSubtitle.textContent = `تقسيم أسبوعي منظم + ثيمات تتغير معها ألوان المواد + Focus Mode وملخصات ذكية.`;

    els.currentStatus.textContent = currentDay ? `اليوم الحالي: ${currentDay.weekTitle} · ${currentDay.label}` : 'لا يوجد يوم مطابق للتاريخ الحالي';
    els.currentWeekTag.textContent = currentWeekIndex >= 0 ? dataset.weeks[currentWeekIndex].title : '—';
    els.weekCount.textContent = `${dataset.weeks.length} أسابيع`;
    els.currentDayTag.textContent = currentDay ? currentDay.label : '—';
    els.scheduleHint.textContent = getReminderText();
    els.reminder.textContent = getReminderText();
    els.nextTask.innerHTML = renderNextTaskCard();

    const section = document.getElementById('heroProgress');
    if (section) {
      section.style.setProperty('--progress', `${progress.percent}%`);
    }
  }

  function renderNextTaskCard() {
    const next = getNextIncompleteItem();
    if (!next) {
      return `<div class="next-task-empty">🎉 مفيش أي مهام متبقية. شغل ممتاز.</div>`;
    }
    const day = dataset.days.find(d => d.date === next.dayDate);
    return `
      <div class="next-task-card" data-scroll-day="${day?.date || ''}">
        <div class="next-task-top">
          <span class="next-task-badge">${subjectMeta[next.type]?.icon || '•'} ${subjectMeta[next.type]?.label || 'مهمة'}</span>
          <span class="next-task-day">${day?.label || ''}</span>
        </div>
        <div class="next-task-title">${escapeHtml(splitTaskText(next.text).title)}</div>
        <div class="next-task-meta">${escapeHtml(splitTaskText(next.text).meta || '')}</div>
        <div class="next-task-actions">
          <button class="mini-btn" type="button" data-action="jump-next">روح لها</button>
          <button class="mini-btn outline" type="button" data-action="focus-next">Focus Mode</button>
        </div>
      </div>
    `;
  }

  function renderScheduleMap() {
    const chips = dataset.days.map(day => {
      const progress = getDayProgress(day);
      const current = day.date === todayIso;
      const done = progress.percent === 100;
      return `
        <button class="schedule-chip ${done ? 'done' : ''} ${current ? 'current' : ''}" type="button" data-scroll-day="${day.date}">
          <span class="chip-day">${day.label}</span>
          <span class="chip-progress">${progress.done}/${progress.total}</span>
        </button>
      `;
    }).join('');
    els.weekGrid.innerHTML = chips;
  }

  function renderWeeks(forceOpen = false) {
    const query = state.search.trim().toLowerCase();
    const weekHtml = dataset.weeks.map((week, weekIndex) => {
      const weekProgress = getWeekProgress(weekIndex);
      const weekHasToday = week.days.some(day => day.date === todayIso);
      const isCollapsed = forceOpen ? false : !!state.collapsedWeeks[weekIndex];
      const daysHtml = week.days.map(day => {
        const filteredItems = day.items.filter(item => taskMatchesFilters(day, item));
        if (!filteredItems.length) return '';
        const progress = getDayProgress(day);
        const dayDone = progress.percent === 100;
        const current = day.date === todayIso;
        const itemsHtml = filteredItems.map(item => taskItemHtml(day, item)).join('');
        return `
          <article class="day-card ${dayDone ? 'done' : ''} ${current ? 'current' : ''}" data-day-card data-day-id="${day.date}">
            <header class="day-head">
              <div class="day-title-wrap">
                <div class="day-date">${day.label}</div>
                <div class="day-subtitle">${day.weekTitle}</div>
              </div>
              <div class="day-meta">
                <span class="day-pill ${dayDone ? 'done' : ''}">${progress.done}/${progress.total}</span>
                ${current ? '<span class="day-pill current">اليوم</span>' : ''}
              </div>
            </header>
            <div class="day-items">
              ${itemsHtml}
            </div>
          </article>
        `;
      }).filter(Boolean).join('');

      if (!daysHtml) return '';

      return `
        <section class="week-section ${weekHasToday ? 'current' : ''}" data-week-index="${weekIndex}">
          <button class="week-head" type="button" data-toggle-week="${weekIndex}">
            <div class="week-copy">
              <div class="week-title">${week.title}</div>
              <div class="week-subtitle">${weekProgress.done}/${weekProgress.total} مهمة مكتملة</div>
            </div>
            <div class="week-right">
              <div class="week-progress">
                <span style="width:${weekProgress.percent}%"></span>
              </div>
              <div class="week-percent">${weekProgress.percent}%</div>
              <div class="week-chevron">${isCollapsed ? '▾' : '▴'}</div>
            </div>
          </button>
          <div class="week-body ${isCollapsed ? 'collapsed' : ''}">
            ${daysHtml}
          </div>
        </section>
      `;
    }).filter(Boolean).join('');

    els.weeksContainer.innerHTML = weekHtml || '<div class="empty-state">لا توجد نتائج مطابقة</div>';

    els.weeksContainer.querySelectorAll('[data-toggle-week]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.toggleWeek);
        state.collapsedWeeks[idx] = !state.collapsedWeeks[idx];
        saveState();
        renderAll();
      });
    });

    els.weeksContainer.querySelectorAll('[data-action="open-task"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.taskId;
        openFocusForItem(id);
      });
    });

    els.weeksContainer.querySelectorAll('[data-action="toggle-task"]').forEach(btn => {
      btn.addEventListener('click', () => toggleTask(btn.dataset.taskId, btn));
    });

    els.weeksContainer.querySelectorAll('[data-scroll-day]').forEach(node => {
      node.addEventListener('click', () => scrollToDay(node.dataset.scrollDay));
    });

    if (query && els.weeksContainer.children.length) {
      // Expand matching weeks automatically when searching
      els.weeksContainer.querySelectorAll('.week-body').forEach(el => el.classList.remove('collapsed'));
    }
  }

  function taskItemHtml(day, item) {
    const done = isDone(item.id);
    const meta = splitTaskText(item.text);
    const metaLine = meta.meta ? `<div class="task-meta">${escapeHtml(meta.meta)}</div>` : '';
    const type = item.type;
    return `
      <article class="task-item ${done ? 'done' : ''}" data-task-row data-task-id="${item.id}">
        <button class="task-toggle ${done ? 'done' : ''}" type="button" data-action="toggle-task" data-task-id="${item.id}" aria-pressed="${done}" aria-label="تحديد المهمة">
          <span class="task-toggle-mark">✓</span>
        </button>
        <div class="task-copy">
          <div class="task-top">
            <span class="task-tag tag-${type}">${subjectMeta[type]?.icon || '•'} ${subjectMeta[type]?.label || type}</span>
            <span class="task-state">${done ? 'منجزة' : 'مفتوحة'}</span>
          </div>
          <div class="task-title">${escapeHtml(meta.title)}</div>
          ${metaLine}
        </div>
        <div class="task-actions">
          <button class="icon-btn" type="button" data-action="open-task" data-task-id="${item.id}" aria-label="فتح فوكس مود">⏱</button>
        </div>
      </article>
    `;
  }

  function splitTaskText(text) {
    const parts = String(text).split('|').map(part => part.trim()).filter(Boolean);
    const title = parts[0] || String(text);
    const meta = parts.slice(1).join(' • ');
    return { title, meta };
  }

  function scrollToDay(iso) {
    const el = document.querySelector(`[data-day-id="${iso}"]`);
    if (!el) {
      toast('اليوم غير ظاهر في الفلاتر الحالية');
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('pulse-focus');
    setTimeout(() => el.classList.remove('pulse-focus'), 1200);
  }

  function renderExams() {
    els.examGrid.innerHTML = exams.map(exam => {
      return `
        <div class="exam-card exam-${exam.id}">
          <div class="exam-head">
            <span class="exam-name">${exam.name}</span>
            <span class="exam-date">${exam.dateText}</span>
          </div>
          <div class="exam-countdown" data-exam-id="${exam.id}">
            <div><span data-slot="days">00</span><small>يوم</small></div>
            <div><span data-slot="hours">00</span><small>س</small></div>
            <div><span data-slot="minutes">00</span><small>د</small></div>
            <div><span data-slot="seconds">00</span><small>ث</small></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function updateCountdownCards() {
    const now = new Date();
    exams.forEach(exam => {
      const wrap = document.querySelector(`.exam-countdown[data-exam-id="${exam.id}"]`);
      if (!wrap) return;
      const node = {
        days: wrap.querySelector('[data-slot="days"]'),
        hours: wrap.querySelector('[data-slot="hours"]'),
        minutes: wrap.querySelector('[data-slot="minutes"]'),
        seconds: wrap.querySelector('[data-slot="seconds"]'),
      };
      const target = new Date(exam.target);
      const diff = target - now;
      if (diff <= 0) {
        node.days.textContent = '00';
        node.hours.textContent = '00';
        node.minutes.textContent = '00';
        node.seconds.textContent = '00';
        return;
      }
      const total = Math.floor(diff / 1000);
      const days = Math.floor(total / 86400);
      const hours = Math.floor((total % 86400) / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const seconds = total % 60;
      node.days.textContent = String(days).padStart(2, '0');
      node.hours.textContent = String(hours).padStart(2, '0');
      node.minutes.textContent = String(minutes).padStart(2, '0');
      node.seconds.textContent = String(seconds).padStart(2, '0');
    });
  }

  function startTicker() {
    stopTicker();
    countdownTicker = setInterval(() => updateCountdownCards(), 1000);
  }

  function stopTicker() {
    if (countdownTicker) clearInterval(countdownTicker);
    if (focusTicker) clearInterval(focusTicker);
    countdownTicker = null;
    focusTicker = null;
  }

  function renderToastHint() {
    const next = getNextIncompleteItem();
    if (next && els.scheduleHint) {
      const day = dataset.days.find(d => d.date === next.dayDate);
      els.scheduleHint.textContent = `${day?.label || ''} · ${subjectMeta[next.type]?.label || ''}`;
    }
  }

  function updateProgressAfterChange(msg) {
    saveState();
    renderAll();
    toast(msg);
  }

  function toggleTask(taskId, triggerEl = null) {
    if (isDone(taskId)) {
      if (triggerEl && triggerEl.classList.contains('task-toggle')) {
        triggerEl.setAttribute('aria-pressed', 'true');
      }
      toast('المهمة دي متقفلة بالفعل');
      return;
    }
    const item = dataset.items.find(x => x.id === taskId);
    if (!item) return;
    const day = dataset.days.find(d => d.date === item.dayDate);
    openConfirm(item, day, triggerEl);
  }

  let pendingConfirm = null;
  let pendingTriggerEl = null;

  function openConfirm(item, day, triggerEl = null) {
    pendingConfirm = { item, day };
    pendingTriggerEl = triggerEl;
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmTaskText').textContent = `${day?.label || ''} — ${splitTaskText(item.text).title}`;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeConfirm() {
    if (pendingTriggerEl && pendingTriggerEl.classList.contains('task-toggle')) {
      pendingTriggerEl.setAttribute('aria-pressed', 'false');
    }
    pendingConfirm = null;
    pendingTriggerEl = null;
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function attachConfirmHandlers() {
    const modal = document.getElementById('confirmModal');
    const ok = document.getElementById('confirmOk');
    const cancel = document.getElementById('confirmCancel');
    ok.addEventListener('click', () => {
      if (!pendingConfirm) return;
      state.completed[pendingConfirm.item.id] = true;
      if (state.focus.taskId === pendingConfirm.item.id) {
        state.focus.running = false;
      }
      saveState();
      renderAll();
      closeConfirm();
      toast('تم اعتماد المهمة ✅');
    });
    cancel.addEventListener('click', closeConfirm);
    modal.addEventListener('click', e => {
      if (e.target === modal) closeConfirm();
    });
  }

  attachConfirmHandlers();

  function openFocusForNext() {
    const next = getNextIncompleteItem();
    if (!next) {
      toast('الجدول كله متقفل بالفعل');
      return;
    }
    openFocusForItem(next.id);
  }

  function openFocusForItem(taskId) {
    const item = dataset.items.find(x => x.id === taskId);
    if (!item) return;
    stopFocusTickerOnly();
    state.focus.taskId = taskId;
    state.focus.remaining = 25 * 60;
    state.focus.running = false;
    saveState();
    syncFocusState();
    els.focusModal.classList.add('show');
    els.focusModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    renderFocusContent();
    updateFocusTimer();
  }

  function isFocusOpen() {
    return els.focusModal.classList.contains('show');
  }

  function closeFocus() {
    stopFocusTickerOnly();
    els.focusModal.classList.remove('show');
    els.focusModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    state.focus.running = false;
    saveState();
  }

  function syncFocusState() {
    if (!state.focus.taskId) {
      const next = getNextIncompleteItem();
      if (next) state.focus.taskId = next.id;
    }
    renderFocusContent();
  }

  function renderFocusContent() {
    const item = dataset.items.find(x => x.id === state.focus.taskId) || getNextIncompleteItem();
    if (!item) {
      els.focusTitle.textContent = 'لا توجد مهام';
      els.focusMeta.textContent = 'أنت خلصت الجدول كله';
      els.focusTimer.textContent = '00:00';
      els.focusStartPause.textContent = 'ابدأ';
      els.focusDoneNext.disabled = true;
      return;
    }
    const day = dataset.days.find(d => d.date === item.dayDate);
    const meta = splitTaskText(item.text);
    els.focusTitle.textContent = meta.title;
    els.focusMeta.textContent = `${day?.weekTitle || ''} · ${day?.label || ''}${meta.meta ? ' · ' + meta.meta : ''}`;
    els.focusDoneNext.disabled = false;
    updateFocusTimer();
  }

  function toggleFocusTimer() {
    if (!state.focus.taskId) openFocusForNext();
    state.focus.running = !state.focus.running;
    saveState();
    updateFocusTimer();
    if (state.focus.running) {
      focusTicker = setInterval(() => {
        state.focus.remaining = Math.max(0, state.focus.remaining - 1);
        if (state.focus.remaining === 0) state.focus.running = false;
        saveState();
        updateFocusTimer();
      }, 1000);
      toast('بدأ التركيز ⏳');
    } else {
      stopFocusTickerOnly();
      toast('تم الإيقاف مؤقتًا');
    }
  }

  function stopFocusTickerOnly() {
    if (focusTicker) clearInterval(focusTicker);
    focusTicker = null;
  }

  function resetFocusTimer() {
    state.focus.remaining = 25 * 60;
    state.focus.running = false;
    saveState();
    stopFocusTickerOnly();
    updateFocusTimer();
    toast('تمت إعادة الضبط');
  }

  function completeFocusAndNext() {
    stopFocusTickerOnly();
    if (state.focus.taskId && !isDone(state.focus.taskId)) {
      state.completed[state.focus.taskId] = true;
    }
    const next = getNextIncompleteItem();
    state.focus.taskId = next ? next.id : null;
    state.focus.remaining = 25 * 60;
    state.focus.running = false;
    saveState();
    renderAll();
    if (!next) {
      closeFocus();
      toast('خلصت آخر مهمة في الجدول 🎉');
      return;
    }
    renderFocusContent();
    updateFocusTimer();
    toast('تم حفظ المهمة والانتقال للي بعدها');
  }

  function updateFocusTimer() {
    const total = Math.max(0, Math.floor(state.focus.remaining || 0));
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    els.focusTimer.textContent = `${m}:${s}`;
    els.focusStartPause.textContent = state.focus.running ? 'إيقاف' : 'ابدأ';
    if (state.focus.running) {
      els.focusModal.classList.add('is-running');
    } else {
      els.focusModal.classList.remove('is-running');
    }
  }

  function exportState() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      theme: state.theme,
      filter: state.filter,
      search: state.search,
      collapsedWeeks: state.collapsedWeeks,
      completed: state.completed,
      focus: state.focus,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jadouli-backup-${localIso(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('تم تنزيل نسخة احتياطية');
  }

  async function handleImport(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!imported || typeof imported !== 'object') throw new Error('bad file');

      if (imported.completed && typeof imported.completed === 'object') {
        state.completed = imported.completed;
      }
      if (imported.collapsedWeeks && typeof imported.collapsedWeeks === 'object') {
        state.collapsedWeeks = imported.collapsedWeeks;
      }
      if (imported.focus && typeof imported.focus === 'object') {
        state.focus = {
          taskId: imported.focus.taskId || null,
          remaining: Number(imported.focus.remaining) || 25 * 60,
          running: false,
        };
      }
      if (themePresets[imported.theme]) state.theme = imported.theme;
      if (['all', 'done', 'pending'].includes(imported.filter)) state.filter = imported.filter;
      if (typeof imported.search === 'string') state.search = imported.search;

      saveState();
      setTheme(state.theme, false);
      setSearchValue();
      setActiveFilterButtons();
      renderAll();
      toast('تم استيراد التقدم');
    } catch (err) {
      console.error(err);
      toast('ملف الاستيراد غير صالح');
    }
  }

  function resetProgress() {
    const ok = window.confirm('هل تريد تصفير كل التقدم والإعدادات؟');
    if (!ok) return;
    state.completed = {};
    state.collapsedWeeks = defaultCollapsedWeeks();
    state.filter = 'all';
    state.search = '';
    state.focus = { taskId: null, remaining: 25 * 60, running: false };
    state.theme = 'midnight';
    setSearchValue();
    setActiveFilterButtons();
    saveState();
    setTheme(state.theme, false);
    renderAll(true);
    toast('تمت إعادة الضبط بالكامل');
  }

  function maybeOpenCurrentWeek() {
    const currentIdx = findCurrentWeekIndex();
    if (currentIdx >= 0 && state.collapsedWeeks[currentIdx] === undefined) {
      dataset.weeks.forEach((_, idx) => {
        state.collapsedWeeks[idx] = idx !== currentIdx;
      });
      saveState();
    }
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function toast(message) {
    if (!els.toastHost) return;
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    els.toastHost.appendChild(node);
    requestAnimationFrame(() => node.classList.add('show'));
    setTimeout(() => {
      node.classList.remove('show');
      setTimeout(() => node.remove(), 250);
    }, 2600);
  }

  // Delegated interactions for schedule map / next task
  document.addEventListener('click', e => {
    const scrollBtn = e.target.closest('[data-scroll-day]');
    if (scrollBtn && scrollBtn.dataset.scrollDay) {
      scrollToDay(scrollBtn.dataset.scrollDay);
      return;
    }

    const action = e.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'jump-next') {
      const next = getNextIncompleteItem();
      if (!next) return toast('مفيش مهام مفتوحة');
      scrollToDay(next.dayDate);
    }
    if (action.dataset.action === 'focus-next') {
      openFocusForNext();
    }
  });

  // Outside-state sync for focus modal
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.focus.running) {
      state.focus.running = false;
      saveState();
      stopFocusTickerOnly();
      updateFocusTimer();
    }
  });

  // Keep countdown fresh after tab becomes active
  window.addEventListener('focus', () => updateCountdownCards());
})();

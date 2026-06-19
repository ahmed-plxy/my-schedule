/* =========================
إعدادات أساسية للمشروع
   ========================= */

const BASE_DATE = new Date(2026, 3, 21); // 21/4/2026
const STORAGE_KEY = 'studyPlanStateV6';
const LEGACY_KEY = 'fullPlanProgress';

/* تحويل بيانات الأسابيع إلى قائمة واحدة مرتبة مع ربط كل مهمة بتاريخها الأساسي */
const basePlan = studyWeeks.flatMap((week, weekIndex) =>
    week.tasks.map((item, idx) => {
        const scheduleDate = addDays(BASE_DATE, weekIndex * 7 + idx);
        return {
            ...item,
            weekTitle: week.title,
            weekIndex,
            dayIndex: idx,
            baseId: `task-${String(weekIndex + 1).padStart(2, '0')}-${String(idx + 1).padStart(2, '0')}`,
            scheduleDate,
            dateKey: toDateKey(scheduleDate),
        };
    })
);

/* تحويل المخطط الإضافي أسفل الأسبوع السادس إلى قائمة مهام قابلة للتتبع */
const specialBasePlan = Array.isArray(specialJourney)
    ? specialJourney.flatMap((month, monthIndex) =>
        (month.phases || []).flatMap((phase, phaseIndex) =>
            (phase.tasks || []).map((item, taskIndex) => {
                const dateText = String(item.date || '').trim();
                const scheduleDate = parseLooseDate(dateText);
                return {
                    ...item,
                    monthTitle: month.title,
                    monthSubtitle: month.subtitle,
                    phaseTitle: phase.title,
                    monthIndex,
                    phaseIndex,
                    taskIndex,
                    displayDate: dateText,
                    dateKey: scheduleDate ? toDateKey(scheduleDate) : null,
                    scheduleDate: scheduleDate || null,
                    baseId: `special-${String(monthIndex + 1).padStart(2, '0')}-${String(phaseIndex + 1).padStart(2, '0')}-${String(taskIndex + 1).padStart(2, '0')}`
                };
            })
        )
    )
    : [];

/* بعض المهام تحتوي على جزأين: المهمة الأساسية + جزء إنجليزي بعد علامة + En */
function splitTaskText(text) {
    const raw = String(text || '').trim();
    if (!raw) return [];

    const match = raw.match(/^(.*?)(?:\s*\+\s*En\s*:?\s*)(.+)$/i);
    if (!match) return [raw];

    const first = match[1].trim();
    const second = match[2].trim();
    if (!first || !second) return [raw];

    return [first, second];
}

/* تفكيك المهمة الواحدة إلى مهمة أو أكثر عند وجود أكثر من جزء */
const fullPlan = [...basePlan, ...specialBasePlan].flatMap((item) => {
    const parts = splitTaskText(item.t);

    return parts.map((partText, partIndex) => ({
        ...item,
        type: partIndex === 1 ? 'eng' : item.type,
        /*type: item.type,*/
        sourceId: item.baseId,
        partIndex,
        partsCount: parts.length,
        id: parts.length === 1 ? item.baseId : `${item.baseId}-${partIndex + 1}`,
        t: partText,
        parentText: item.t,
        partLabel: parts.length > 1 ? `جزء ${partIndex + 1} من ${parts.length}` : null,
    }));
});

const specialJourneyPlan = Array.isArray(specialJourney)
    ? specialJourney.map((month, monthIndex) => ({
        ...month,
        monthIndex,
        phases: (month.phases || []).map((phase, phaseIndex) => ({
            ...phase,
            phaseIndex,
            tasks: (phase.tasks || []).map((task, taskIndex) => {
                const base = specialBasePlan.find(item => item.monthIndex === monthIndex && item.phaseIndex === phaseIndex && item.taskIndex === taskIndex);
                return base || {
                    ...task,
                    monthTitle: month.title,
                    monthSubtitle: month.subtitle,
                    phaseTitle: phase.title,
                    monthIndex,
                    phaseIndex,
                    taskIndex,
                    displayDate: task.date,
                    dateKey: null,
                    scheduleDate: null,
                    baseId: `special-${String(monthIndex + 1).padStart(2, '0')}-${String(phaseIndex + 1).padStart(2, '0')}-${String(taskIndex + 1).padStart(2, '0')}`,
                };
            }),
        })),
    }))
    : [];
/* العدّ التنازلي للامتحانات النهائية */
const exams = [
    { id: 'chem', name: 'الكيمياء', dateText: '2/7/2026 الساعة 6:00 صباحًا', target: new Date(2026, 6, 2, 6, 0, 0) },
    { id: 'phys', name: 'الفيزياء', dateText: '9/7/2026 الساعة 6:00 صباحًا', target: new Date(2026, 6, 9, 6, 0, 0) },
    { id: 'bio', name: 'الأحياء', dateText: '16/7/2026 الساعة 6:00 صباحًا', target: new Date(2026, 6, 16, 6, 0, 0) },
    { id: 'eng', name: 'الإنجليزي', dateText: '5/7/2026 الساعة 6:00 صباحًا', target: new Date(2026, 6, 5, 6, 0, 0) },
];

/* عناصر الواجهة التي سيتم التحديث عليها مباشرة */
const listContainer = document.getElementById('taskList');
const countdownGrid = document.getElementById('countdownGrid');
const fill = document.getElementById('bar-fill');
const percentText = document.getElementById('percent-val');
const stickyHeader = document.querySelector('.sticky-header');
const progressSection = document.querySelector('.progress-section');
const progressBarBg = document.querySelector('.bar-bg');
const motivationBanner = document.getElementById('motivationBanner');
const todayTaskBox = document.getElementById('todayTask');
const filterButtons = document.getElementById('filterButtons');
const resetBtn = document.getElementById('resetBtn');
const specialScheduleWrap = document.getElementById('specialScheduleWrap');
let specialProgressFill = null;
let specialProgressText = null;

/* الحالة المحفوظة في المتصفح: ترتيب المهام وما تم إنجازه */
const state = loadState();
let draggedId = null;
let currentFilter = 'all';
let lastDateKey = toDateKey(new Date());
let lastMonthKey = getMonthKey(new Date());
let quickNextButton = null;

/* رسائل تحفيزية تظهر أعلى الصفحة */
const motivationQuotes = [
    'طب وحاسبات ومعلومات يخويا ؟',
    'عشان اهلك ونفسك ياخي 🙁',
    'كل مر سيمر ان شاء الله 💖',
    'طب بلله عليك راضي عن الهباب دا',
    'فوق يطيب الموضوع مش سهل',
    'صاحب الهمه لا يعجز حتي يتم المهمه 💪',
    'استعن بالله ولا تعجز',
    'Its Not Over Until I Win',
    'Be Man',
];

/* أدوات صغيرة لمعالجة التواريخ والتنسيق */
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseDateKey(key) {
    if (!key || typeof key !== 'string') return null;
    const [y, m, d] = key.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}

function parseLooseDate(text) {
    const raw = String(text || '').trim();
    const match = raw.match(/(\d{1,2})\/(\d{1,2})/);
    if (!match) return null;
    const month = Number(match[1]);
    const day = Number(match[2]);
    if (!month || !day) return null;
    return new Date(2026, month - 1, day);
}

function formatTaskText(task) {
    return `${task?.d || task?.displayDate || ''} — ${task?.t || ''}`.trim();
}

function escapeHTML(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

/* قراءة الحالة من localStorage مع دعم النسخ القديمة */
function loadState() {
    const defaultState = { order: fullPlan.map(item => item.id), done: {} };

    const normalizeDone = (savedDone) => {
        const done = {};
        if (!savedDone || typeof savedDone !== 'object') return done;

        // لو كانت النسخة القديمة تخزن المهمة كاملة، نوزع حالة الإنجاز على الأجزاء الجديدة
    const expandedBySource = new Map();
        fullPlan.forEach(task => {
            const source = task.sourceId || getTaskId(task);
            if (!expandedBySource.has(source)) expandedBySource.set(source, []);
            expandedBySource.get(source).push(task.id);
        });

        for (const [taskId, value] of Object.entries(savedDone)) {
            if (!value || typeof value !== 'object') continue;

            if (fullPlan.some(task => task.id === taskId)) {
                done[taskId] = value;
                continue;
            }

            const mappedIds = expandedBySource.get(taskId);
            if (mappedIds && mappedIds.length) {
                mappedIds.forEach(mappedId => {
                    done[mappedId] = value;
                });
            }
        }

        return done;
    };

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultState;
        const parsed = JSON.parse(raw);
        const savedDone = normalizeDone(parsed?.done);
        // نحتفظ فقط بالمعرفات الموجودة حاليًا في الخطة
    const savedOrder = Array.isArray(parsed?.order) ? parsed.order.filter(id => fullPlan.some(task => task.id === id)) : [];
        const missing = defaultState.order.filter(id => !savedOrder.includes(id));
        return {
            order: savedOrder.length ? [...savedOrder, ...missing] : defaultState.order,
            done: savedDone,
        };
    } catch {
        try {
            const rawLegacy = localStorage.getItem(LEGACY_KEY);
            if (rawLegacy) {
                const parsedLegacy = JSON.parse(rawLegacy);
                const legacyDone = normalizeDone(parsedLegacy?.done || parsedLegacy);
                return { order: defaultState.order, done: legacyDone };
            }
        } catch {}

        return defaultState;
    }
}
function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Error saving state:', e);
    }
}
/* أدوات معرفة حالة المهمة وترتيبها */
function isTaskDone(taskId) {
    return Boolean(state.done[taskId]?.completed);
}

function getTaskCompletionDateKey(taskId) {
    const task = fullPlan.find(t => t.id === taskId);
    return state.done[taskId]?.completedDate || task?.dateKey || null;
}

function orderedTasks() {
    const map = new Map(fullPlan.map(task => [task.id, task]));
    return state.order.map(id => map.get(id)).filter(Boolean);
}

function getTagLabel(type) {
    const labels = { 
    chem: 'كيمياء', 
    phys: 'فيزياء', 
    bio: 'أحياء', 
    rev: 'مراجعة', 
    sol: 'حل',
    eng: 'إنجليزي'  
};
    return labels[type] || 'مهمة';
}

function getTaskTags(task) {
    const tags = [];
    const addTag = (label, className) => {
        if (!label || tags.some(tag => tag.label === label)) return;
        tags.push({ label, className });
    };

    addTag(getTagLabel(task.type), `tag-${task.type || 'rev'}`);

    const text = `${task?.t || ''} ${task?.parentText || ''}`;
    if (/يوم\s*امتحان/i.test(text)) addTag('الامتحان', 'tag-exam');
    if (task.type === 'sol' || /حل|شوامل|شاملة|شامل|عموما/i.test(text)) addTag('حل', 'tag-sol');

    return tags;
}

function renderTagChips(task) {
    return getTaskTags(task)
        .map(tag => `<span class="tag ${escapeHTML(tag.className)}">${escapeHTML(tag.label)}</span>`)
        .join('');
}

function getTaskId(task) {
    return task?.id || task?.baseId || null;
}

function getDoneCount() {
    return fullPlan.reduce((count, task) => count + (isTaskDone(getTaskId(task)) ? 1 : 0), 0);
}

/* شريط التقدم أعلى الصفحة */
function updateProgress(shouldAnimate) {
    const total = fullPlan.length;
    const doneCount = getDoneCount();
    const percentage = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    fill.style.width = percentage + '%';
    percentText.innerText = percentage + '%';

    if (shouldAnimate) {
        fill.classList.remove('pulse-animation');
        void fill.offsetWidth;
        fill.classList.add('pulse-animation');
    }
}

/* تحريك المهمة لأعلى أو لأسفل */
function moveTask(taskId, direction) {
    const index = state.order.indexOf(taskId);
    if (index === -1) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= state.order.length) return;

    const nextOrder = [...state.order];
    [nextOrder[index], nextOrder[newIndex]] = [nextOrder[newIndex], nextOrder[index]];
    state.order = nextOrder;
    saveState();
    renderAll(true);
}

/* تسجيل إنجاز المهمة في الحالة المحفوظة */
function setDone(taskId) {
    if (isTaskDone(taskId)) return false;

    const currentOpenWeek = document.querySelector('.week-section[open]');
    const openDays = [...document.querySelectorAll('.day-accordion[open]')];
    const scrollYBefore = window.scrollY;

    state.done[taskId] = {
        completed: true,
        completedDate: toDateKey(new Date()),
        completedAt: new Date().toISOString(),
    };

    saveState();
    playSuccessAnimation();

    try {
        renderAll(true);
    } catch (err) {
        console.error('renderAll failed after marking task done:', err);
    }

    requestAnimationFrame(() => {
        if (currentOpenWeek) {
            const index = currentOpenWeek.dataset.weekIndex;
            const newWeek = document.querySelector(`.week-section[data-week-index="${index}"]`);
            if (newWeek) newWeek.open = true;
        }

        openDays.forEach(day => {
            const key = day.dataset.dayKey;
            const newDay = document.querySelector(`.day-accordion[data-day-key="${key}"]`);
            if (newDay) newDay.open = true;
        });

        requestAnimationFrame(() => {
            window.scrollTo({ top: scrollYBefore, behavior: 'auto' });
        });
    });

    return true;
 }

/* حساب عدد الأيام المتتالية التي تم فيها إنجاز مهام */
function getDoneDateKeys() {
  const tasks = JSON.parse(localStorage.getItem("tasks")) || [];

  return [...new Set(
    tasks
      .filter(task => task.completed && task.doneDate)
      .map(task => task.doneDate)
  )].sort();
}
function calculateStreak() {
    const keys = getDoneDateKeys();
    if (!keys.length) return 0;

    let streak = 1;
    let cursor = parseDateKey(keys[keys.length - 1]);

    for (let i = keys.length - 2; i >= 0; i--) {
        const previous = parseDateKey(keys[i]);
        if (!cursor || !previous) break;

        const diffDays = Math.round((cursor - previous) / 86400000);
        if (diffDays === 1) {
            streak += 1;
            cursor = previous;
        } else if (diffDays === 0) {
            cursor = previous;
        } else {
            break;
        }
    }

    return streak;
}

/* معرفة أكثر مادة أنجزت منها مهام */
function getTopSubject() {
    // العدّ لكل مادة لمعرفة الأعلى إنجازًا
    const counts = { phys: 0, chem: 0, bio: 0, sol: 0 };
    fullPlan.forEach(task => {
        if (isTaskDone(getTaskId(task))) counts[task.type] = (counts[task.type] || 0) + 1;
    });

    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top && top[1] > 0 ? getTagLabel(top[0]) : '—';
}

/* مستوى الطالب يعتمد على عدد المهام المنجزة */
function getLevelInfo() {
    const doneCount = getDoneCount();
    const level = Math.floor(doneCount / 5) + 1;
    const progress = doneCount % 5;
    const nextAt = level * 5;
    return { level, progress, nextAt, doneCount };
}

/* إيجاد أقرب مهمة غير منجزة */
function getNextTask() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // نبحث عن أول مهمة لم تُنجز وما زال موعدها قادمًا
    const remaining = orderedTasks().filter(task => !isTaskDone(getTaskId(task)));
    if (!remaining.length) return null;

    const scheduledTodayOrLater = remaining.find(task => task.scheduleDate.getTime() >= today.getTime());
    return scheduledTodayOrLater || remaining[0];
}

/* تحديث صندوق "المهمة التالية" أعلى الصفحة */
function updateTodayTask() {
    const next = getNextTask();
    if (!next) {
        todayTaskBox.innerHTML = '<span class="week-badge current">مكتمل</span> فركش يا ايها الدولي 🎉🎉';
        return;
    }

    const today = toDateKey(new Date());
    const label = next.dateKey === today && !isTaskDone(next.id) ? 'اليوم الحالي' : 'المهمة التالية';
    const accent = next.dateKey === today ? 'current' : '';
    todayTaskBox.innerHTML = `<span class="week-badge ${accent}">${label}</span> ${escapeHTML(formatTaskText(next))}`;
}

/* الإنجازات التي تظهر حسب التقدم */
function updateAchievements() {
    const doneCount = getDoneCount();
    const streak = calculateStreak();
    const { level } = getLevelInfo();
    const achievements = [];

    if (doneCount >= 1) achievements.push('لسه في حماس البدايات');
    if (doneCount >= 10) achievements.push('يادوبك');
    if (doneCount >= 25) achievements.push('يسيدي ماشي ');
    if (doneCount >= fullPlan.length / 2) achievements.push('عديت نص كمل الباقي ');
    if (streak >= 3) achievements.push('ولد عادي');
    if (streak >= 7) achievements.push('ولد كبير شويه');
    if (level >= 3) achievements.push(`مستوى ${level}`);
    if (doneCount === fullPlan.length) achievements.push('فركش يا دولي');

    const box = document.getElementById('achievementsList');
    box.innerHTML = achievements.map(a => `<span class="achievement-badge">${escapeHTML(a)}</span>`).join('') || '<span class="achievement-badge">ابدأ أول مهمة ✨</span>';
}

/* تقويم الشهر الحالي مع تمييز الأيام المنجزة */
function renderCalendar() {
    const wrap = document.getElementById('calendarDays');
    wrap.innerHTML = '';

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const completedDates = new Set(getDoneDateKeys().filter(key => key.startsWith(getMonthKey(now))));
    const todayKey = toDateKey(now);

    for (let i = 1; i <= lastDay; i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day';
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        if (completedDates.has(key)) day.classList.add('done');
        if (key === todayKey) day.classList.add('today');
        day.textContent = i;
        wrap.appendChild(day);
    }
}

/* تحديث أرقام لوحة التحكم */
function updateDashboard() {
    const streak = calculateStreak();
    const doneCount = getDoneCount();
    const { level } = getLevelInfo();

    document.getElementById('streakCount').textContent = streak;
    document.getElementById('completedCount').textContent = doneCount;
    document.getElementById('levelCount').textContent = `Lv ${level}`;
    document.getElementById('subjectCount').textContent = getTopSubject();

    updateTodayTask();
    updateAchievements();
    renderCalendar();
    updateProgress(false);
}

/* فلترة المهام حسب المنجز أو المتبقي */
function applyFilter(nextFilter) {
    currentFilter = nextFilter;
    filterButtons.querySelectorAll('button').forEach(button => {
        button.classList.toggle('active', button.dataset.filter === currentFilter);
    });
    renderTasks();
}

/* إرجاع المهام بعد تطبيق الفلتر الحالي */
function getFilteredTasks(tasks) {
    if (currentFilter === 'done') return tasks.filter(task => isTaskDone(getTaskId(task)));
    if (currentFilter === 'pending') return tasks.filter(task => !isTaskDone(getTaskId(task)));
    return tasks;
}

/* إنشاء بطاقة المهمة الرئيسية القابلة للسحب والترتيب */
function buildTaskCard(item, index, arr, isCurrentWeek) {
    const done = isTaskDone(item.id);
    const isToday = item.dateKey === toDateKey(new Date());
    const card = document.createElement('div');
    card.className = `day-card ${done ? 'done' : ''} ${isToday ? 'current-day' : ''}`.trim();
    // البطاقة نفسها تدعم النقر، والسحب، وأزرار الترتيب
    card.draggable = true;
    card.dataset.id = item.id;

    card.innerHTML = `
        <div class="check-container"><input type="checkbox" ${done ? 'checked disabled' : ''} aria-label="حدد المهمة"></div>
        <div class="content">
            <div class="date">
                ${escapeHTML(item.d)}
                ${isToday ? '<span class="today-badge"> اليوم الي احنا فيه</span>' : ''}
                ${isCurrentWeek ? '<span class="week-badge current">الأسبوع الي احنا فين</span>' : ''}
            </div>
            <div class="task">${escapeHTML(item.t)}</div>
        </div>
        <div class="side-column">
            <span class="tag tag-${item.type}">${escapeHTML(getTagLabel(item.type))}</span>
            <div class="reorder-controls">
                <button class="move-btn up" type="button" ${index === 0 ? 'disabled' : ''} aria-label="حرك لفوق">▲</button>
                <button class="move-btn down" type="button" ${index === arr.length - 1 ? 'disabled' : ''} aria-label="حرك لتحت">▼</button>
            </div>
            <div class="drag-handle" title="اسحب عشان تغير">⋮⋮</div>
        </div>
    `;

    const checkbox = card.querySelector('input[type="checkbox"]');
    const btnUp = card.querySelector('.move-btn.up');
    const btnDown = card.querySelector('.move-btn.down');

    checkbox.addEventListener('click', e => e.stopPropagation());
    checkbox.addEventListener('change', () => { if (!isTaskDone(item.id)) setDone(item.id); });
    btnUp.addEventListener('click', e => { e.stopPropagation(); moveTask(item.id, -1); });
    btnDown.addEventListener('click', e => { e.stopPropagation(); moveTask(item.id, 1); });

    card.addEventListener('click', e => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        setDone(item.id);
    });

    card.addEventListener('dragstart', () => { draggedId = item.id; card.classList.add('dragging'); });
    card.addEventListener('dragend', () => {
        draggedId = null;
        card.classList.remove('dragging');
        document.querySelectorAll('.day-card.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => { card.classList.remove('drag-over'); });
    card.addEventListener('drop', e => {
        e.preventDefault();
        card.classList.remove('drag-over');
        if (!draggedId || draggedId === item.id) return;
        const nextOrder = state.order.filter(id => id !== draggedId);
        const targetIndex = nextOrder.indexOf(item.id);
        nextOrder.splice(targetIndex, 0, draggedId);
        state.order = nextOrder;
        saveState();
        renderAll(true);
    });

    return card;
}

/* رسم قائمة المهام حسب ترتيبها الحالي */
function renderTasks() {
    listContainer.innerHTML = '';
    const todayKey = toDateKey(new Date());
    const allOrdered = orderedTasks();

    studyWeeks.forEach((week, weekIndex) => {
        const weekTasksOrdered = allOrdered.filter(task => task.weekIndex === weekIndex);
        const section = buildWeekAccordion(week, weekIndex, weekTasksOrdered, todayKey);
        if (section) listContainer.appendChild(section);
    });

    renderSpecialSchedule();
}

/* تنسيق الأرقام في العد التنازلي */
function pad2(value) {
    return String(value).padStart(2, '0');
}

function formatCountdown(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    return {
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
    };
}

/* إنشاء بطاقات العد التنازلي للامتحانات */
function renderCountdown() {
    countdownGrid.innerHTML = '';
    exams.forEach(exam => {
        const card = document.createElement('div');
        card.className = `exam-card ${exam.id}`;
        card.innerHTML = `
            <div class="exam-meta">
                <div class="exam-line"> المتبقي علي حرب <span class="exam-subject ${exam.id}">${escapeHTML(exam.name)}</span></div>
                <div class="exam-date">${escapeHTML(exam.dateText)}</div>
            </div>
            <div class="countdown-box">
                <div class="time-unit" data-unit="days"><span class="time-value" data-slot="days">00</span><span class="time-label">يوم</span></div>
                <div class="time-unit" data-unit="hours"><span class="time-value" data-slot="hours">00</span><span class="time-label">س</span></div>
                <div class="time-unit" data-unit="minutes"><span class="time-value" data-slot="minutes">00</span><span class="time-label">د</span></div>
                <div class="time-unit" data-unit="seconds"><span class="time-value" data-slot="seconds">00</span><span class="time-label">ث</span></div>
            </div>
        `;
        countdownGrid.appendChild(card);
        exam.node = {
            days: card.querySelector('[data-slot="days"]'),
            hours: card.querySelector('[data-slot="hours"]'),
            minutes: card.querySelector('[data-slot="minutes"]'),
            seconds: card.querySelector('[data-slot="seconds"]'),
        };
    });
}

function buildSpecialTaskCard(task) {
    const done = isTaskDone(getTaskId(task));
    const isToday = task.dateKey === toDateKey(new Date());
    const card = document.createElement('article');
    card.className = `special-task-card ${done ? 'done' : ''} ${isToday ? 'current-day' : ''}`.trim();
    card.dataset.id = getTaskId(task);
    card.tabIndex = 0;

    card.innerHTML = `
        <div class="special-task-top">
            <div class="special-task-date">
                <span class="special-date-chip">${escapeHTML(task.displayDate || task.d || '')}</span>
                <span class="special-day-chip">${escapeHTML(task.day || '')}</span>
            </div>
            <div class="special-task-tags">${renderTagChips(task)}</div>
        </div>
        <div class="special-task-body">${escapeHTML(task.t)}</div>
        <div class="special-task-foot">${done ? 'تمّت المهمة' : 'اضغط للتأكيد'}</div>
    `;

    card.addEventListener('click', () => {
        setDone(getTaskId(task));
    });

    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDone(getTaskId(task));
        }
    });

    return card;
}

function buildPhaseAccordion(phase, tasks, todayKey) {
    const visibleTasks = getFilteredTasks(tasks);
    if (visibleTasks.length === 0) return null;

    const doneCount = tasks.filter(task => isTaskDone(getTaskId(task))).length;
    const totalCount = tasks.length;
    const phaseCurrent = tasks.some(task => task.dateKey && task.dateKey === todayKey);
    const phaseDone = totalCount > 0 && tasks.every(task => isTaskDone(getTaskId(task)));

    const phaseEl = document.createElement('details');
    phaseEl.className = `phase-accordion ${phaseDone ? 'done' : ''} ${phaseCurrent ? 'current-day' : ''}`.trim();
    phaseEl.open = phase.phaseIndex === 0;

    phaseEl.innerHTML = `
        <summary class="phase-summary">
            <div class="phase-summary-left">
                <span class="accordion-arrow" aria-hidden="true">↓</span>
                <div class="phase-summary-text">
                    <div class="phase-title">${escapeHTML(phase.title)}</div>
                    <div class="phase-meta">
                        <span class="phase-count">${doneCount}/${totalCount}</span>
                        ${phaseCurrent ? '<span class="week-badge current">اليوم الحالي</span>' : ''}
                    </div>
                </div>
            </div>
            <div class="phase-state">${phaseDone ? 'مقفولة' : 'لسه شغالة'}</div>
        </summary>
        <div class="phase-body"></div>
    `;

    const body = phaseEl.querySelector('.phase-body');
    visibleTasks.forEach(task => body.appendChild(buildSpecialTaskCard(task)));

    return phaseEl;
}

function updateSpecialProgress() {
    const total = specialBasePlan.length;
    const doneCount = specialBasePlan.reduce((count, task) => count + (isTaskDone(task.baseId) ? 1 : 0), 0);
    const percentage = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    if (specialProgressFill) specialProgressFill.style.width = `${percentage}%`;
    if (specialProgressText) specialProgressText.textContent = `${percentage}%`;
}

function renderSpecialSchedule() {
    if (!specialScheduleWrap) return;
    specialScheduleWrap.innerHTML = '';

    if (!specialJourneyPlan.length) return;

    const todayKey = toDateKey(new Date());
    const month = specialJourneyPlan[0];
    const monthTasks = month.phases.flatMap(phase => phase.tasks);
    const doneCount = monthTasks.filter(task => isTaskDone(getTaskId(task))).length;
    const totalCount = monthTasks.length;
    const monthDone = totalCount > 0 && monthTasks.every(task => isTaskDone(getTaskId(task)));

    const monthEl = document.createElement('details');
    monthEl.className = `special-month-section ${monthDone ? 'done' : ''}`.trim();
    monthEl.open = true;

    monthEl.innerHTML = `
        <summary class="special-month-header">
            <div class="special-month-header-left">
                <span class="accordion-arrow" aria-hidden="true">↓</span>
                <div class="special-month-copy">
                    <div class="special-month-title">${escapeHTML(month.title)}</div>
                    <div class="special-month-subtitle">${escapeHTML(month.subtitle || '')}</div>
                </div>
            </div>
            <div class="special-month-status">${doneCount}/${totalCount} مهمة</div>
        </summary>
        <div class="special-month-body">
            <div class="special-progress-card">
                <div class="special-progress-row">
                    <span>تقدم المرحلة الجديدة</span>
                    <span class="special-progress-percent">0%</span>
                </div>
                <div class="special-bar-bg"><div class="special-bar-fill"></div></div>
            </div>
            <div class="special-phases"></div>
        </div>
    `;

    specialProgressFill = monthEl.querySelector('.special-bar-fill');
    specialProgressText = monthEl.querySelector('.special-progress-percent');
    const phaseWrap = monthEl.querySelector('.special-phases');

    month.phases.forEach(phase => {
        const phaseEl = buildPhaseAccordion(phase, phase.tasks, todayKey);
        if (phaseEl) phaseWrap.appendChild(phaseEl);
    });

    specialScheduleWrap.appendChild(monthEl);
    updateSpecialProgress();
}

/* تحديث العد التنازلي كل ثانية */
function updateCountdown() {
    const now = new Date();
    exams.forEach(exam => {
        const diff = exam.target.getTime() - now.getTime();
        const node = exam.node;
        if (!node) return;

        if (diff <= 0) {
            node.days.textContent = '00';
            node.hours.textContent = '00';
            node.minutes.textContent = '00';
            node.seconds.textContent = '00';
            return;
        }

        const { days, hours, minutes, seconds } = formatCountdown(diff);
        node.days.textContent = pad2(days);
        node.hours.textContent = pad2(hours);
        node.minutes.textContent = pad2(minutes);
        node.seconds.textContent = pad2(seconds);
    });
}

/* تغيير الرسالة التحفيزية بشكل عشوائي */
function updateMotivation() {
    motivationBanner.textContent = motivationQuotes[Math.floor(Math.random() * motivationQuotes.length)];
}

/* تبديل الثيمات عبر متغيرات CSS */

function setTheme() {
    const root = document.documentElement;
    const values = {
        '--bg': '#f4efe8',
        '--bg-gradient': '#fffaf5',
        '--card-bg': '#ffffff',
        '--glass': 'rgba(255, 255, 255, 0.72)',
        '--text-main': '#1f2937',
        '--text-dim': '#64748b',
        '--accent': '#7c3aed',
        '--success': '#10b981',
        '--chem-color': '#c2410c',
        '--phys-color': '#ca8a04',
        '--bio-color': '#0f766e',
        '--rev-color': '#6d28d9',
        '--sol-color': '#ef4444',
        '--line': '#e5ddd3',
    };

    Object.entries(values).forEach(([key, value]) => root.style.setProperty(key, value));
}

/* إعادة الرسم إذا تغيّر اليوم أو الشهر */
function updateDateSensitiveUI() {
    const now = new Date();
    const dateKey = toDateKey(now);
    const monthKey = getMonthKey(now);
    const changedDay = dateKey !== lastDateKey;
    const changedMonth = monthKey !== lastMonthKey;

    if (changedDay || changedMonth) {
        // عند انتقال اليوم أو الشهر نعيد رسم الواجهة حتى تبقى البيانات صحيحة
        lastDateKey = dateKey;
        lastMonthKey = monthKey;
        renderTasks();
        updateDashboard();
    }
}

/* إعادة رسم كل أجزاء الواجهة دفعة واحدة */
function renderAll(animateProgress = false) {
    renderTasks();
    renderCountdown();
    updateDashboard();
    updateProgress(animateProgress);
    updateCountdown();
    refreshQuickNextButton();
}


filterButtons.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-filter]');
    if (!button) return;
    applyFilter(button.dataset.filter);
});

resetBtn.addEventListener('click', () => {
    const confirmed = window.confirm('كده هتدشمل الدنيا من اول وجديد متأكد ؟');
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
    location.reload();
});

/* تشغيل الواجهة بعد تحميلها أول مرة */
setTheme();
updateMotivation();
applyFilter('all');
renderAll(false);
updateCountdown();

setInterval(updateCountdown, 1000);
setInterval(updateDateSensitiveUI, 60000);
window.addEventListener('focus', updateDateSensitiveUI);

refreshQuickNextButton();

/* دوال خاصة بالتنقل إلى مكان المهمة داخل الأقسام القابلة للطي */
function openTaskLocation(taskId) {
    const taskEl = document.querySelector(`.subtask-card[data-id="${taskId}"], .special-task-card[data-id="${taskId}"]`);
    if (!taskEl) return null;

    const dayEl = taskEl.closest('.day-accordion');
    const weekEl = taskEl.closest('.week-section');
    const phaseEl = taskEl.closest('.phase-accordion');
    const monthEl = taskEl.closest('.special-month-section');

    if (weekEl) weekEl.open = true;
    if (dayEl) dayEl.open = true;
    if (monthEl) monthEl.open = true;
    if (phaseEl) phaseEl.open = true;

    return dayEl || phaseEl || taskEl;
}

/* بطاقة فرعية بعد تقسيم المهمة إلى أجزاء */
function buildSubTaskCard(item) {
    const done = isTaskDone(item.id);
    const isToday = item.dateKey === toDateKey(new Date());

    const card = document.createElement('div');
    card.className = `subtask-card ${done ? 'done' : ''} ${isToday ? 'current-day' : ''}`.trim();
    card.dataset.id = item.id;

    card.innerHTML = `
        <label class="subtask-check">
            <input type="checkbox" ${done ? 'checked disabled' : ''} aria-label="تحديد المهمة">
            <span class="subtask-check-label">${done ? 'دن يا ريس' : 'هتتحدد كمكتملة'}</span>
        </label>
        <div class="subtask-main">
            <div class="subtask-head">
                <div class="subtask-tags">${renderTagChips(item)}</div>
                ${item.partLabel ? `<span class="part-pill">${escapeHTML(item.partLabel)}</span>` : ''}
            </div>
            <div class="subtask-text">${escapeHTML(item.t)}</div>
        </div>
    `;

    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('click', e => e.stopPropagation());
    checkbox.addEventListener('change', () => {
        if (!isTaskDone(item.id)) setDone(item.id);
    });

    card.addEventListener('click', e => {
        if (e.target.closest('input')) return;
        setDone(item.id);
    });

    return card;
}

/* تجميع المهام حسب اليوم داخل نفس الأسبوع */
function groupTasksByDay(tasks) {
    const groups = [];
    const map = new Map();

    tasks.forEach(task => {
        const key = `${task.weekIndex}-${task.dayIndex}`;
        if (!map.has(key)) {
            const group = {
                key,
                dayIndex: task.dayIndex,
                dateKey: task.dateKey,
                dateLabel: task.d,
                tasks: [],
            };
            map.set(key, group);
            groups.push(group);
        }
        map.get(key).tasks.push(task);
    });

    return groups;
}

/* إنشاء جزء قابل للطي لكل يوم */
function buildDayAccordion(dayGroup, todayKey) {
    const visibleTasks = getFilteredTasks(dayGroup.tasks);
    if (visibleTasks.length === 0) return null;

    const doneCount = dayGroup.tasks.filter(task => isTaskDone(getTaskId(task))).length;
    const totalCount = dayGroup.tasks.length;
    const isDayCurrent = dayGroup.tasks.some(task => task.dateKey === todayKey);
    const isDayDone = totalCount > 0 && dayGroup.tasks.every(task => isTaskDone(getTaskId(task)));

    const day = document.createElement('details');
    day.className = `day-accordion ${isDayDone ? 'done' : ''} ${isDayCurrent ? 'current-day' : ''}`.trim();
    day.dataset.dayKey = dayGroup.key;

    day.innerHTML = `
        <summary class="day-summary">
            <div class="day-summary-left">
                <span class="accordion-arrow" aria-hidden="true">↓</span>
                <div class="day-summary-text">
                    <div class="day-date">
                        ${escapeHTML(dayGroup.dateLabel)}
                        ${isDayCurrent ? '<span class="today-badge">اليوم الي احنا فيه</span>' : ''}
                    </div>
                    <div class="day-hint">${doneCount}/${totalCount} مهام</div>
                </div>
            </div>
            <div class="day-summary-right">
                <span class="day-state">${isDayDone ? 'دن ياريس' : 'الي باقي'}</span>
            </div>
        </summary>
        <div class="day-body">
            <div class="day-task-list"></div>
        </div>
    `;

    const list = day.querySelector('.day-task-list');
    visibleTasks.forEach(item => list.appendChild(buildSubTaskCard(item)));

    return day;
}

/* إنشاء جزء قابل للطي لكل أسبوع */
function buildWeekAccordion(week, weekIndex, orderedWeekTasks, todayKey) {
    // الفلترة تتم أولًا ثم نعيد التجميع حسب اليوم
    const dayGroups = groupTasksByDay(getFilteredTasks(orderedWeekTasks));
    if (dayGroups.length === 0) return null;

    const weekDoneCount = orderedWeekTasks.filter(task => isTaskDone(getTaskId(task))).length;
    const isWeekCurrent = orderedWeekTasks.some(task => task.dateKey === todayKey);
    const isWeekDone = orderedWeekTasks.length > 0 && orderedWeekTasks.every(task => isTaskDone(getTaskId(task)));

    const section = document.createElement('details');
    section.className = `week-section ${isWeekDone ? 'done' : ''} ${isWeekCurrent ? 'current' : ''}`.trim();
    section.dataset.weekIndex = String(weekIndex);

    section.innerHTML = `
        <summary class="week-header">
            <div class="week-header-left">
                <span class="accordion-arrow" aria-hidden="true">↓</span>
                <div>
                    <div class="week-title">${escapeHTML(week.title)}</div>
                    <div class="week-meta">
                        ${isWeekCurrent ? '<span class="week-badge current">الأسبوع الي احنا فيه</span>' : ''}
                        <span class="week-subtitle">${weekDoneCount}/${orderedWeekTasks.length}</span>
                    </div>
                </div>
            </div>
            <div class="week-status">${isWeekDone ? 'غار ف داهيه' : 'لسه مخلصش'}</div>
        </summary>
        <div class="week-tasks"></div>
    `;

    const wrap = section.querySelector('.week-tasks');
    dayGroups.forEach(group => {
        const day = buildDayAccordion(group, todayKey);
        if (day) wrap.appendChild(day);
    });

    section.addEventListener('toggle', () => {
        if (section.open) {
            document.querySelectorAll('.week-section[open]').forEach(other => {
                if (other !== section) other.removeAttribute('open');
            });
        }
    });

    return section;
}

/* زر سريع للوصول إلى أقرب مهمة غير منجزة */
function refreshQuickNextButton() {
    const hasPending = fullPlan.some(task => !isTaskDone(getTaskId(task)));
    if (!hasPending) {
        if (quickNextButton) {
            quickNextButton.remove();
            quickNextButton = null;
        }
        return;
    }

    if (!quickNextButton) {
        quickNextButton = document.createElement('button');
        quickNextButton.type = 'button';
        quickNextButton.textContent = 'المهمة الحالية';
        quickNextButton.className = 'ghost-btn';
        quickNextButton.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:1500;padding:11px 15px;border-radius:14px;background:rgba(252,248,243,0.94);color:var(--text-main);font-weight:900;cursor:pointer;box-shadow:0 8px 18px rgba(68,49,34,.07);border:1px solid rgba(159,115,80,.16);';
        document.body.appendChild(quickNextButton);
    }

    quickNextButton.onclick = () => {
        const nextTask = getNextTask();
        if (!nextTask) return;

        const target = openTaskLocation(nextTask.id);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }

        applyFilter('all');
        setTimeout(() => {
            const fallback = openTaskLocation(nextTask.id);
            if (fallback) fallback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 0);
    };
}function playSuccessAnimation() {
    const el = document.getElementById('successAnim');
    if (navigator.vibrate) {
        navigator.vibrate([20, 30, 20]);
    }
    if (!el) return;

    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    el.setAttribute('aria-hidden', 'false');

    setTimeout(() => {
        el.classList.remove('show');
        el.setAttribute('aria-hidden', 'true');
    }, 900);
}

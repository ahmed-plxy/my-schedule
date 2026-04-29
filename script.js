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
const fullPlan = basePlan.flatMap((item) => {
    const parts = splitTaskText(item.t);

    return parts.map((partText, partIndex) => ({
        ...item,
        type: partIndex === 1 ? 'eng' : item.type,
        /*type: item.type,*/
        sourceId: item.baseId,
        sourceId: item.baseId,
        partIndex,
        partsCount: parts.length,
        id: parts.length === 1 ? item.baseId : `${item.baseId}-${partIndex + 1}`,
        t: partText,
        parentText: item.t,
        partLabel: parts.length > 1 ? `جزء ${partIndex + 1} من ${parts.length}` : null,
    }));
});
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
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmTaskText = document.getElementById('confirmTaskText');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');
const motivationBanner = document.getElementById('motivationBanner');
const todayTaskBox = document.getElementById('todayTask');
const filterButtons = document.getElementById('filterButtons');
const resetBtn = document.getElementById('resetBtn');

/* الحالة المحفوظة في المتصفح: ترتيب المهام وما تم إنجازه */
const state = loadState();
let draggedId = null;
let pendingTaskId = null;
let pendingCheckbox = null;
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

function formatTaskText(task) {
    return `${task?.d || ''} — ${task?.t || ''}`.trim();
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
            const source = task.sourceId || task.id;
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

function getDoneCount() {
    return fullPlan.reduce((count, task) => count + (isTaskDone(task.id) ? 1 : 0), 0);
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

/* فتح نافذة التأكيد قبل اعتبار المهمة منجزة */
function openConfirm(taskId, checkboxEl) {
    if (isTaskDone(taskId)) {
        if (checkboxEl) checkboxEl.checked = true;
        return;
    }

    const task = fullPlan.find(t => t.id === taskId);
    pendingTaskId = taskId;
    pendingCheckbox = checkboxEl || null;
    confirmTaskText.textContent = formatTaskText(task);
    confirmOverlay.classList.add('show');
    confirmOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}

function closeConfirm(resetCheckbox = false) {
    if (resetCheckbox && pendingCheckbox) pendingCheckbox.checked = false;
    pendingTaskId = null;
    pendingCheckbox = null;
    confirmOverlay.classList.remove('show');
    confirmOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
}

/* تسجيل إنجاز المهمة في الحالة المحفوظة */
function setDone(taskId) {
    if (isTaskDone(taskId)) return false;

    // 🟢 حفظ مكانك + التاسك نفسه
    const currentOpenWeek = document.querySelector('.week-section[open]');
    const currentOpenDay = document.querySelector('.day-accordion[open]');
    const scrollY = window.scrollY;

    // تسجيل إنجاز المهمة
    state.done[taskId] = {
        completed: true,
        completedDate: toDateKey(new Date()),
        completedAt: new Date().toISOString(),
    };

    saveState();
    playSuccessAnimation();
    // إعادة رسم
    renderAll(true);

    // 🟢 رجوع ذكي لنفس التاسك
    setTimeout(() => {

        // رجّع الأسبوع
        if (currentOpenWeek) {
            const index = currentOpenWeek.dataset.weekIndex;
            const newWeek = document.querySelector(`.week-section[data-week-index="${index}"]`);
            if (newWeek) newWeek.open = true;
        }

        // رجّع اليوم
        if (currentOpenDay) {
            const key = currentOpenDay.dataset.dayKey;
            const newDay = document.querySelector(`.day-accordion[data-day-key="${key}"]`);
            if (newDay) newDay.open = true;
        }

        // 🎯 ركّز على نفس التاسك
        const taskEl = document.querySelector(`.subtask-card[data-id="${taskId}"]`);

        if (taskEl) {
            taskEl.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            // ✨ Highlight effect
            taskEl.style.transition = "0.3s";
            taskEl.style.boxShadow = "0 0 20px var(--accent)";
            taskEl.style.transform = "scale(1.02)";

            setTimeout(() => {
                taskEl.style.boxShadow = "";
                taskEl.style.transform = "";
            }, 800);

        } else {
            // fallback لو ملقهوش
            window.scrollTo(0, scrollY);
        }

    }, 50);

    return true;
}

function getDoneDateKeys() {
    const keys = new Set();
    fullPlan.forEach(task => {
        if (isTaskDone(task.id)) keys.add(getTaskCompletionDateKey(task.id));
    });
    return [...keys].filter(Boolean).sort();
}

/* حساب عدد الأيام المتتالية التي تم فيها إنجاز مهام */
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
        if (isTaskDone(task.id)) counts[task.type] = (counts[task.type] || 0) + 1;
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
    const remaining = orderedTasks().filter(task => !isTaskDone(task.id));
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
    if (currentFilter === 'done') return tasks.filter(task => isTaskDone(task.id));
    if (currentFilter === 'pending') return tasks.filter(task => !isTaskDone(task.id));
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
    checkbox.addEventListener('change', () => { if (!isTaskDone(item.id)) openConfirm(item.id, checkbox); });
    btnUp.addEventListener('click', e => { e.stopPropagation(); moveTask(item.id, -1); });
    btnDown.addEventListener('click', e => { e.stopPropagation(); moveTask(item.id, 1); });

    card.addEventListener('click', e => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        openConfirm(item.id, checkbox);
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

    studyWeeks.forEach((week, weekIndex) => {
        const weekTasksOrdered = orderedTasks().filter(task => task.weekIndex === weekIndex);
        const section = buildWeekAccordion(week, weekIndex, weekTasksOrdered, todayKey);
        if (section) listContainer.appendChild(section);
    });
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
                <div class="exam-line">الباقي علي الحرب<span class="exam-subject ${exam.id}">${escapeHTML(exam.name)}</span></div>
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
function setTheme(theme) {
    const root = document.documentElement;
    const themes = {
        default: {
            '--bg': '#050505',
            '--bg-gradient': '#111111',
            '--card-bg': '#151515',
            '--glass': 'rgba(10, 10, 10, 0.85)',
            '--text-main': '#ffffff',
            '--text-dim': '#a1a1aa',
            '--accent': '#00f2fe',
            '--success': '#00ff87',
            '--chem-color': '#145dfa',
            '--phys-color': '#d3f800',
            '--bio-color': '#04f89a',
            '--rev-color': '#8b5cf6',
            '--sol-color': '#fa1b1b',
            '--line': '#2a2a2a',
        },
        blue: {
            '--bg': '#040816',
            '--bg-gradient': '#0c1b3a',
            '--card-bg': '#101b33',
            '--glass': 'rgba(5, 10, 25, 0.84)',
            '--text-main': '#f8fbff',
            '--text-dim': '#b6c2e2',
            '--accent': '#60a5fa',
            '--success': '#22d3ee',
            '--chem-color': '#ff0000',
            '--phys-color': '#5afc10',
            '--bio-color': '#00ffd5',
            '--rev-color': '#c084fc',
            '--sol-color': '#ff13b8',
            '--line': '#28406b',
        },
        gold: {
            '--bg': '#120c04',
            '--bg-gradient': '#2b1a06',
            '--card-bg': '#22150b',
            '--glass': 'rgba(20, 12, 4, 0.86)',
            '--text-main': '#fff8ea',
            '--text-dim': '#d8c7a1',
            '--accent': '#f59e0b',
            '--success': '#facc15',
            '--chem-color': '#b0fa04',
            '--phys-color': '#1b62fc',
            '--bio-color': '#4800f0',
            '--rev-color': '#c084fc',
            '--sol-color': '#018313',
            '--line': '#5c4522',
        },
        red: {
            '--bg': '#150404',
            '--bg-gradient': '#3c0c0c',
            '--card-bg': '#260909',
            '--glass': 'rgba(20, 5, 5, 0.86)',
            '--text-main': '#fff6f6',
            '--text-dim': '#e3bbbb',
            '--accent': '#fb7185',
            '--success': '#f97316',
            '--chem-color': '#fc0000',
            '--phys-color': '#2dff25',
            '--bio-color': '#86efac',
            '--rev-color': '#8000ff',
            '--sol-color': '#ee0028',
            '--line': '#5a2020',
        },
        violet: {
            '--bg': '#0d0616',
            '--bg-gradient': '#2a1244',
            '--card-bg': '#181024',
            '--glass': 'rgba(12, 7, 23, 0.86)',
            '--text-main': '#fcf7ff',
            '--text-dim': '#d8c6ee',
            '--accent': '#c084fc',
            '--success': '#a3e635',
            '--chem-color': '#60a5fa',
            '--phys-color': '#fbbf24',
            '--bio-color': '#34d399',
            '--rev-color': '#f472b6',
            '--sol-color': '#fb7185',
            '--line': '#3f2b61',
        },
        forest: {
            '--bg': '#04110b',
            '--bg-gradient': '#10261a',
            '--card-bg': '#0e1c14',
            '--glass': 'rgba(5, 17, 10, 0.86)',
            '--text-main': '#f5fff8',
            '--text-dim': '#bfd4c6',
            '--accent': '#34d399',
            '--success': '#22c55e',
            '--chem-color': '#22c55e',
            '--phys-color': '#fbbf24',
            '--bio-color': '#86efac',
            '--rev-color': '#67e8f9',
            '--sol-color': '#fb7185',
            '--line': '#23402f',
        },
    };

    // اختيار القيم الخاصة بالثيم وتطبيقها على متغيرات CSS
    const values = themes[theme] || themes.default;
    Object.entries(values).forEach(([key, value]) => root.style.setProperty(key, value));
    localStorage.setItem('siteTheme', theme);

    document.querySelectorAll('.theme-buttons button').forEach(button => {
        button.classList.toggle('active', button.dataset.theme === theme);
    });
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

/* أحداث نافذة التأكيد والاختصارات */
confirmOk.addEventListener('click', () => {
    if (!pendingTaskId) return;
    setDone(pendingTaskId);
    closeConfirm(false);
});
confirmCancel.addEventListener('click', () => closeConfirm(true));
confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) closeConfirm(true);
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && confirmOverlay.classList.contains('show')) closeConfirm(true);
});

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
const savedTheme = localStorage.getItem('siteTheme') || 'default';
setTheme(savedTheme);
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
    const taskEl = document.querySelector(`.subtask-card[data-id="${taskId}"]`);
    if (!taskEl) return null;

    const dayEl = taskEl.closest('.day-accordion');
    const weekEl = taskEl.closest('.week-section');

    if (weekEl) weekEl.open = true;
    if (dayEl) dayEl.open = true;

    return dayEl || taskEl;
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
                <span class="tag tag-${item.type}">${escapeHTML(getTagLabel(item.type))}</span>
                ${item.partLabel ? `<span class="part-pill">${escapeHTML(item.partLabel)}</span>` : ''}
            </div>
            <div class="subtask-text">${escapeHTML(item.t)}</div>
        </div>
    `;

    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('click', e => e.stopPropagation());
    checkbox.addEventListener('change', () => {
        if (!isTaskDone(item.id)) openConfirm(item.id, checkbox);
    });

    card.addEventListener('click', e => {
        if (e.target.closest('input')) return;
        openConfirm(item.id, checkbox);
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

    const doneCount = dayGroup.tasks.filter(task => isTaskDone(task.id)).length;
    const totalCount = dayGroup.tasks.length;
    const isDayCurrent = dayGroup.tasks.some(task => task.dateKey === todayKey);
    const isDayDone = totalCount > 0 && dayGroup.tasks.every(task => isTaskDone(task.id));

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

    const weekDoneCount = orderedWeekTasks.filter(task => isTaskDone(task.id)).length;
    const isWeekCurrent = orderedWeekTasks.some(task => task.dateKey === todayKey);
    const isWeekDone = orderedWeekTasks.length > 0 && orderedWeekTasks.every(task => isTaskDone(task.id));

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
    const hasPending = fullPlan.some(task => !isTaskDone(task.id));
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
        quickNextButton.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:1500;padding:12px 16px;border-radius:14px;background:linear-gradient(90deg,var(--accent),var(--success));color:#000;font-weight:900;cursor:pointer;box-shadow:0 10px 24px rgba(0,0,0,.3);';
        document.body.appendChild(quickNextButton);
    }

    quickNextButton.onclick = () => {
        const nextTask = getNextTask();
        if (!nextTask) return;

        const target = openTaskLocation(nextTask.id);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        applyFilter('all');
        setTimeout(() => {
            const fallback = openTaskLocation(nextTask.id);
            if (fallback) fallback.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 0);
    };
}
function renderTasks() {
    listContainer.innerHTML = '';
    const todayKey = toDateKey(new Date());
    const allOrdered = orderedTasks();

    studyWeeks.forEach((week, weekIndex) => {
        const orderedWeekTasks = allOrdered.filter(task => task.weekIndex === weekIndex);
        const section = buildWeekAccordion(week, weekIndex, orderedWeekTasks, todayKey);
        if (!section) return;
        listContainer.appendChild(section);
    });
}
function playSuccessAnimation() {
    const el = document.getElementById("successAnim");
    if (!el) return; 
   
    el.classList.remove("show");
     void el.offsetWidth;
   
    el.classList.add("show");

    // vibration (لو مدعوم)
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }

    setTimeout(() => {
        el.classList.remove("show");
    }, 600);
}

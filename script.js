


    const fullPlan = studyWeeks.flatMap((week, weekIndex) =>
        week.tasks.map((item, idx) => ({
            ...item,
            weekTitle: week.title,
            weekIndex,
            id: `task-${String(weekIndex + 1).padStart(2, '0')}-${String(idx + 1).padStart(2, '0')}`
        }))
    );

    const STORAGE_KEY = 'studyPlanStateV5';
    const LEGACY_KEY = 'fullPlanProgress';

    const exams = [
        { id: 'chem', name: 'الكيمياء', dateText: '2/7/2026 الساعة 6:00 صباحًا', target: new Date(2026, 6, 2, 6, 0, 0) },
        { id: 'phys', name: 'الفيزياء', dateText: '9/7/2026 الساعة 6:00 صباحًا', target: new Date(2026, 6, 9, 6, 0, 0) },
        { id: 'bio', name: 'الأحياء', dateText: '16/7/2026 الساعة 6:00 صباحًا', target: new Date(2026, 6, 16, 6, 0, 0) },
        { id: 'eng', name: 'الإنجليزي', dateText: '5/7/2026 الساعة 6:00 صباحًا', target: new Date(2026, 6, 5, 6, 0, 0) }
    ];

    const listContainer = document.getElementById('taskList');
    const countdownGrid = document.getElementById('countdownGrid');
    const fill = document.getElementById('bar-fill');
    const percentText = document.getElementById('percent-val');
    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmTaskText = document.getElementById('confirmTaskText');
    const confirmOk = document.getElementById('confirmOk');
    const confirmCancel = document.getElementById('confirmCancel');

    const state = loadState();
    let draggedId = null;
    let pendingTaskId = null;
    let pendingCheckbox = null;

    function loadState() {
        const defaultState = { order: fullPlan.map(item => item.id), done: {} };
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (saved && Array.isArray(saved.order) && saved.done && typeof saved.done === 'object') {
                const order = saved.order.filter(id => fullPlan.some(task => task.id === id));
                const missing = fullPlan.map(task => task.id).filter(id => !order.includes(id));
                return { order: [...order, ...missing], done: saved.done };
            }
        } catch (e) {}
        try {
            const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '{}');
            if (legacy && typeof legacy === 'object') {
                const done = {};
                Object.keys(legacy).forEach(key => {
                    const idx = Number(key);
                    if (legacy[key] && Number.isInteger(idx) && fullPlan[idx]) done[fullPlan[idx].id] = true;
                });
                return { ...defaultState, done };
            }
        } catch (e) {}
        return defaultState;
    }

    function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    function orderedTasks() { const map = new Map(fullPlan.map(task => [task.id, task])); return state.order.map(id => map.get(id)).filter(Boolean); }
    function getTagLabel(type) { const labels = { chem: 'كيمياء', phys: 'فيزياء', bio: 'أحياء', rev: 'مراجعة', sol: 'حل' }; return labels[type] || 'مهمة'; }

    function updateProgress(shouldAnimate) {
        const total = fullPlan.length;
        const doneCount = fullPlan.filter(task => state.done[task.id]).length;
        const percentage = total > 0 ? Math.round((doneCount / total) * 100) : 0;
        fill.style.width = percentage + '%';
        percentText.innerText = percentage + '%';
        if (shouldAnimate) {
            fill.classList.remove('pulse-animation');
            void fill.offsetWidth;
            fill.classList.add('pulse-animation');
        }
    }

    function moveTask(taskId, direction) {
        const index = state.order.indexOf(taskId);
        if (index === -1) return;
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= state.order.length) return;
        const nextOrder = [...state.order];
        [nextOrder[index], nextOrder[newIndex]] = [nextOrder[newIndex], nextOrder[index]];
        state.order = nextOrder;
        saveState();
        render(true);
    }

    function openConfirm(taskId, checkboxEl) {
        if (state.done[taskId]) {
            if (checkboxEl) checkboxEl.checked = true;
            return;
        }
        const task = fullPlan.find(t => t.id === taskId);
        pendingTaskId = taskId;
        pendingCheckbox = checkboxEl || null;
        confirmTaskText.textContent = `${task?.d || ''} — ${task?.t || ''}`;
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

    function setDone(taskId) {
        if (state.done[taskId]) return false;
        state.done[taskId] = true;
        saveState();
        render(true);
        return true;
    }

    function buildTaskCard(item, index, arr) {
        const isDone = !!state.done[item.id];
        const card = document.createElement('div');
        card.className = `day-card ${isDone ? 'done' : ''}`;
        card.draggable = true;
        card.dataset.id = item.id;
        card.innerHTML = `
            <div class="check-container"><input type="checkbox" ${isDone ? 'checked disabled' : ''} aria-label="تحديد المهمة"></div>
            <div class="content">
                <div class="date">${item.d}</div>
                <div class="task">${item.t}</div>
            </div>
            <div class="side-column">
                <span class="tag tag-${item.type}">${getTagLabel(item.type)}</span>
                <div class="reorder-controls">
                    <button class="move-btn up" type="button" ${index === 0 ? 'disabled' : ''} aria-label="تحريك لأعلى">▲</button>
                    <button class="move-btn down" type="button" ${index === arr.length - 1 ? 'disabled' : ''} aria-label="تحريك لأسفل">▼</button>
                </div>
                <div class="drag-handle" title="اسحب للتغيير">⋮⋮</div>
            </div>
        `;
        const checkbox = card.querySelector('input[type="checkbox"]');
        const btnUp = card.querySelector('.move-btn.up');
        const btnDown = card.querySelector('.move-btn.down');
        checkbox.addEventListener('click', e => e.stopPropagation());
        checkbox.addEventListener('change', () => { if (!state.done[item.id]) openConfirm(item.id, checkbox); });
        btnUp.addEventListener('click', e => { e.stopPropagation(); moveTask(item.id, -1); });
        btnDown.addEventListener('click', e => { e.stopPropagation(); moveTask(item.id, 1); });
        card.addEventListener('click', e => { if (e.target.closest('button') || e.target.closest('input')) return; openConfirm(item.id, checkbox); });
        card.addEventListener('dragstart', () => { draggedId = item.id; card.classList.add('dragging'); });
        card.addEventListener('dragend', () => { draggedId = null; card.classList.remove('dragging'); document.querySelectorAll('.day-card.drag-over').forEach(el => el.classList.remove('drag-over')); });
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
            render(true);
        });
        return card;
    }

    function renderTasks() {
        listContainer.innerHTML = '';
        studyWeeks.forEach((week, weekIndex) => {
            const weekTasks = orderedTasks().filter(task => task.weekIndex === weekIndex);
            if (weekTasks.length === 0) return;
            const section = document.createElement('section');
            const isWeekDone = weekTasks.every(task => state.done[task.id]);
            section.className = `week-section ${isWeekDone ? 'done' : ''}`;
            section.innerHTML = `
                <div class="week-header">
                    <div class="week-title">${week.title}</div>
                    <div class="week-subtitle">${isWeekDone ? 'مكتمل' : `${weekTasks.filter(task => state.done[task.id]).length}/${weekTasks.length}`}</div>
                </div>
                <div class="week-tasks"></div>
            `;
            const weekTasksWrap = section.querySelector('.week-tasks');
            weekTasks.forEach((item, index, arr) => {
                weekTasksWrap.appendChild(buildTaskCard(item, index, arr));
            });
            listContainer.appendChild(section);
        });
    }

    function pad2(value) { return String(value).padStart(2, '0'); }
    function formatCountdown(ms) {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        return {
            days: Math.floor(totalSeconds / 86400),
            hours: Math.floor((totalSeconds % 86400) / 3600),
            minutes: Math.floor((totalSeconds % 3600) / 60),
            seconds: totalSeconds % 60
        };
    }

    function renderCountdown() {
        countdownGrid.innerHTML = '';
        exams.forEach(exam => {
            const card = document.createElement('div');
            card.className = `exam-card ${exam.id}`;
            card.innerHTML = `
                <div class="exam-meta">
                    <div class="exam-line">المتبقي على امتحان <span class="exam-subject ${exam.id}">${exam.name}</span></div>
                    <div class="exam-date">${exam.dateText}</div>
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
                seconds: card.querySelector('[data-slot="seconds"]')
            };
        });
    }

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

    function render(animateProgress = false) {
        renderTasks();
        renderCountdown();
        updateProgress(animateProgress);
        updateCountdown();
    }

    confirmOk.addEventListener('click', () => {
        if (!pendingTaskId) return;
        setDone(pendingTaskId);
        closeConfirm(false);
    });
    confirmCancel.addEventListener('click', () => closeConfirm(true));
    confirmOverlay.addEventListener('click', (e) => { if (e.target === confirmOverlay) closeConfirm(true); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && confirmOverlay.classList.contains('show')) closeConfirm(true); });


// === اقتباسات تحفيزية (عدل النصوص براحتك) ===
const motivationQuotes = [
    "بسم الله، شد حيلك يا بطل 💪",
    "راكِم ساعاتك تصنع نتيجتك 📚",
    "النجاح محتاج نفس طويل 🚀",
    "استعن بالله ولا تعجز ✨"
];

// === الثيمات (يمكن تعديل الألوان) ===
function setTheme(theme){
    const root = document.documentElement;
    const themes = {
        default: {"--accent":"#00f2fe","--success":"#00ff87"},
        blue: {"--accent":"#3b82f6","--success":"#60a5fa"},
        gold: {"--accent":"#f59e0b","--success":"#facc15"},
        red: {"--accent":"#ef4444","--success":"#fb7185"}
    };
    Object.entries(themes[theme]).forEach(([k,v])=>root.style.setProperty(k,v));
    localStorage.setItem("siteTheme", theme);
}

// === تحديث الاقتباس ===
function updateMotivation(){
    const banner = document.getElementById("motivationBanner");
    banner.textContent = motivationQuotes[Math.floor(Math.random()*motivationQuotes.length)];
}

// === نظام Streak ===
function calculateStreak(){
    const doneCount = Object.keys(state.done).length;
    return Math.floor(doneCount / 3); // تقدير بسيط قابل للتعديل
}

// === أكثر مادة ===
function getTopSubject(){
    const counts = {phys:0, chem:0, bio:0, sol:0};
    fullPlan.forEach(task => { if(state.done[task.id]) counts[task.type]=(counts[task.type]||0)+1; });
    const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
    return getTagLabel(top);
}

// === مهمة اليوم ===
function updateTodayTask(){
    const next = orderedTasks().find(task => !state.done[task.id]);
    document.getElementById("todayTask").textContent = next ? `${next.d} — ${next.t}` : "خلصت الجدول كله يا وحش 🔥";
}

// === الإنجازات ===
function updateAchievements(){
    const done = Object.keys(state.done).length;
    const achievements = [];
    if(done >= 1) achievements.push("أول خطوة");
    if(done >= 10) achievements.push("10 مهام");
    if(done >= 25) achievements.push("25 مهمة");
    if(done >= fullPlan.length/2) achievements.push("نص الطريق");
    const box = document.getElementById("achievementsList");
    box.innerHTML = achievements.map(a=>`<span class="achievement-badge">${a}</span>`).join("");
}

// === التقويم ===
function renderCalendar(){
    const wrap = document.getElementById("calendarDays");
    wrap.innerHTML = "";
    for(let i=1;i<=30;i++){
        const day = document.createElement("div");
        day.className = "calendar-day";
        if(i <= Object.keys(state.done).length) day.classList.add("done");
        day.textContent = i;
        wrap.appendChild(day);
    }
}

// === تحديث لوحة الإحصائيات ===
function updateDashboard(){
    document.getElementById("streakCount").textContent = calculateStreak();
    document.getElementById("completedCount").textContent = Object.keys(state.done).length;
    document.getElementById("subjectCount").textContent = getTopSubject();
    updateTodayTask();
    updateAchievements();
    renderCalendar();
}

// === تحميل الثيم السابق ===
const savedTheme = localStorage.getItem("siteTheme");
if(savedTheme) setTheme(savedTheme);

// === تشغيل الإضافات ===
updateMotivation();

    render(false);
    updateDashboard();
    setInterval(()=>{updateCountdown(); updateDashboard();}, 1000);

    // تحسين بسيط: زر انتقال لأقرب مهمة غير منجزة
    const nextTask = document.querySelector('.day-card:not(.done)');
    if (nextTask) {
        const quickBtn = document.createElement('button');
        quickBtn.textContent = 'الانتقال لأقرب مهمة';
        quickBtn.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:1500;padding:12px 16px;border:none;border-radius:14px;background:linear-gradient(90deg,var(--accent),var(--success));color:#000;font-weight:900;cursor:pointer;box-shadow:0 10px 25px rgba(0,0,0,.35);';
        quickBtn.onclick = () => nextTask.scrollIntoView({behavior:'smooth', block:'center'});
        document.body.appendChild(quickBtn);
    }
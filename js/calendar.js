// Google Calendar Integration Module for Rodopi Dent PWA

const Calendar = {
  // Current view state
  currentView: 'week', // 'day', 'week', 'month'
  currentDate: new Date(),
  events: [],
  isLoading: false,
  
  // Selection mode for blocking
  selectionMode: false,
  selectedSlots: [],
  selectionStart: null,
  
  // Working hours configuration (9:00 - 18:00 for dental clinic)
  workingHours: {
    start: 9,   // 9:00
    end: 18     // 18:00 (last slot 17:30)
  },
  
  // Pixels per hour for time grid
  hourHeight: 60,

  /**
   * Initialize the calendar module
   */
  init() {
    console.log('Calendar module initialized');
  },

  /**
   * Render the full calendar view
   */
  async render(container, view = 'week') {
    if (!container) return;
    
    this.currentView = view;
    this.container = container;
    
    container.innerHTML = `
      <div class="calendar-view">
        ${this.renderHeader()}
        <div class="calendar-view__body" id="calendar-body">
          <div class="calendar-loading">
            <div class="calendar-loading__spinner"></div>
          </div>
        </div>
      </div>
      ${this.renderEventModal()}
    `;
    
    this.setupEventListeners();
    await this.loadEvents();
    this.renderView();
  },

  /**
   * Render calendar header
   */
  renderHeader() {
    const title = this.getHeaderTitle();
    
    return `
      <div class="calendar-view__header">
        <h2 class="calendar-view__title" id="calendar-title">${title}</h2>
        <div class="calendar-view__controls">
          <button class="calendar-view__nav-btn" id="cal-prev" title="Назад">◀</button>
          <button class="calendar-view__today-btn" id="cal-today">Днес</button>
          <button class="calendar-view__nav-btn" id="cal-next" title="Напред">▶</button>
          
          <div class="view-selector">
            <button class="view-selector__btn" id="view-selector-btn">
              <span id="current-view-label">${this.getViewLabel()}</span>
              <span>▼</span>
            </button>
            <div class="view-selector__dropdown" id="view-dropdown">
              <button class="view-selector__option ${this.currentView === 'day' ? 'active' : ''}" data-view="day">Ден</button>
              <button class="view-selector__option ${this.currentView === 'week' ? 'active' : ''}" data-view="week">Седмица</button>
              <button class="view-selector__option ${this.currentView === 'month' ? 'active' : ''}" data-view="month">Месец</button>
            </div>
          </div>
          
          <!-- Quick block buttons -->
          <div class="block-buttons">
            <button class="btn btn--warning btn--small" id="block-toggle" title="Режим блокиране">
              🚫 Блокирай
            </button>
            <div class="block-buttons__dropdown" id="block-dropdown">
              <button class="block-buttons__option" data-block="morning">Сутрин (09:00-12:00)</button>
              <button class="block-buttons__option" data-block="afternoon">Следобед (13:30-17:30)</button>
              <button class="block-buttons__option" data-block="day">Цял ден</button>
              <button class="block-buttons__option" data-block="week">Цяла седмица</button>
            </div>
          </div>
          
          <button class="btn btn--success" id="cal-add-event">+ Нов час</button>
        </div>
      </div>
      
      <!-- Selection toolbar (hidden by default) -->
      <div class="selection-toolbar" id="selection-toolbar" style="display: none;">
        <span class="selection-toolbar__count" id="selected-count">0 часа избрани</span>
        <button class="btn btn--danger btn--small" id="block-selected">🚫 Блокирай избраните</button>
        <button class="btn btn--secondary btn--small" id="cancel-selection">✕ Отмени</button>
      </div>
    `;
  },

  /**
   * Get header title based on current view
   */
  getHeaderTitle() {
    const months = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 
                    'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];
    const days = ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'];
    
    const d = this.currentDate;
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    
    if (this.currentView === 'day') {
      return `${days[d.getDay()]}, ${d.getDate()} ${month} ${year}`;
    } else if (this.currentView === 'week') {
      const weekStart = this.getWeekStart(d);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${weekStart.getDate()} - ${weekEnd.getDate()} ${month} ${year}`;
      } else {
        return `${weekStart.getDate()} ${months[weekStart.getMonth()]} - ${weekEnd.getDate()} ${months[weekEnd.getMonth()]} ${year}`;
      }
    } else {
      return `${month} ${year}`;
    }
  },

  /**
   * Get view label
   */
  getViewLabel() {
    const labels = { day: 'Ден', week: 'Седмица', month: 'Месец' };
    return labels[this.currentView] || 'Седмица';
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Navigation
    document.getElementById('cal-prev')?.addEventListener('click', () => this.navigate(-1));
    document.getElementById('cal-next')?.addEventListener('click', () => this.navigate(1));
    document.getElementById('cal-today')?.addEventListener('click', () => this.goToToday());
    
    // View selector
    const viewBtn = document.getElementById('view-selector-btn');
    const viewDropdown = document.getElementById('view-dropdown');
    
    viewBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      viewDropdown.classList.toggle('open');
    });
    
    document.querySelectorAll('.view-selector__option').forEach(btn => {
      btn.addEventListener('click', () => {
        const newView = btn.dataset.view;
        this.changeView(newView);
        viewDropdown.classList.remove('open');
      });
    });
    
    // Close dropdown on outside click
    document.addEventListener('click', () => {
      viewDropdown?.classList.remove('open');
    });
    
    // Add event button
    document.getElementById('cal-add-event')?.addEventListener('click', () => {
      this.openEventModal();
    });
    
    // Block mode toggle
    this.setupBlockListeners();
    
    // Modal events
    this.setupModalListeners();
  },
  
  /**
   * Setup block/selection listeners
   */
  setupBlockListeners() {
    const blockToggle = document.getElementById('block-toggle');
    const blockDropdown = document.getElementById('block-dropdown');
    
    // Toggle dropdown
    blockToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      blockDropdown?.classList.toggle('open');
    });
    
    // Quick block options
    document.querySelectorAll('.block-buttons__option').forEach(btn => {
      btn.addEventListener('click', async () => {
        const blockType = btn.dataset.block;
        blockDropdown?.classList.remove('open');
        await this.quickBlock(blockType);
      });
    });
    
    // Block selected
    document.getElementById('block-selected')?.addEventListener('click', async () => {
      await this.blockSelectedSlots();
    });
    
    // Cancel selection
    document.getElementById('cancel-selection')?.addEventListener('click', () => {
      this.clearSelection();
    });
    
    // Close dropdown on outside click
    document.addEventListener('click', () => {
      blockDropdown?.classList.remove('open');
    });
  },
  
  /**
   * Quick block - block morning, afternoon, day, or week
   */
  async quickBlock(type) {
    const d = this.currentDate;
    const dateStr = this.formatDate(d);
    
    let startTime, endTime, title;
    let dates = [dateStr];
    
    switch (type) {
      case 'morning':
        startTime = '09:00';
        endTime = '12:00';
        title = 'Блокиран (сутрин)';
        break;
      case 'afternoon':
        startTime = '13:30';
        endTime = '18:00';
        title = 'Блокиран (следобед)';
        break;
      case 'day':
        startTime = '09:00';
        endTime = '18:00';
        title = 'Блокиран (цял ден)';
        break;
      case 'week':
        // Block all 5 working days
        startTime = '09:00';
        endTime = '18:00';
        title = 'Блокиран (седмица)';
        const weekStart = this.getWeekStart(d);
        dates = [];
        for (let i = 0; i < 5; i++) { // Mon-Fri
          const day = new Date(weekStart);
          day.setDate(day.getDate() + i);
          dates.push(this.formatDate(day));
        }
        break;
    }
    
    if (!confirm(`Блокиране: ${title}\n${dates.length > 1 ? dates.join(', ') : dateStr}\nПотвърди?`)) {
      return;
    }
    
    // Create block events for each date
    for (const date of dates) {
      await this.createBlockEvent(date, startTime, endTime, title);
    }
    
    Utils.showToast('Часовете са блокирани', 'success');
    await this.loadEvents();
    this.renderView();
  },
  
  /**
   * Block selected slots (from drag selection)
   */
  async blockSelectedSlots() {
    if (this.selectedSlots.length === 0) return;
    
    // Group by date
    const byDate = {};
    this.selectedSlots.forEach(slot => {
      if (!byDate[slot.date]) byDate[slot.date] = [];
      byDate[slot.date].push(slot.hour);
    });
    
    // For each date, find continuous ranges
    for (const date of Object.keys(byDate)) {
      const hours = byDate[date].sort((a, b) => a - b);
      
      // Group continuous hours
      let rangeStart = hours[0];
      let rangeEnd = hours[0];
      
      for (let i = 1; i <= hours.length; i++) {
        if (i < hours.length && hours[i] === rangeEnd + 1) {
          rangeEnd = hours[i];
        } else {
          // Create block for this range
          const startTime = `${String(rangeStart).padStart(2, '0')}:00`;
          const endTime = `${String(rangeEnd + 1).padStart(2, '0')}:00`;
          await this.createBlockEvent(date, startTime, endTime, 'Блокиран');
          
          if (i < hours.length) {
            rangeStart = hours[i];
            rangeEnd = hours[i];
          }
        }
      }
    }
    
    Utils.showToast(`Блокирани ${this.selectedSlots.length} часа`, 'success');
    this.clearSelection();
    await this.loadEvents();
    this.renderView();
  },
  
  /**
   * Create a block event in Google Calendar
   */
  async createBlockEvent(date, startTime, endTime, title = 'Блокиран') {
    try {
      const eventData = {
        title: title,
        date: date,
        startTime: startTime,
        endTime: endTime,
        patientName: '',
        patientPhone: '',
        notes: 'Автоматично блокиран от системата',
        status: 'confirmed'
      };
      
      const result = await API.request(CONFIG.ENDPOINTS.CALENDAR_CREATE, {
        method: 'POST',
        body: JSON.stringify(eventData)
      });
      
      return result.success;
    } catch (error) {
      console.error('Error creating block event:', error);
      return false;
    }
  },
  
  /**
   * Clear slot selection
   */
  clearSelection() {
    this.selectedSlots = [];
    this.selectionMode = false;
    this.selectionStart = null;
    
    // Remove selection styling
    document.querySelectorAll('.week-view__hour-slot--selected').forEach(el => {
      el.classList.remove('week-view__hour-slot--selected');
    });
    
    // Hide toolbar
    const toolbar = document.getElementById('selection-toolbar');
    if (toolbar) toolbar.style.display = 'none';
  },
  
  /**
   * Update selection toolbar
   */
  updateSelectionToolbar() {
    const toolbar = document.getElementById('selection-toolbar');
    const countEl = document.getElementById('selected-count');
    
    if (this.selectedSlots.length > 0) {
      toolbar.style.display = 'flex';
      countEl.textContent = `${this.selectedSlots.length} часа избрани`;
    } else {
      toolbar.style.display = 'none';
    }
  },

  /**
   * Setup modal event listeners
   */
  setupModalListeners() {
    const modal = document.getElementById('event-modal');
    if (!modal) return;
    
    // Close on backdrop
    modal.querySelector('.modal__backdrop')?.addEventListener('click', () => {
      this.closeEventModal();
    });
    
    // Close button
    modal.querySelector('.event-modal__close')?.addEventListener('click', () => {
      this.closeEventModal();
    });
    
    // Form submit
    document.getElementById('event-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleEventSubmit(e.target);
    });
    
    // Delete button
    document.getElementById('event-delete-btn')?.addEventListener('click', async () => {
      await this.handleEventDelete();
    });
    
    // Color picker
    document.querySelectorAll('.color-picker__option').forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove active from all
        document.querySelectorAll('.color-picker__option').forEach(b => b.classList.remove('active'));
        // Add active to clicked
        btn.classList.add('active');
        // Set hidden input value
        document.querySelector('input[name="colorId"]').value = btn.dataset.color;
      });
    });
  },

  /**
   * Navigate to previous/next period
   */
  async navigate(direction) {
    const d = this.currentDate;
    
    if (this.currentView === 'day') {
      d.setDate(d.getDate() + direction);
    } else if (this.currentView === 'week') {
      d.setDate(d.getDate() + (direction * 7));
    } else {
      d.setMonth(d.getMonth() + direction);
    }
    
    await this.loadEvents();
    this.renderView();
    this.updateTitle();
  },

  /**
   * Go to today
   */
  async goToToday() {
    this.currentDate = new Date();
    await this.loadEvents();
    this.renderView();
    this.updateTitle();
  },

  /**
   * Change view type
   */
  async changeView(view) {
    this.currentView = view;
    
    // Update active state
    document.querySelectorAll('.view-selector__option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    document.getElementById('current-view-label').textContent = this.getViewLabel();
    
    await this.loadEvents();
    this.renderView();
    this.updateTitle();
  },

  /**
   * Update header title
   */
  updateTitle() {
    const titleEl = document.getElementById('calendar-title');
    if (titleEl) {
      titleEl.textContent = this.getHeaderTitle();
    }
  },

  /**
   * Load events from API
   */
  async loadEvents() {
    const body = document.getElementById('calendar-body');
    if (!body) return;
    
    this.isLoading = true;
    
    const { startDate, endDate } = this.getDateRange();
    
    try {
      const response = await API.getCalendarEvents({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        view: this.currentView
      });
      
      if (response.success && response.data?.events) {
        this.events = response.data.events;
      } else {
        this.events = [];
        console.warn('Failed to load calendar events:', response.error);
      }
    } catch (error) {
      console.error('Error loading calendar events:', error);
      this.events = [];
    }
    
    this.isLoading = false;
  },

  /**
   * Get date range for current view
   */
  getDateRange() {
    const d = new Date(this.currentDate);
    let startDate, endDate;
    
    if (this.currentView === 'day') {
      startDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    } else if (this.currentView === 'week') {
      startDate = this.getWeekStart(d);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);
    } else {
      startDate = new Date(d.getFullYear(), d.getMonth(), 1);
      endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      endDate.setDate(endDate.getDate() + 1);
    }
    
    return { startDate, endDate };
  },

  /**
   * Get week start (Monday)
   */
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  /**
   * Render current view
   */
  renderView() {
    const body = document.getElementById('calendar-body');
    if (!body) return;
    
    if (this.currentView === 'day') {
      body.innerHTML = this.renderDayView();
    } else if (this.currentView === 'week') {
      body.innerHTML = this.renderWeekView();
    } else {
      body.innerHTML = this.renderMonthView();
    }
    
    this.setupGridListeners();
    this.updateCurrentTimeLine();
    
    // Update time line every minute
    if (this.timeLineInterval) {
      clearInterval(this.timeLineInterval);
    }
    this.timeLineInterval = setInterval(() => this.updateCurrentTimeLine(), 60000);
  },

  /**
   * Render day view
   */
  renderDayView() {
    const hours = this.generateHours();
    const today = this.getToday();
    const currentDateStr = this.formatDate(this.currentDate);
    const isToday = currentDateStr === today;
    
    let html = `
      <div class="time-grid">
        <div class="time-labels">
          ${hours.map(h => `<div class="time-label">${String(h).padStart(2, '0')}:00</div>`).join('')}
        </div>
        <div class="day-column ${isToday ? 'day-column--today' : ''}" data-date="${currentDateStr}">
          ${hours.map(h => `<div class="hour-slot" data-hour="${h}" data-date="${currentDateStr}"></div>`).join('')}
          ${this.renderEventsForDay(currentDateStr)}
          ${isToday ? '<div class="current-time-line" id="time-line"></div>' : ''}
        </div>
      </div>
    `;
    
    return html;
  },

  /**
   * Render week view
   */
  renderWeekView() {
    const hours = this.generateHours();
    const weekStart = this.getWeekStart(this.currentDate);
    const today = this.getToday();
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
    
    // Generate week days
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = this.formatDate(d);
      weekDays.push({
        date: dateStr,
        day: days[i],
        dayNum: d.getDate(),
        isToday: dateStr === today,
        isWeekend: i >= 5
      });
    }
    
    let html = `
      <div class="week-view">
        <!-- Header row with day names -->
        <div class="week-view__header">
          <div class="week-view__corner"></div>
          ${weekDays.map(wd => `
            <div class="week-view__day-header ${wd.isToday ? 'week-view__day-header--today' : ''} ${wd.isWeekend ? 'week-view__day-header--weekend' : ''}">
              <span class="week-view__day-name">${wd.day}</span>
              <span class="week-view__day-num">${wd.dayNum}</span>
            </div>
          `).join('')}
        </div>
        
        <!-- Scrollable body with time grid -->
        <div class="week-view__body">
          <!-- Time labels column -->
          <div class="week-view__time-labels">
            ${hours.map(h => `<div class="week-view__time-label">${String(h).padStart(2, '0')}:00</div>`).join('')}
          </div>
          
          <!-- Day columns -->
          <div class="week-view__days">
            ${weekDays.map(wd => `
              <div class="week-view__day-column ${wd.isToday ? 'week-view__day-column--today' : ''} ${wd.isWeekend ? 'week-view__day-column--weekend' : ''}" data-date="${wd.date}">
                ${hours.map(h => `<div class="week-view__hour-slot" data-hour="${h}" data-date="${wd.date}"></div>`).join('')}
                <div class="week-view__events">
                  ${this.renderEventsForDay(wd.date)}
                </div>
                ${wd.isToday ? '<div class="week-view__time-line" id="time-line"></div>' : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    return html;
  },

  /**
   * Render month view
   */
  renderMonthView() {
    const d = this.currentDate;
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const today = this.getToday();
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
    
    // Get starting day (adjust for Monday start)
    let startingDay = firstDay.getDay() - 1;
    if (startingDay < 0) startingDay = 6;
    
    let html = `
      <div class="month-grid">
        <!-- Weekday headers -->
        ${days.map((day, i) => `<div class="month-grid__header ${i >= 5 ? 'month-grid__header--weekend' : ''}">${day}</div>`).join('')}
    `;
    
    // Previous month days
    const prevMonth = new Date(d.getFullYear(), d.getMonth(), 0);
    for (let i = startingDay - 1; i >= 0; i--) {
      const dayNum = prevMonth.getDate() - i;
      const date = this.formatDate(new Date(prevMonth.getFullYear(), prevMonth.getMonth(), dayNum));
      html += `
        <div class="month-grid__day month-grid__day--other-month" data-date="${date}">
          <span class="month-grid__day-number">${dayNum}</span>
        </div>
      `;
    }
    
    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = this.formatDate(new Date(d.getFullYear(), d.getMonth(), day));
      const dayOfWeek = new Date(d.getFullYear(), d.getMonth(), day).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isToday = date === today;
      
      const dayEvents = this.events.filter(e => e.date === date);
      const maxDisplay = 3;
      
      html += `
        <div class="month-grid__day ${isWeekend ? 'month-grid__day--weekend' : ''} ${isToday ? 'month-grid__day--today' : ''}" data-date="${date}">
          <span class="month-grid__day-number">${day}</span>
          <div class="month-grid__events">
            ${dayEvents.slice(0, maxDisplay).map(e => `
              <div class="month-event calendar-event--${e.status || 'confirmed'}" data-event-id="${e.id}" title="${e.patientName || e.title}">
                <span class="month-event__time">${e.startTime}</span>
                <span class="month-event__name">${(e.patientName || e.title || '').substring(0, 15)}</span>
              </div>
            `).join('')}
            ${dayEvents.length > maxDisplay ? `
              <div class="month-event month-event--more" title="Кликнете за да видите всички">+${dayEvents.length - maxDisplay} още</div>
            ` : ''}
          </div>
        </div>
      `;
    }
    
    // Next month days to fill grid
    const totalCells = startingDay + lastDay.getDate();
    const remainingCells = 7 - (totalCells % 7);
    if (remainingCells < 7) {
      for (let i = 1; i <= remainingCells; i++) {
        const date = this.formatDate(new Date(d.getFullYear(), d.getMonth() + 1, i));
        html += `
          <div class="month-grid__day month-grid__day--other-month" data-date="${date}">
            <span class="month-grid__day-number">${i}</span>
          </div>
        `;
      }
    }
    
    html += '</div>';
    return html;
  },

  /**
   * Generate hours array
   */
  generateHours() {
    const hours = [];
    for (let h = this.workingHours.start; h <= this.workingHours.end; h++) {
      hours.push(h);
    }
    return hours;
  },

  /**
   * Get today's date in YYYY-MM-DD format (local timezone)
   */
  getToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  },

  /**
   * Calculate overlapping event groups for proper layout
   */
  calculateEventLayout(events) {
    if (!events.length) return [];
    
    // Sort events by start time
    const sorted = [...events].sort((a, b) => {
      const aStart = this.timeToMinutes(a.startTime);
      const bStart = this.timeToMinutes(b.startTime);
      return aStart - bStart;
    });
    
    // Group overlapping events
    const groups = [];
    let currentGroup = [sorted[0]];
    let groupEnd = this.timeToMinutes(sorted[0].startTime) + (sorted[0].duration || 30);
    
    for (let i = 1; i < sorted.length; i++) {
      const event = sorted[i];
      const eventStart = this.timeToMinutes(event.startTime);
      
      if (eventStart < groupEnd) {
        // Overlaps with current group
        currentGroup.push(event);
        groupEnd = Math.max(groupEnd, eventStart + (event.duration || 30));
      } else {
        // New group
        groups.push(currentGroup);
        currentGroup = [event];
        groupEnd = eventStart + (event.duration || 30);
      }
    }
    groups.push(currentGroup);
    
    // Assign columns within each group
    const layoutEvents = [];
    for (const group of groups) {
      const columns = [];
      
      for (const event of group) {
        const eventStart = this.timeToMinutes(event.startTime);
        const eventEnd = eventStart + (event.duration || 30);
        
        // Find first available column
        let colIndex = 0;
        while (columns[colIndex] && columns[colIndex] > eventStart) {
          colIndex++;
        }
        
        columns[colIndex] = eventEnd;
        
        layoutEvents.push({
          ...event,
          column: colIndex,
          totalColumns: group.length
        });
      }
      
      // Update totalColumns for accurate width calculation
      const maxCol = Math.max(...layoutEvents.filter(e => group.includes(events.find(ev => ev.id === e.id))).map(e => e.column)) + 1;
      layoutEvents.forEach(e => {
        if (group.some(ge => ge.id === e.id)) {
          e.totalColumns = maxCol;
        }
      });
    }
    
    return layoutEvents;
  },

  /**
   * Convert time string to minutes
   */
  timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  },

  /**
   * Render events for a specific day with proper overlap handling
   */
  renderEventsForDay(date) {
    const dayEvents = this.events.filter(e => e.date === date);
    const layoutEvents = this.calculateEventLayout(dayEvents);
    
    return layoutEvents.map(event => {
      const top = this.getEventTop(event.startTime);
      const height = this.getEventHeight(event.duration || 30);
      
      // Calculate width and left position for overlapping events
      const width = 100 / event.totalColumns;
      const left = event.column * width;
      
      // Truncate long names
      const displayName = (event.patientName || event.title || '').substring(0, 25);
      const displayTime = event.startTime || '';
      
      // Color class
      const colorClass = event.color ? `calendar-event--color-${event.color}` : '';
      
      return `
        <div class="calendar-event calendar-event--${event.status || 'confirmed'} ${colorClass}" 
             data-event-id="${event.id}"
             style="top: ${top}px; height: ${height}px; left: ${left}%; width: calc(${width}% - 4px);"
             title="${event.patientName || event.title} - ${event.startTime}${event.patientPhone ? ' (' + event.patientPhone + ')' : ''}">
          <div class="calendar-event__title">${displayName}</div>
          <div class="calendar-event__time">${displayTime}</div>
        </div>
      `;
    }).join('');
  },

  /**
   * Calculate event top position
   */
  getEventTop(startTime) {
    if (!startTime) return 0;
    const [hours, minutes] = startTime.split(':').map(Number);
    const hourOffset = hours - this.workingHours.start;
    return (hourOffset * 60) + minutes;
  },

  /**
   * Calculate event height
   */
  getEventHeight(duration) {
    return Math.max(duration, 20); // Minimum 20px
  },

  /**
   * Setup grid event listeners
   */
  setupGridListeners() {
    // Drag selection for blocking
    let isDragging = false;
    
    document.querySelectorAll('.hour-slot, .week-view__hour-slot').forEach(slot => {
      // Mouse down - start selection
      slot.addEventListener('mousedown', (e) => {
        if (e.shiftKey || e.ctrlKey) {
          e.preventDefault();
          isDragging = true;
          this.selectionStart = { date: slot.dataset.date, hour: parseInt(slot.dataset.hour) };
          this.toggleSlotSelection(slot);
        }
      });
      
      // Mouse enter while dragging
      slot.addEventListener('mouseenter', (e) => {
        if (isDragging) {
          this.toggleSlotSelection(slot, true);
        }
      });
      
      // Normal click to add event
      slot.addEventListener('click', (e) => {
        if (!isDragging && this.selectedSlots.length === 0) {
          const date = slot.dataset.date;
          const hour = slot.dataset.hour;
          this.openEventModal(null, date, hour);
        }
      });
    });
    
    // Mouse up - end selection
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        this.updateSelectionToolbar();
      }
    });
    
    // Click on event to edit
    document.querySelectorAll('.calendar-event').forEach(event => {
      event.addEventListener('click', (e) => {
        e.stopPropagation();
        const eventId = event.dataset.eventId;
        const eventData = this.events.find(ev => ev.id === eventId);
        if (eventData) {
          this.openEventModal(eventData);
        }
      });
    });
    
    // Click on month day to switch to day view
    document.querySelectorAll('.month-grid__day').forEach(day => {
      day.addEventListener('dblclick', (e) => {
        const date = day.dataset.date;
        this.currentDate = new Date(date);
        this.changeView('day');
      });
    });
    
    // Click on month event
    document.querySelectorAll('.month-event').forEach(event => {
      event.addEventListener('click', (e) => {
        e.stopPropagation();
        if (event.classList.contains('month-event--more')) {
          const date = event.closest('.month-grid__day').dataset.date;
          this.currentDate = new Date(date);
          this.changeView('day');
        } else {
          const eventId = event.dataset.eventId;
          const eventData = this.events.find(ev => ev.id === eventId);
          if (eventData) {
            this.openEventModal(eventData);
          }
        }
      });
    });
  },
  
  /**
   * Toggle slot selection
   */
  toggleSlotSelection(slotEl, forceSelect = false) {
    const date = slotEl.dataset.date;
    const hour = parseInt(slotEl.dataset.hour);
    const slotKey = `${date}-${hour}`;
    
    const existingIndex = this.selectedSlots.findIndex(s => s.key === slotKey);
    
    if (existingIndex > -1 && !forceSelect) {
      // Deselect
      this.selectedSlots.splice(existingIndex, 1);
      slotEl.classList.remove('week-view__hour-slot--selected');
    } else if (existingIndex === -1) {
      // Select
      this.selectedSlots.push({ key: slotKey, date, hour });
      slotEl.classList.add('week-view__hour-slot--selected');
    }
  },

  /**
   * Update current time line
   */
  updateCurrentTimeLine() {
    const timeLine = document.getElementById('time-line');
    if (!timeLine) return;
    
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    if (hours >= this.workingHours.start && hours <= this.workingHours.end) {
      const top = ((hours - this.workingHours.start) * 60) + minutes;
      timeLine.style.top = `${top}px`;
      timeLine.style.display = 'block';
    } else {
      timeLine.style.display = 'none';
    }
  },

  /**
   * Format date to YYYY-MM-DD
   */
  formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /**
   * Render event modal
   */
  renderEventModal() {
    return `
      <div id="event-modal" class="modal" hidden>
        <div class="modal__backdrop"></div>
        <div class="modal__content event-modal">
          <div class="event-modal__header">
            <h2 class="event-modal__title" id="event-modal-title">Нов час</h2>
            <button class="event-modal__close">&times;</button>
          </div>
          <form id="event-form" class="event-form">
            <div class="form-group event-form__row--full">
              <label>Име на пациент *</label>
              <input type="text" name="patientName" required placeholder="Въведете име...">
            </div>
            <div class="form-group event-form__row--full">
              <label>Телефон</label>
              <input type="tel" name="patientPhone" placeholder="0888 123 456">
            </div>
            <div class="event-form__row">
              <div class="form-group">
                <label>Дата *</label>
                <input type="date" name="date" required>
              </div>
              <div class="form-group">
                <label>Час *</label>
                <input type="time" name="startTime" required>
              </div>
            </div>
            <div class="event-form__row">
              <div class="form-group">
                <label>Продължителност</label>
                <select name="duration">
                  <option value="30">30 минути</option>
                  <option value="45">45 минути</option>
                  <option value="60">60 минути</option>
                  <option value="90">90 минути</option>
                  <option value="120">2 часа</option>
                </select>
              </div>
              <div class="form-group">
                <label>Статус</label>
                <select name="status">
                  <option value="confirmed">Потвърден</option>
                  <option value="pending">Чакащ</option>
                  <option value="completed">Завършен</option>
                </select>
              </div>
            </div>
            <div class="form-group event-form__row--full">
              <label>Цвят</label>
              <div class="color-picker" id="color-picker">
                <button type="button" class="color-picker__option color-picker__option--green" data-color="green" title="Зелен (стандартен)"></button>
                <button type="button" class="color-picker__option color-picker__option--blue" data-color="blue" title="Син"></button>
                <button type="button" class="color-picker__option color-picker__option--red" data-color="red" title="Червен"></button>
                <button type="button" class="color-picker__option color-picker__option--yellow" data-color="yellow" title="Жълт"></button>
                <button type="button" class="color-picker__option color-picker__option--purple" data-color="purple" title="Лилав"></button>
                <button type="button" class="color-picker__option color-picker__option--orange" data-color="orange" title="Оранжев"></button>
                <button type="button" class="color-picker__option color-picker__option--pink" data-color="pink" title="Розов"></button>
                <button type="button" class="color-picker__option color-picker__option--gray" data-color="gray" title="Сив"></button>
              </div>
              <input type="hidden" name="colorId" value="">
            </div>
            <div class="form-group event-form__row--full">
              <label>Процедура</label>
              <input type="text" name="procedure" placeholder="Преглед, избелване, лечение...">
            </div>
            <div class="form-group event-form__row--full">
              <label>Бележки</label>
              <textarea name="notes" rows="2" placeholder="Допълнителна информация..."></textarea>
            </div>
            <input type="hidden" name="eventId" value="">
            <div class="event-form__actions">
              <button type="button" class="btn btn--danger event-form__delete" id="event-delete-btn" hidden>🗑️ Изтрий</button>
              <button type="button" class="btn btn--secondary" onclick="Calendar.closeEventModal()">Отказ</button>
              <button type="submit" class="btn btn--primary" id="event-submit-btn">Запази</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  /**
   * Open event modal
   */
  openEventModal(event = null, date = null, hour = null) {
    const modal = document.getElementById('event-modal');
    const form = document.getElementById('event-form');
    const title = document.getElementById('event-modal-title');
    const deleteBtn = document.getElementById('event-delete-btn');
    
    if (!modal || !form) return;
    
    form.reset();
    
    // Reset color picker
    document.querySelectorAll('.color-picker__option').forEach(b => b.classList.remove('active'));
    document.querySelector('.color-picker__option--green')?.classList.add('active');
    form.colorId.value = 'green';
    
    if (event) {
      // Edit mode
      title.textContent = 'Редактирай час';
      deleteBtn.hidden = false;
      
      form.patientName.value = event.patientName || event.title || '';
      form.patientPhone.value = event.patientPhone || '';
      form.date.value = event.date || '';
      form.startTime.value = event.startTime || '';
      form.duration.value = event.duration || 30;
      form.status.value = event.status || 'confirmed';
      form.procedure.value = event.procedure || '';
      form.notes.value = event.notes || event.description || '';
      form.eventId.value = event.id || event.googleEventId || '';
      
      // Set color if exists
      if (event.color) {
        document.querySelectorAll('.color-picker__option').forEach(b => b.classList.remove('active'));
        const colorBtn = document.querySelector(`.color-picker__option--${event.color}`);
        if (colorBtn) {
          colorBtn.classList.add('active');
          form.colorId.value = event.color;
        }
      }
    } else {
      // Create mode
      title.textContent = 'Нов час';
      deleteBtn.hidden = true;
      
      form.date.value = date || this.formatDate(this.currentDate);
      form.startTime.value = hour ? `${String(hour).padStart(2, '0')}:00` : '09:00';
      form.eventId.value = '';
    }
    
    modal.hidden = false;
    form.patientName.focus();
  },

  /**
   * Close event modal
   */
  closeEventModal() {
    const modal = document.getElementById('event-modal');
    if (modal) {
      modal.hidden = true;
    }
  },

  /**
   * Handle event form submit
   */
  async handleEventSubmit(form) {
    const formData = new FormData(form);
    const eventId = formData.get('eventId');
    
    const data = {
      patientName: formData.get('patientName'),
      patientPhone: formData.get('patientPhone'),
      date: formData.get('date'),
      startTime: formData.get('startTime'),
      duration: parseInt(formData.get('duration')),
      status: formData.get('status'),
      procedure: formData.get('procedure'),
      notes: formData.get('notes'),
      colorId: formData.get('colorId') || 'green'
    };
    
    const submitBtn = document.getElementById('event-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Запазване...';
    
    try {
      let response;
      
      if (eventId) {
        // Update existing event
        data.eventId = eventId;
        response = await API.updateCalendarEvent(data);
      } else {
        // Create new event
        response = await API.createCalendarEvent(data);
      }
      
      if (response.success) {
        Utils.showToast(eventId ? 'Часът е обновен' : 'Часът е добавен', 'success');
        this.closeEventModal();
        await this.loadEvents();
        this.renderView();
      } else {
        Utils.showToast(response.message || 'Грешка при запазване', 'error');
      }
    } catch (error) {
      console.error('Error saving event:', error);
      Utils.showToast('Грешка при запазване', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Запази';
    }
  },

  /**
   * Handle event delete
   */
  async handleEventDelete() {
    const form = document.getElementById('event-form');
    const eventId = form?.eventId?.value;
    
    if (!eventId) return;
    
    if (!confirm('Сигурни ли сте, че искате да изтриете този час?')) {
      return;
    }
    
    const deleteBtn = document.getElementById('event-delete-btn');
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Изтриване...';
    
    try {
      const response = await API.deleteCalendarEvent(eventId);
      
      if (response.success) {
        Utils.showToast('Часът е изтрит', 'success');
        this.closeEventModal();
        await this.loadEvents();
        this.renderView();
      } else {
        Utils.showToast(response.message || 'Грешка при изтриване', 'error');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      Utils.showToast('Грешка при изтриване', 'error');
    } finally {
      deleteBtn.disabled = false;
      deleteBtn.textContent = '🗑️ Изтрий';
    }
  }
};

// Export for use
window.Calendar = Calendar;

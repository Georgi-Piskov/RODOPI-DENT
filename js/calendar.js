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
   * Pending events cache (separate from current view events)
   */
  pendingEvents: [],

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
        ${this.renderPendingRequestsSection()}
        ${this.renderCallbackSection()}
        <div class="calendar-view__body" id="calendar-body">
          <div class="calendar-loading">
            <div class="calendar-loading__spinner"></div>
          </div>
        </div>
      </div>
      ${this.renderEventModal()}
    `;
    
    this.setupEventListeners();
    // Load current view events FIRST (needed for conflict detection)
    await this.loadEvents();
    // Load pending events (all future pending)
    await this.loadPendingEvents();
    // Load callback events (marked with 🔔)
    await this.loadCallbackEvents();
    // Now update sections (this.events is populated)
    this.updatePendingRequestsSection();
    this.updateCallbackSection();
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
    
    // Resize handler for responsive calendar
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (this.currentView === 'week') {
          this.renderView();
        }
      }, 200);
    });
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
   * Load pending events (all future events with ⏳ prefix)
   */
  async loadPendingEvents() {
    try {
      // Get events for the next 90 days to find pending requests
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + 90);
      
      const response = await API.getCalendarEvents({
        startDate: today.toISOString(),
        endDate: futureDate.toISOString(),
        view: 'month'
      });
      
      if (response.success && response.data?.events) {
        // Store ALL events for conflict detection
        this.allFutureEvents = response.data.events;
        
        // Filter only pending events
        this.pendingEvents = response.data.events.filter(e => {
          const title = e.title || '';
          const description = e.description || '';
          return title.startsWith('⏳') || 
                 title.toLowerCase().includes('pending') ||
                 description.toLowerCase().includes('статус: чакащ') ||
                 description.toLowerCase().includes('status: pending') ||
                 description.toLowerCase().includes('pending');
        });
      } else {
        this.pendingEvents = [];
        this.allFutureEvents = [];
      }
    } catch (error) {
      console.error('Error loading pending events:', error);
      this.pendingEvents = [];
      this.allFutureEvents = [];
    }
  },

  /**
   * Load callback events (for phone callbacks)
   */
  async loadCallbackEvents() {
    try {
      // Get events for the next 90 days to find callback requests
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + 90);
      
      const response = await API.getCalendarEvents({
        startDate: today.toISOString(),
        endDate: futureDate.toISOString(),
        view: 'month'
      });
      
      if (response.success && response.data?.events) {
        // Filter only callback events (marked with 🔔)
        this.callbackEvents = response.data.events.filter(e => {
          const title = e.title || '';
          const description = e.description || '';
          return title.startsWith('🔔') || 
                 description.toLowerCase().includes('статус: за обаждане');
        });
      } else {
        this.callbackEvents = [];
      }
    } catch (error) {
      console.error('Error loading callback events:', error);
      this.callbackEvents = [];
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
      
      // DEBUG: Log the API response to see structure
      console.log('=== CALENDAR DEBUG ===');
      console.log('API Response:', response);
      if (response.data?.events?.[0]) {
        const sample = response.data.events[0];
        console.log('First event:', {
          title: sample.title || sample.patientName,
          date: sample.date,
          startTime: sample.startTime,
          endTime: sample.endTime,
          rawEvent: sample
        });
      }
      console.log('=== END DEBUG ===');
      
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
   * Check if we're on mobile device
   */
  isMobile() {
    return window.innerWidth <= 768;
  },

  /**
   * Get visible days count based on screen size
   */
  getVisibleDaysCount() {
    if (window.innerWidth <= 480) return 3;
    if (window.innerWidth <= 768) return 3;
    return 7;
  },

  /**
   * Render week view
   */
  renderWeekView() {
    const hours = this.generateHours();
    const weekStart = this.getWeekStart(this.currentDate);
    const today = this.getToday();
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
    const isMobile = this.isMobile();
    const visibleDays = this.getVisibleDaysCount();
    
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
        isWeekend: i >= 5,
        index: i
      });
    }
    
    // On mobile, find today's index and show 3 days centered around today
    let visibleIndexes = [];
    if (isMobile) {
      const todayIndex = weekDays.findIndex(wd => wd.isToday);
      const centerIndex = todayIndex >= 0 ? todayIndex : Math.floor(visibleDays / 2);
      
      // Calculate start index, ensuring we stay within bounds
      let startIdx = centerIndex - Math.floor(visibleDays / 2);
      if (startIdx < 0) startIdx = 0;
      if (startIdx + visibleDays > 7) startIdx = 7 - visibleDays;
      
      for (let i = startIdx; i < startIdx + visibleDays; i++) {
        visibleIndexes.push(i);
      }
    } else {
      visibleIndexes = [0, 1, 2, 3, 4, 5, 6];
    }
    
    // Filter to visible days only on mobile
    const displayDays = isMobile 
      ? weekDays.filter(wd => visibleIndexes.includes(wd.index))
      : weekDays;
    
    let html = `
      <div class="week-view" style="--visible-days: ${displayDays.length}">
        <!-- Header row with day names -->
        <div class="week-view__header" style="grid-template-columns: ${isMobile ? '45px' : '60px'} repeat(${displayDays.length}, 1fr)">
          <div class="week-view__corner"></div>
          ${displayDays.map(wd => `
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
          <div class="week-view__days" style="grid-template-columns: repeat(${displayDays.length}, 1fr); min-width: 0;">
            ${displayDays.map(wd => `
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
      
      // Extract procedure from description if not directly available
      let procedure = event.procedure || '';
      if (!procedure && event.description) {
        // Try to extract from description: "🦷 Процедура: Преглед"
        const match = event.description.match(/(?:процедура|procedure|🦷)[:\s]*([^\n]+)/i);
        if (match) {
          procedure = match[1].trim();
        }
      }
      
      // Build display text
      const patientName = (event.patientName || event.title || '').substring(0, 25);
      const displayTime = event.startTime || '';
      const procedureText = procedure ? procedure.substring(0, 30) : '';
      
      // Color class - use colorId (from API) or color as fallback
      const eventColor = event.colorId || event.color || '';
      const colorClass = eventColor ? `calendar-event--color-${eventColor}` : '';
      
      // Build tooltip
      const tooltip = [
        event.patientName || event.title,
        displayTime,
        procedureText ? `Процедура: ${procedureText}` : '',
        event.patientPhone ? `Тел: ${event.patientPhone}` : ''
      ].filter(Boolean).join(' | ');
      
      return `
        <div class="calendar-event calendar-event--${event.status || 'confirmed'} ${colorClass}" 
             data-event-id="${event.id}"
             style="top: ${top}px; height: ${height}px; left: ${left}%; width: calc(${width}% - 4px);"
             title="${tooltip}">
          <div class="calendar-event__name">${patientName}</div>
          ${procedureText ? `<div class="calendar-event__procedure">🦷 ${procedureText}</div>` : ''}
          <div class="calendar-event__time">🕐 ${displayTime}</div>
        </div>
      `;
    }).join('');
  },

  /**
   * Calculate event top position (1 hour = 120px, 1 minute = 2px)
   */
  getEventTop(startTime) {
    if (!startTime) return 0;
    const [hours, minutes] = startTime.split(':').map(Number);
    const hourOffset = hours - this.workingHours.start;
    return (hourOffset * 120) + (minutes * 2);
  },

  /**
   * Calculate event height (1 minute = 2px)
   * 15 min = 35px, 30 min = 60px, 60 min = 120px
   */
  getEventHeight(duration) {
    const height = duration * 2;
    // Minimum 35px for 15-min events to be compact but readable
    return Math.max(height, 35);
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
   * Render pending requests section
   */
  renderPendingRequestsSection() {
    return `
      <div class="pending-requests" id="pending-requests">
        <div class="pending-requests__header">
          <h3 class="pending-requests__title">⏳ Чакащи заявки</h3>
          <span class="pending-requests__count" id="pending-count">0</span>
        </div>
        <div class="pending-requests__list" id="pending-list">
          <!-- Pending requests will be rendered here -->
        </div>
      </div>
    `;
  },

  /**
   * Render callback requests section (for phone callbacks)
   */
  renderCallbackSection() {
    return `
      <div class="callback-requests" id="callback-requests" style="display: none;">
        <div class="callback-requests__header">
          <h3 class="callback-requests__title">🔔 За обаждане</h3>
          <span class="callback-requests__count" id="callback-count">0</span>
        </div>
        <div class="callback-requests__list" id="callback-list">
          <!-- Callback requests will be rendered here -->
        </div>
      </div>
    `;
  },

  /**
   * Update callback requests section with current data
   */
  updateCallbackSection() {
    const callbackList = document.getElementById('callback-list');
    const callbackCount = document.getElementById('callback-count');
    const callbackSection = document.getElementById('callback-requests');
    
    if (!callbackList || !callbackCount) return;
    
    // Get callback events (marked with 🔔)
    const callbackEvents = this.callbackEvents || [];
    
    callbackCount.textContent = callbackEvents.length;
    
    if (callbackEvents.length === 0) {
      callbackSection.style.display = 'none';
      return;
    }
    
    callbackSection.style.display = 'block';
    
    const html = callbackEvents.map(event => {
      const patientName = (event.title || '').replace('🔔 ', '').replace('🔔', '').trim();
      const dateStr = Utils.formatDate(event.date, 'dd.mm.yyyy');
      const dayName = ['Нед', 'Пон', 'Вто', 'Сря', 'Чет', 'Пет', 'Съб'][new Date(event.date).getDay()];
      
      // Extract phone from description
      const phoneMatch = (event.description || '').match(/📞 Тел: ([^\n]+)/);
      const phone = phoneMatch ? phoneMatch[1].trim() : '';
      
      // Extract reason from description  
      const reasonMatch = (event.description || '').match(/📋 Причина: ([^\n]+)/);
      const reason = reasonMatch ? reasonMatch[1].trim() : '';
      
      return `
        <div class="callback-request-card" data-event-id="${event.id}">
          <div class="callback-request-card__info">
            <strong>${patientName}</strong>
            <span class="callback-request-card__datetime">
              📅 ${dayName}, ${dateStr} в ${event.startTime}
            </span>
            ${phone ? `<a href="tel:${phone}" class="callback-request-card__phone">📞 ${phone}</a>` : ''}
            ${reason ? `<span class="callback-request-card__reason">📋 ${reason}</span>` : ''}
          </div>
          <div class="callback-request-card__actions">
            <button class="btn btn--success btn--small callback-done" 
                    data-event-id="${event.id}" 
                    title="Маркирай като обаден">
              ✓ Обадих се
            </button>
            <button class="btn btn--danger btn--small callback-delete" 
                    data-event-id="${event.id}" 
                    title="Изтрий">
              ✕
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    callbackList.innerHTML = html;
    
    // Add event listeners for callback buttons
    callbackList.querySelectorAll('.callback-done').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const eventId = e.currentTarget.dataset.eventId;
        await this.markCallbackDone(eventId);
      });
    });
    
    callbackList.querySelectorAll('.callback-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const eventId = e.currentTarget.dataset.eventId;
        await this.deleteCallbackEvent(eventId);
      });
    });
  },

  /**
   * Update pending requests section with current data
   */
  updatePendingRequestsSection() {
    const pendingList = document.getElementById('pending-list');
    const pendingCount = document.getElementById('pending-count');
    const pendingSection = document.getElementById('pending-requests');
    
    if (!pendingList || !pendingCount) return;
    
    // Use the separately loaded pending events (covers all future dates)
    const pendingEvents = this.pendingEvents || [];
    
    pendingCount.textContent = pendingEvents.length;
    
    // Hide section if no pending requests
    if (pendingEvents.length === 0) {
      pendingSection.style.display = 'none';
      return;
    }
    
    pendingSection.style.display = 'block';
    
    const html = pendingEvents.map(event => {
      const patientName = (event.title || '').replace('⏳ ', '').replace('⏳', '');
      const dateStr = Utils.formatDate(event.date, 'dd.mm.yyyy');
      const dayName = ['Нед', 'Пон', 'Вто', 'Сря', 'Чет', 'Пет', 'Съб'][new Date(event.date).getDay()];
      
      // Extract phone from description
      const phoneMatch = (event.description || '').match(/📞 Тел: ([^\n]+)/);
      const phone = phoneMatch ? phoneMatch[1].trim() : '';
      
      // Extract reason from description  
      const reasonMatch = (event.description || '').match(/📋 Причина: ([^\n]+)/);
      const reason = reasonMatch ? reasonMatch[1].trim() : '';
      
      // Find next event to calculate max available time
      const maxAvailableMinutes = this.getMaxAvailableMinutes(event.date, event.startTime, event.id);
      
      // Check for conflicts with different durations
      const conflicts30 = this.checkForConflicts(event.date, event.startTime, this.addMinutesToTime(event.startTime, 30), event.id);
      const conflicts60 = this.checkForConflicts(event.date, event.startTime, this.addMinutesToTime(event.startTime, 60), event.id);
      
      const can30 = maxAvailableMinutes >= 30;
      const can60 = maxAvailableMinutes >= 60;
      
      // Build conflict warning message
      let conflictWarning = '';
      let conflictNames = [];
      if (!can30 || conflicts30.length > 0 || conflicts60.length > 0) {
        conflictNames = [...new Set([...conflicts30, ...conflicts60].map(c => 
          (c.title || '').replace(/^[⏳✅\s]+/, '').trim()
        ))];
        if (conflictNames.length > 0) {
          conflictWarning = `
            <div class="pending-request-card__conflict">
              ⚠️ Следващ час след ${maxAvailableMinutes} мин: ${conflictNames.join(', ')}
            </div>
          `;
        }
      }
      
      // Build action buttons based on availability
      let actionButtons = '';
      
      if (can30) {
        actionButtons += `
          <button class="btn btn--success btn--small pending-confirm-30" 
                  data-event-id="${event.id}" data-duration="30" 
                  title="Потвърди 30 мин">
            30м
          </button>`;
      }
      
      if (can60) {
        actionButtons += `
          <button class="btn btn--success btn--small pending-confirm-60" 
                  data-event-id="${event.id}" data-duration="60" 
                  title="Потвърди 60 мин">
            60м
          </button>`;
      }
      
      // If no confirm options available, or there's a conflict, show "for callback" button
      if (!can30 || (maxAvailableMinutes < 60 && maxAvailableMinutes > 0)) {
        actionButtons += `
          <button class="btn btn--warning btn--small pending-callback" 
                  data-event-id="${event.id}" 
                  title="Запази за телефонно обаждане">
            📞 За обаждане
          </button>`;
      }
      
      actionButtons += `
        <button class="btn btn--danger btn--small pending-reject" data-event-id="${event.id}" title="Откажи">
          ✕
        </button>`;
      
      return `
        <div class="pending-request-card ${!can60 ? 'has-conflict' : ''}" data-event-id="${event.id}">
          <div class="pending-request-card__info">
            <strong>${patientName}</strong>
            <span class="pending-request-card__datetime">
              📅 ${dayName}, ${dateStr} в ${event.startTime}
            </span>
            ${phone ? `<span class="pending-request-card__phone">📞 ${phone}</span>` : ''}
            ${reason ? `<span class="pending-request-card__reason">📋 ${reason}</span>` : ''}
            ${conflictWarning}
          </div>
          <div class="pending-request-card__actions">
            ${actionButtons}
          </div>
        </div>
      `;
    }).join('');
    
    pendingList.innerHTML = html;
    
    // Add event listeners for confirm buttons (30 and 60 min)
    pendingList.querySelectorAll('.pending-confirm-30, .pending-confirm-60').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const eventId = e.currentTarget.dataset.eventId;
        const duration = parseInt(e.currentTarget.dataset.duration);
        await this.confirmPendingRequest(eventId, duration);
      });
    });
    
    pendingList.querySelectorAll('.pending-reject').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const eventId = e.currentTarget.dataset.eventId;
        this.rejectPendingRequest(eventId);
      });
    });
    
    // Add event listeners for callback buttons
    pendingList.querySelectorAll('.pending-callback').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const eventId = e.currentTarget.dataset.eventId;
        await this.moveToCallbackList(eventId);
      });
    });
  },

  /**
   * Open modal to select duration for confirming a pending request
   */
  async openConfirmDurationModal(eventId) {
    const event = this.pendingEvents.find(e => e.id === eventId);
    if (!event) return;
    
    const patientName = event.title.replace('⏳ ', '').replace('⏳', '');
    const dateStr = Utils.formatDate(event.date, 'dd.mm.yyyy');
    const dayName = ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'][new Date(event.date).getDay()];
    
    // Create custom duration modal
    const modalHtml = `
      <div id="duration-modal" class="modal" style="display: flex;">
        <div class="modal__backdrop"></div>
        <div class="modal__content" style="max-width: 400px;">
          <div class="modal__header">
            <h3>⏳ Потвърди час</h3>
          </div>
          <div class="modal__body" style="padding: 1.5rem;">
            <p style="margin-bottom: 1rem; font-size: 1.1rem;">
              <strong>${patientName}</strong><br>
              📅 ${dayName}, ${dateStr} в ${event.startTime}
            </p>
            <p style="margin-bottom: 1rem; color: #666;">Изберете продължителност:</p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
              <button class="btn btn--primary btn--large duration-select-btn" data-duration="30" style="flex: 1; padding: 1rem; font-size: 1.2rem;">
                🕐 30 мин
              </button>
              <button class="btn btn--primary btn--large duration-select-btn" data-duration="60" style="flex: 1; padding: 1rem; font-size: 1.2rem;">
                🕐 60 мин
              </button>
            </div>
          </div>
          <div class="modal__footer" style="padding: 1rem; border-top: 1px solid #eee; text-align: center;">
            <button class="btn btn--secondary duration-cancel-btn">Отказ</button>
          </div>
        </div>
      </div>
    `;
    
    // Add modal to page
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    const modal = document.getElementById('duration-modal');
    
    // Return a promise that resolves when user selects duration
    return new Promise((resolve) => {
      // Duration button click handlers
      modal.querySelectorAll('.duration-select-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const duration = parseInt(btn.dataset.duration);
          modal.remove();
          modalContainer.remove();
          await this.confirmPendingRequest(eventId, duration);
          resolve(duration);
        });
      });
      
      // Cancel button
      modal.querySelector('.duration-cancel-btn').addEventListener('click', () => {
        modal.remove();
        modalContainer.remove();
        resolve(null);
      });
      
      // Backdrop click
      modal.querySelector('.modal__backdrop').addEventListener('click', () => {
        modal.remove();
        modalContainer.remove();
        resolve(null);
      });
    });
  },

  /**
   * Get maximum available minutes until next event
   * Returns the time in minutes until the next event starts
   */
  getMaxAvailableMinutes(date, startTime, excludeEventId = null) {
    const startMinutes = this.timeToMinutes(startTime);
    
    // Get all events for this date from allFutureEvents (most complete)
    // Fallback to events + pendingEvents if allFutureEvents not available
    const eventsSource = this.allFutureEvents && this.allFutureEvents.length > 0 
      ? this.allFutureEvents 
      : [...(this.events || []), ...(this.pendingEvents || [])];
    
    const allEvents = eventsSource
      .filter(e => e.date === date && e.id !== excludeEventId);
    
    // Find the next event after this start time
    let nextEventStart = 18 * 60; // Default: end of working day (18:00)
    
    for (const event of allEvents) {
      const eventStart = this.timeToMinutes(event.startTime);
      
      // Only consider events that start after our start time
      if (eventStart > startMinutes && eventStart < nextEventStart) {
        nextEventStart = eventStart;
      }
    }
    
    return nextEventStart - startMinutes;
  },

  /**
   * Check for time conflicts with other events
   * Returns array of conflicting events
   */
  checkForConflicts(date, startTime, endTime, excludeEventId = null) {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    
    // Get all events for this date from allFutureEvents (most complete)
    const eventsSource = this.allFutureEvents && this.allFutureEvents.length > 0 
      ? this.allFutureEvents 
      : [...(this.events || []), ...(this.pendingEvents || [])];
    
    const allEvents = eventsSource.filter(e => e.date === date);
    
    const conflicts = allEvents.filter(event => {
      // Exclude the event we're checking
      if (event.id === excludeEventId) return false;
      
      const eventStart = this.timeToMinutes(event.startTime);
      const eventEnd = this.timeToMinutes(event.endTime);
      
      // Check for overlap: events conflict if one starts before the other ends
      // and ends after the other starts
      const overlaps = startMinutes < eventEnd && endMinutes > eventStart;
      
      return overlaps;
    });
    
    return conflicts;
  },

  /**
   * Convert time string to minutes
   */
  timeToMinutes(time) {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  },

  /**
   * Confirm a pending request with selected duration
   */
  async confirmPendingRequest(eventId, duration) {
    try {
      const event = this.pendingEvents.find(e => e.id === eventId);
      if (!event) throw new Error('Събитието не е намерено');
      
      // Remove all ⏳ and ✅ prefixes to get clean name
      const patientName = (event.title || '')
        .replace(/^[⏳✅\s]+/, '')
        .trim();
      
      // Calculate new end time
      const [hours, minutes] = event.startTime.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const endMinutes = startMinutes + duration;
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      const newEndTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
      
      // Check for conflicts with the new duration
      const conflicts = this.checkForConflicts(event.date, event.startTime, newEndTime, eventId);
      
      if (conflicts.length > 0) {
        // Show conflict dialog
        this.showConflictDialog(event, conflicts, duration, patientName);
        return;
      }
      
      // No conflicts - proceed with confirmation
      await this.doConfirmEvent(event, patientName, duration, newEndTime);
      
    } catch (error) {
      console.error('Error confirming request:', error);
      Utils.showToast('Грешка при потвърждение: ' + error.message, 'error');
    }
  },

  /**
   * Show conflict dialog with options
   */
  showConflictDialog(event, conflicts, duration, patientName) {
    // Build conflict info
    const conflictList = conflicts.map(c => {
      const name = (c.title || '').replace(/^[⏳✅\s]+/, '').trim();
      const isPending = c.title && c.title.includes('⏳');
      return `• ${c.startTime}-${c.endTime}: ${name} ${isPending ? '(чакащ)' : '(потвърден)'}`;
    }).join('\n');
    
    const message = `⚠️ КОНФЛИКТ НА ЧАСОВЕ!\n\n` +
      `Ако потвърдите ${patientName} за ${duration} мин. (${event.startTime}-${event.endTime} -> до ${this.addMinutesToTime(event.startTime, duration)}),\n` +
      `ще се застъпи с:\n\n${conflictList}\n\n` +
      `Какво искате да направите?\n\n` +
      `OK = Откажи конфликтиращите и потвърди този час\n` +
      `Cancel = Отмени и избери друга продължителност`;
    
    if (confirm(message)) {
      // Reject conflicting events and confirm this one
      this.resolveConflictsAndConfirm(event, conflicts, patientName, duration);
    }
  },

  /**
   * Add minutes to time string
   */
  addMinutesToTime(time, minutes) {
    const [h, m] = time.split(':').map(Number);
    const totalMinutes = h * 60 + m + minutes;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  },

  /**
   * Resolve conflicts by rejecting conflicting events and confirming the main one
   */
  async resolveConflictsAndConfirm(event, conflicts, patientName, duration) {
    try {
      // First, reject/mark conflicting events
      for (const conflict of conflicts) {
        const conflictName = (conflict.title || '').replace(/^[⏳✅\s]+/, '').trim();
        const isPending = conflict.title && conflict.title.includes('⏳');
        
        // Extract phone from conflict event
        const phoneMatch = (conflict.description || '').match(/📞\s*Тел:\s*([0-9+\s]+)/);
        const conflictPhone = phoneMatch ? phoneMatch[1].replace(/\s/g, '') : null;
        
        if (isPending) {
          // Delete pending conflicting event
          await API.deleteCalendarEvent(conflict.id);
          this.pendingEvents = this.pendingEvents.filter(e => e.id !== conflict.id);
          
          // Send SMS to conflicting patient about cancellation
          if (conflictPhone) {
            const formattedDate = new Date(conflict.date).toLocaleDateString('bg-BG', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            });
            
            API.sendSMS({
              phone: conflictPhone,
              template: 'booking_conflict',
              date: formattedDate,
              time: conflict.startTime,
              patientName: conflictName
            }).catch(err => console.warn('Conflict SMS error:', err));
          }
        } else {
          // For confirmed events, just notify - don't auto-delete
          Utils.showToast(`⚠️ Внимание: ${conflictName} е потвърден час - проверете ръчно!`, 'warning');
        }
      }
      
      // Now confirm the main event
      const newEndTime = this.addMinutesToTime(event.startTime, duration);
      await this.doConfirmEvent(event, patientName, duration, newEndTime);
      
      // Update UI
      this.updatePendingRequestsSection();
      
    } catch (error) {
      console.error('Error resolving conflicts:', error);
      Utils.showToast('Грешка при разрешаване на конфликти: ' + error.message, 'error');
    }
  },

  /**
   * Actually confirm the event (after conflict check passed)
   */
  async doConfirmEvent(event, patientName, duration, newEndTime) {
    // Extract phone number from description
    const phoneMatch = (event.description || '').match(/📞\s*Тел:\s*([0-9+\s]+)/);
    const patientPhone = phoneMatch ? phoneMatch[1].replace(/\s/g, '') : null;
    
    // Build new description - update status
    let newDescription = (event.description || '')
      .replace(/⏳\s*Статус:\s*ЧАКАЩ\s*\(pending\)/gi, '✅ Статус: ПОТВЪРДЕН')
      .replace(/⏳\s*Статус:\s*pending/gi, '✅ Статус: ПОТВЪРДЕН')
      .replace(/Статус:\s*ЧАКАЩ/gi, '✅ Статус: ПОТВЪРДЕН');
    
    // Add status if not present
    if (!newDescription.includes('Статус: ПОТВЪРДЕН')) {
      newDescription = newDescription.replace(/Статус:[^\n]*/i, '✅ Статус: ПОТВЪРДЕН');
      if (!newDescription.includes('Статус:')) {
        newDescription += '\n✅ Статус: ПОТВЪРДЕН';
      }
    }
    
    // Add duration info
    if (!newDescription.includes('Продължителност:')) {
      newDescription += `\n⏱️ Продължителност: ${duration} мин.`;
    }
    
    // Update calendar event
    const response = await API.updateCalendarEvent({
      eventId: event.id,
      patientName: `✅ ${patientName}`,
      date: event.date,
      startTime: event.startTime,
      endTime: newEndTime,
      duration: duration,
      colorId: 'green',
      notes: newDescription
    });
    
    if (response.success) {
      Utils.showToast(`Часът за ${patientName} е потвърден!`, 'success');
      
      // Send confirmation SMS to patient
      if (patientPhone) {
        const formattedDate = new Date(event.date).toLocaleDateString('bg-BG', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        
        API.sendSMS({
          phone: patientPhone,
          template: 'booking_confirmed',
          date: formattedDate,
          time: event.startTime,
          duration: duration,
          patientName: patientName
        }).then(smsResponse => {
          if (smsResponse.success) {
            console.log('Confirmation SMS sent to:', patientPhone);
          } else {
            console.warn('Failed to send SMS:', smsResponse);
          }
        }).catch(err => {
          console.warn('SMS error:', err);
        });
      }
      
      // Immediately remove from local array and DOM
      this.pendingEvents = this.pendingEvents.filter(e => e.id !== event.id);
      const card = document.querySelector(`.pending-request-card[data-event-id="${event.id}"]`);
      if (card) card.remove();
      this.updatePendingRequestsSection();
      // Also reload current view events
      await this.loadEvents();
      this.renderView();
    } else {
      throw new Error(response.error || 'Грешка при потвърждение');
    }
  },

  /**
   * Move pending request to callback list (for doctor to call patient)
   */
  async moveToCallbackList(eventId) {
    const event = this.pendingEvents.find(e => e.id === eventId);
    if (!event) return;
    
    const patientName = (event.title || '').replace(/^[⏳✅\s]+/, '').trim();
    
    // Extract phone number from description
    const phoneMatch = (event.description || '').match(/📞\s*Тел:\s*([0-9+\s]+)/);
    const patientPhone = phoneMatch ? phoneMatch[1].replace(/\s/g, '') : null;
    
    try {
      // Update event to callback status (🔔 prefix, orange color)
      let newDescription = (event.description || '')
        .replace(/⏳\s*Статус:\s*ЧАКАЩ\s*\(pending\)/gi, '🔔 Статус: ЗА ОБАЖДАНЕ')
        .replace(/⏳\s*Статус:\s*pending/gi, '🔔 Статус: ЗА ОБАЖДАНЕ')
        .replace(/Статус:\s*ЧАКАЩ/gi, '🔔 Статус: ЗА ОБАЖДАНЕ');
      
      if (!newDescription.includes('Статус: ЗА ОБАЖДАНЕ')) {
        newDescription += '\n🔔 Статус: ЗА ОБАЖДАНЕ';
      }
      
      newDescription += `\n📅 Преместен за обаждане: ${new Date().toLocaleString('bg-BG')}`;
      
      const response = await API.updateCalendarEvent({
        eventId: event.id,
        patientName: `🔔 ${patientName}`,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        colorId: '6', // Orange for callback
        notes: newDescription
      });
      
      if (response.success) {
        Utils.showToast(`${patientName} е добавен за телефонно обаждане`, 'info');
        
        // Send SMS to patient about conflict
        if (patientPhone) {
          const formattedDate = new Date(event.date).toLocaleDateString('bg-BG', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });
          
          API.sendSMS({
            phone: patientPhone,
            template: 'booking_conflict',
            date: formattedDate,
            time: event.startTime,
            patientName: patientName
          }).catch(err => console.warn('SMS error:', err));
        }
        
        // Move from pending to callback list
        this.pendingEvents = this.pendingEvents.filter(e => e.id !== eventId);
        
        // Add to callback events array
        if (!this.callbackEvents) this.callbackEvents = [];
        this.callbackEvents.push({
          ...event,
          title: `🔔 ${patientName}`,
          status: 'callback'
        });
        
        this.updatePendingRequestsSection();
        this.updateCallbackSection();
        await this.loadEvents();
        this.renderView();
      } else {
        throw new Error(response.error || 'Грешка при преместване');
      }
    } catch (error) {
      console.error('Error moving to callback:', error);
      Utils.showToast('Грешка: ' + error.message, 'error');
    }
  },

  /**
   * Mark a callback event as done (doctor called the patient)
   */
  async markCallbackDone(eventId) {
    const event = this.callbackEvents?.find(e => e.id === eventId);
    if (!event) {
      // Maybe it's still in calendar, find from all events
      const calEvent = this.events.find(e => e.id === eventId);
      if (!calEvent) return;
    }
    
    const eventToUse = event || this.events.find(e => e.id === eventId);
    const patientName = (eventToUse.title || '').replace(/^[🔔⏳✅\s]+/, '').trim();
    
    const confirmed = confirm(`Маркирай "${patientName}" като обаден и изтрий от списъка?`);
    if (!confirmed) return;
    
    try {
      // Delete the calendar event
      const response = await API.deleteCalendarEvent(eventId);
      
      if (response.success) {
        Utils.showToast(`${patientName} е маркиран като обаден`, 'success');
        
        // Remove from callback list
        if (this.callbackEvents) {
          this.callbackEvents = this.callbackEvents.filter(e => e.id !== eventId);
        }
        
        // Remove from DOM
        const card = document.querySelector(`.callback-request-card[data-event-id="${eventId}"]`);
        if (card) card.remove();
        
        this.updateCallbackSection();
        await this.loadEvents();
        this.renderView();
      } else {
        throw new Error(response.error || 'Грешка');
      }
    } catch (error) {
      console.error('Error marking callback done:', error);
      Utils.showToast('Грешка: ' + error.message, 'error');
    }
  },

  /**
   * Delete a callback event without marking as done
   */
  async deleteCallbackEvent(eventId) {
    const event = this.callbackEvents?.find(e => e.id === eventId);
    const eventToUse = event || this.events.find(e => e.id === eventId);
    if (!eventToUse) return;
    
    const patientName = (eventToUse.title || '').replace(/^[🔔⏳✅\s]+/, '').trim();
    
    const confirmed = confirm(`Сигурни ли сте, че искате да изтриете "${patientName}" от списъка за обаждане?`);
    if (!confirmed) return;
    
    try {
      const response = await API.deleteCalendarEvent(eventId);
      
      if (response.success) {
        Utils.showToast(`${patientName} е изтрит`, 'success');
        
        if (this.callbackEvents) {
          this.callbackEvents = this.callbackEvents.filter(e => e.id !== eventId);
        }
        
        const card = document.querySelector(`.callback-request-card[data-event-id="${eventId}"]`);
        if (card) card.remove();
        
        this.updateCallbackSection();
        await this.loadEvents();
        this.renderView();
      } else {
        throw new Error(response.error || 'Грешка');
      }
    } catch (error) {
      console.error('Error deleting callback:', error);
      Utils.showToast('Грешка: ' + error.message, 'error');
    }
  },

  /**
   * Reject a pending request
   */
  async rejectPendingRequest(eventId) {
    const event = this.pendingEvents.find(e => e.id === eventId);
    if (!event) return;
    
    const patientName = (event.title || '').replace(/^[⏳✅\s]+/, '').trim();
    
    // Extract phone number from description
    const phoneMatch = (event.description || '').match(/📞\s*Тел:\s*([0-9+\s]+)/);
    const patientPhone = phoneMatch ? phoneMatch[1].replace(/\s/g, '') : null;
    
    const confirmed = confirm(`Сигурни ли сте, че искате да откажете часа за ${patientName}?`);
    if (!confirmed) return;
    
    try {
      const response = await API.deleteCalendarEvent(eventId);
      
      if (response.success) {
        Utils.showToast(`Часът за ${patientName} е отказан и изтрит.`, 'success');
        
        // Send rejection SMS to patient
        if (patientPhone) {
          const formattedDate = new Date(event.date).toLocaleDateString('bg-BG', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });
          
          API.sendSMS({
            phone: patientPhone,
            template: 'booking_rejected',
            date: formattedDate,
            time: event.startTime,
            patientName: patientName
          }).catch(err => console.warn('SMS error:', err));
        }
        
        // Immediately remove from local array and DOM
        this.pendingEvents = this.pendingEvents.filter(e => e.id !== eventId);
        const card = document.querySelector(`.pending-request-card[data-event-id="${eventId}"]`);
        if (card) card.remove();
        this.updatePendingRequestsSection();
        // Also reload current view events
        await this.loadEvents();
        this.renderView();
      } else {
        throw new Error(response.error || 'Грешка при отказване');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      Utils.showToast('Грешка при отказване: ' + error.message, 'error');
    }
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
                <select name="startTime" required>
                  <option value="08:00">08:00</option>
                  <option value="08:15">08:15</option>
                  <option value="08:30">08:30</option>
                  <option value="08:45">08:45</option>
                  <option value="09:00" selected>09:00</option>
                  <option value="09:15">09:15</option>
                  <option value="09:30">09:30</option>
                  <option value="09:45">09:45</option>
                  <option value="10:00">10:00</option>
                  <option value="10:15">10:15</option>
                  <option value="10:30">10:30</option>
                  <option value="10:45">10:45</option>
                  <option value="11:00">11:00</option>
                  <option value="11:15">11:15</option>
                  <option value="11:30">11:30</option>
                  <option value="11:45">11:45</option>
                  <option value="12:00">12:00</option>
                  <option value="12:15">12:15</option>
                  <option value="12:30">12:30</option>
                  <option value="12:45">12:45</option>
                  <option value="13:00">13:00</option>
                  <option value="13:15">13:15</option>
                  <option value="13:30">13:30</option>
                  <option value="13:45">13:45</option>
                  <option value="14:00">14:00</option>
                  <option value="14:15">14:15</option>
                  <option value="14:30">14:30</option>
                  <option value="14:45">14:45</option>
                  <option value="15:00">15:00</option>
                  <option value="15:15">15:15</option>
                  <option value="15:30">15:30</option>
                  <option value="15:45">15:45</option>
                  <option value="16:00">16:00</option>
                  <option value="16:15">16:15</option>
                  <option value="16:30">16:30</option>
                  <option value="16:45">16:45</option>
                  <option value="17:00">17:00</option>
                  <option value="17:15">17:15</option>
                  <option value="17:30">17:30</option>
                  <option value="17:45">17:45</option>
                  <option value="18:00">18:00</option>
                </select>
              </div>
            </div>
            <div class="event-form__row">
              <div class="form-group">
                <label>Продължителност</label>
                <select name="duration">
                  <option value="15">15 минути</option>
                  <option value="30" selected>30 минути</option>
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
      
      // Set color if exists (use colorId from API)
      const eventColor = event.colorId || event.color;
      if (eventColor) {
        document.querySelectorAll('.color-picker__option').forEach(b => b.classList.remove('active'));
        const colorBtn = document.querySelector(`.color-picker__option--${eventColor}`);
        if (colorBtn) {
          colorBtn.classList.add('active');
          form.colorId.value = eventColor;
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
    
    // DEBUG: Log what we're sending
    console.log('Submitting event data:', data);
    console.log('colorId from form:', formData.get('colorId'));
    
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

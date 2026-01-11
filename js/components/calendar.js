/**
 * Calendar Component
 * Shared calendar UI for booking and admin
 */

const Calendar = {
  container: null,
  currentDate: new Date(),
  selectedDate: null,
  onDateSelect: null,
  markedDates: {},
  minDate: null,
  maxDate: null,

  /**
   * Initialize calendar
   * @param {HTMLElement|string} container - Container element or selector
   * @param {Object} options - Calendar options
   */
  init(container, options = {}) {
    if (typeof container === 'string') {
      this.container = document.querySelector(container);
    } else {
      this.container = container;
    }

    if (!this.container) {
      Utils.error('Calendar container not found');
      return;
    }

    const {
      onDateSelect = null,
      selectedDate = null,
      markedDates = {},
      minDate = null,
      maxDate = null,
      showNavigation = true
    } = options;

    this.onDateSelect = onDateSelect;
    this.selectedDate = selectedDate ? new Date(selectedDate) : null;
    this.markedDates = markedDates;
    this.minDate = minDate ? new Date(minDate) : null;
    this.maxDate = maxDate ? new Date(maxDate) : null;
    this.showNavigation = showNavigation;

    if (this.selectedDate) {
      this.currentDate = new Date(this.selectedDate);
    }

    this.render();
  },

  /**
   * Render the calendar
   */
  render() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const monthNames = CONFIG.I18N.MONTHS;
    const dayNames = CONFIG.I18N.DAYS_SHORT;

    let html = `
      <div class="calendar">
        ${this.showNavigation ? `
        <div class="calendar__header">
          <button class="calendar__nav calendar__nav--prev" aria-label="Предишен месец">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <span class="calendar__title">${monthNames[month]} ${year}</span>
          <button class="calendar__nav calendar__nav--next" aria-label="Следващ месец">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
        ` : `
        <div class="calendar__header">
          <span class="calendar__title">${monthNames[month]} ${year}</span>
        </div>
        `}
        <div class="calendar__grid">
          <div class="calendar__weekdays">
            ${dayNames.map(day => `<div class="calendar__weekday">${day}</div>`).join('')}
          </div>
          <div class="calendar__days">
            ${this.renderDays(year, month)}
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.attachEvents();
  },

  /**
   * Render calendar days
   * @param {number} year - Year
   * @param {number} month - Month (0-indexed)
   * @returns {string} HTML string
   */
  renderDays(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = (firstDay.getDay() + 6) % 7; // Monday = 0
    const totalDays = lastDay.getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let html = '';

    // Empty cells for days before first day of month
    for (let i = 0; i < startDay; i++) {
      html += '<div class="calendar__day calendar__day--empty"></div>';
    }

    // Days of the month
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      const dateStr = Utils.formatDateISO(date);
      const isToday = date.getTime() === today.getTime();
      const isSelected = this.selectedDate && 
                         date.getTime() === new Date(this.selectedDate).setHours(0,0,0,0);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isPast = date < today;
      const isDisabled = this.isDateDisabled(date);
      const marked = this.markedDates[dateStr];

      let classes = ['calendar__day'];
      if (isToday) classes.push('calendar__day--today');
      if (isSelected) classes.push('calendar__day--selected');
      if (isWeekend) classes.push('calendar__day--weekend');
      if (isPast) classes.push('calendar__day--past');
      if (isDisabled) classes.push('calendar__day--disabled');
      if (marked) {
        classes.push('calendar__day--marked');
        if (marked.type) classes.push(`calendar__day--${marked.type}`);
      }

      html += `
        <div class="${classes.join(' ')}" 
             data-date="${dateStr}"
             ${isDisabled ? 'aria-disabled="true"' : ''}>
          <span class="calendar__day-number">${day}</span>
          ${marked && marked.count ? `<span class="calendar__day-badge">${marked.count}</span>` : ''}
        </div>
      `;
    }

    return html;
  },

  /**
   * Check if date is disabled
   * @param {Date} date - Date to check
   * @returns {boolean}
   */
  isDateDisabled(date) {
    // Check min/max bounds
    if (this.minDate && date < this.minDate) return true;
    if (this.maxDate && date > this.maxDate) return true;

    // Weekends are disabled for booking
    const day = date.getDay();
    if (day === 0 || day === 6) return true;

    return false;
  },

  /**
   * Attach event listeners
   */
  attachEvents() {
    // Navigation buttons
    const prevBtn = this.container.querySelector('.calendar__nav--prev');
    const nextBtn = this.container.querySelector('.calendar__nav--next');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.prevMonth());
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextMonth());
    }

    // Day click
    const days = this.container.querySelectorAll('.calendar__day:not(.calendar__day--empty):not(.calendar__day--disabled)');
    days.forEach(day => {
      day.addEventListener('click', () => {
        const dateStr = day.dataset.date;
        this.selectDate(dateStr);
      });
    });
  },

  /**
   * Go to previous month
   */
  prevMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.render();
  },

  /**
   * Go to next month
   */
  nextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.render();
  },

  /**
   * Go to specific month
   * @param {number} year - Year
   * @param {number} month - Month (0-indexed)
   */
  goToMonth(year, month) {
    this.currentDate = new Date(year, month, 1);
    this.render();
  },

  /**
   * Select a date
   * @param {string|Date} date - Date to select
   */
  selectDate(date) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if disabled
    if (this.isDateDisabled(dateObj)) return;

    this.selectedDate = dateObj;

    // Update UI
    const days = this.container.querySelectorAll('.calendar__day');
    days.forEach(day => {
      day.classList.remove('calendar__day--selected');
      if (day.dataset.date === Utils.formatDate(dateObj, 'iso')) {
        day.classList.add('calendar__day--selected');
      }
    });

    // Callback
    if (this.onDateSelect) {
      this.onDateSelect(dateObj, Utils.formatDate(dateObj, 'iso'));
    }
  },

  /**
   * Set marked dates
   * @param {Object} markedDates - Object with date strings as keys
   */
  setMarkedDates(markedDates) {
    this.markedDates = markedDates;
    this.render();
  },

  /**
   * Mark a single date
   * @param {string} dateStr - Date string (YYYY-MM-DD)
   * @param {Object} data - Mark data (type, count, etc.)
   */
  markDate(dateStr, data) {
    this.markedDates[dateStr] = data;
    this.render();
  },

  /**
   * Clear all marks
   */
  clearMarks() {
    this.markedDates = {};
    this.render();
  },

  /**
   * Get selected date
   * @returns {Date|null}
   */
  getSelectedDate() {
    return this.selectedDate;
  },

  /**
   * Set min date
   * @param {Date|string} date - Minimum selectable date
   */
  setMinDate(date) {
    this.minDate = date ? new Date(date) : null;
    this.render();
  },

  /**
   * Set max date
   * @param {Date|string} date - Maximum selectable date
   */
  setMaxDate(date) {
    this.maxDate = date ? new Date(date) : null;
    this.render();
  },

  /**
   * Destroy calendar instance
   */
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.onDateSelect = null;
    this.markedDates = {};
  }
};

/**
 * Time Slots Component
 * Display available time slots for a date
 */
const TimeSlots = {
  container: null,
  selectedSlot: null,
  onSlotSelect: null,
  slots: [],

  /**
   * Initialize time slots
   * @param {HTMLElement|string} container - Container element or selector
   * @param {Object} options - Options
   */
  init(container, options = {}) {
    if (typeof container === 'string') {
      this.container = document.querySelector(container);
    } else {
      this.container = container;
    }

    if (!this.container) {
      Utils.error('TimeSlots container not found');
      return;
    }

    const {
      slots = [],
      onSlotSelect = null,
      selectedSlot = null
    } = options;

    this.slots = slots;
    this.onSlotSelect = onSlotSelect;
    this.selectedSlot = selectedSlot;

    this.render();
  },

  /**
   * Render time slots
   */
  render() {
    if (this.slots.length === 0) {
      this.container.innerHTML = `
        <div class="time-slots time-slots--empty">
          <p class="time-slots__message">Няма свободни часове за избраната дата</p>
        </div>
      `;
      return;
    }

    const morningSlots = this.slots.filter(s => {
      const hour = parseInt(s.time.split(':')[0]);
      return hour < 12;
    });

    const afternoonSlots = this.slots.filter(s => {
      const hour = parseInt(s.time.split(':')[0]);
      return hour >= 12;
    });

    let html = '<div class="time-slots">';

    if (morningSlots.length > 0) {
      html += `
        <div class="time-slots__group">
          <h4 class="time-slots__group-title">Сутрин</h4>
          <div class="time-slots__grid">
            ${morningSlots.map(slot => this.renderSlot(slot)).join('')}
          </div>
        </div>
      `;
    }

    if (afternoonSlots.length > 0) {
      html += `
        <div class="time-slots__group">
          <h4 class="time-slots__group-title">Следобед</h4>
          <div class="time-slots__grid">
            ${afternoonSlots.map(slot => this.renderSlot(slot)).join('')}
          </div>
        </div>
      `;
    }

    html += '</div>';
    this.container.innerHTML = html;
    this.attachEvents();
  },

  /**
   * Render a single slot
   * @param {Object} slot - Slot data
   * @returns {string} HTML string
   */
  renderSlot(slot) {
    const isSelected = this.selectedSlot === slot.time;
    const isDisabled = !slot.available;

    let classes = ['time-slot'];
    if (isSelected) classes.push('time-slot--selected');
    if (isDisabled) classes.push('time-slot--disabled');

    return `
      <button class="${classes.join(' ')}" 
              data-time="${slot.time}"
              ${isDisabled ? 'disabled' : ''}>
        ${slot.time}
      </button>
    `;
  },

  /**
   * Attach event listeners
   */
  attachEvents() {
    const slots = this.container.querySelectorAll('.time-slot:not(.time-slot--disabled)');
    slots.forEach(slot => {
      slot.addEventListener('click', () => {
        this.selectSlot(slot.dataset.time);
      });
    });
  },

  /**
   * Select a time slot
   * @param {string} time - Time string (HH:MM)
   */
  selectSlot(time) {
    this.selectedSlot = time;

    // Update UI
    const slots = this.container.querySelectorAll('.time-slot');
    slots.forEach(slot => {
      slot.classList.remove('time-slot--selected');
      if (slot.dataset.time === time) {
        slot.classList.add('time-slot--selected');
      }
    });

    // Callback
    if (this.onSlotSelect) {
      this.onSlotSelect(time);
    }
  },

  /**
   * Update slots
   * @param {Array} slots - New slots array
   */
  setSlots(slots) {
    this.slots = slots;
    this.selectedSlot = null;
    this.render();
  },

  /**
   * Show loading state
   */
  showLoading() {
    this.container.innerHTML = `
      <div class="time-slots time-slots--loading">
        <div class="loading">
          <div class="loading__spinner"></div>
          <p class="loading__text">Зареждане на часове...</p>
        </div>
      </div>
    `;
  },

  /**
   * Get selected slot
   * @returns {string|null}
   */
  getSelectedSlot() {
    return this.selectedSlot;
  },

  /**
   * Destroy instance
   */
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.onSlotSelect = null;
    this.slots = [];
  }
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Calendar, TimeSlots };
}

// Main Application for Rodopi Dent PWA

const App = {
  /**
   * Initialize the application
   */
  init() {
    console.log(`${CONFIG.APP_NAME} v${CONFIG.APP_VERSION} initializing...`);
    
    // Initialize modules
    Auth.init();
    this.setupRoutes();
    this.setupEventListeners();
    this.setupOfflineDetection();
    
    // Start router
    Router.init();
    
    console.log('App initialized successfully');
  },

  /**
   * Setup all routes
   */
  setupRoutes() {
    // Public routes
    Router.register('/', () => this.renderHome());
    Router.register('/booking', () => this.renderBooking());
    
    // Admin routes
    Router.register('/admin', () => this.renderAdminLogin());
    Router.register('/admin/dashboard', Router.requireAuth(() => this.renderDashboard()));
    Router.register('/admin/calendar', Router.requireAuth(() => this.renderCalendar()));
    Router.register('/admin/finance', Router.requireAuth(() => this.renderFinance()));
    Router.register('/admin/settings', Router.requireAuth(() => this.renderSettings()));
  },

  /**
   * Setup global event listeners
   */
  setupEventListeners() {
    // Mobile menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    const mobileNav = document.getElementById('mobile-nav');
    
    if (menuToggle && mobileNav) {
      menuToggle.addEventListener('click', () => {
        mobileNav.hidden = !mobileNav.hidden;
      });
      
      // Close on backdrop click
      mobileNav.querySelector('.mobile-nav__backdrop')?.addEventListener('click', () => {
        mobileNav.hidden = true;
      });
      
      // Close on link click
      mobileNav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
          mobileNav.hidden = true;
        });
      });
    }
  },

  /**
   * Setup offline detection
   */
  setupOfflineDetection() {
    const indicator = document.getElementById('offline-indicator');
    
    const updateStatus = () => {
      if (indicator) {
        indicator.hidden = navigator.onLine;
      }
    };
    
    window.addEventListener('online', () => {
      updateStatus();
      Utils.showToast('Връзката е възстановена', 'success');
      // TODO: Sync pending changes
    });
    
    window.addEventListener('offline', () => {
      updateStatus();
      Utils.showToast('Работите офлайн', 'warning');
    });
    
    updateStatus();
  },

  // ============================================
  // Page Renderers
  // ============================================

  /**
   * Render home page
   */
  renderHome() {
    Router.render('page-home');
  },

  /**
   * Render booking page
   */
  renderBooking() {
    Router.render('page-booking');
    this.initBookingCalendar();
  },

  /**
   * Initialize booking calendar
   */
  initBookingCalendar() {
    const calendarEl = document.getElementById('booking-calendar');
    if (!calendarEl) return;

    // Simple calendar implementation
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    this.renderCalendarMonth(calendarEl, currentYear, currentMonth);
  },

  /**
   * Render calendar month
   */
  renderCalendarMonth(container, year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay() || 7; // Monday = 1

    const monthNames = [
      'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
      'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'
    ];

    let html = `
      <div class="calendar">
        <div class="calendar__header">
          <button class="calendar__nav" data-action="prev">&lt;</button>
          <span class="calendar__title">${monthNames[month]} ${year}</span>
          <button class="calendar__nav" data-action="next">&gt;</button>
        </div>
        <div class="calendar__weekdays">
          <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Нд</span>
        </div>
        <div class="calendar__days">
    `;

    // Empty cells before first day
    for (let i = 1; i < startingDay; i++) {
      html += '<span class="calendar__day calendar__day--empty"></span>';
    }

    // Days of month
    const today = Utils.today();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = date === today;
      const isPast = date < today;
      const isWorkingDay = Utils.isWorkingDay(date);
      
      let classes = 'calendar__day';
      if (isToday) classes += ' calendar__day--today';
      if (isPast) classes += ' calendar__day--past';
      if (!isWorkingDay) classes += ' calendar__day--disabled';
      
      html += `<span class="${classes}" data-date="${date}">${day}</span>`;
    }

    html += '</div></div>';
    container.innerHTML = html;

    // Add event listeners
    container.querySelectorAll('.calendar__day:not(.calendar__day--disabled):not(.calendar__day--past)').forEach(day => {
      day.addEventListener('click', (e) => {
        const date = e.target.dataset.date;
        this.selectBookingDate(date);
      });
    });

    container.querySelectorAll('.calendar__nav').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        let newMonth = month;
        let newYear = year;
        
        if (action === 'prev') {
          newMonth--;
          if (newMonth < 0) {
            newMonth = 11;
            newYear--;
          }
        } else {
          newMonth++;
          if (newMonth > 11) {
            newMonth = 0;
            newYear++;
          }
        }
        
        this.renderCalendarMonth(container, newYear, newMonth);
      });
    });
  },

  /**
   * Select a date for booking
   */
  async selectBookingDate(date) {
    const slotsEl = document.getElementById('booking-slots');
    if (!slotsEl) return;

    // Highlight selected date
    document.querySelectorAll('.calendar__day').forEach(day => {
      day.classList.remove('calendar__day--selected');
    });
    document.querySelector(`[data-date="${date}"]`)?.classList.add('calendar__day--selected');

    // Show loading
    slotsEl.innerHTML = '<p>Зареждане на свободни часове...</p>';

    // Get available slots
    const response = await API.getSlots(date);
    
    if (response.success && response.data) {
      this.renderTimeSlots(slotsEl, date, response.data);
    } else {
      // Show default slots in demo/offline mode
      const defaultSlots = Utils.getTimeSlots();
      this.renderTimeSlots(slotsEl, date, defaultSlots);
    }
  },

  /**
   * Render available time slots
   */
  renderTimeSlots(container, date, slots) {
    if (!slots || slots.length === 0) {
      container.innerHTML = '<p class="text-muted">Няма свободни часове за тази дата</p>';
      return;
    }

    let html = `<h3>Свободни часове за ${Utils.formatDateBG(date)}</h3><div class="time-slots">`;
    
    slots.forEach(slot => {
      const time = typeof slot === 'string' ? slot : slot.time;
      html += `<button class="time-slot" data-time="${time}">${Utils.formatTime(time)}</button>`;
    });
    
    html += '</div>';
    container.innerHTML = html;

    // Add click handlers
    container.querySelectorAll('.time-slot').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const time = e.target.dataset.time;
        this.selectTimeSlot(date, time);
      });
    });
  },

  /**
   * Select a time slot
   */
  selectTimeSlot(date, time) {
    // Highlight selected slot
    document.querySelectorAll('.time-slot').forEach(slot => {
      slot.classList.remove('time-slot--selected');
    });
    document.querySelector(`[data-time="${time}"]`)?.classList.add('time-slot--selected');

    // Show booking form
    const form = document.getElementById('booking-form');
    if (form) {
      form.hidden = false;
      form.dataset.date = date;
      form.dataset.time = time;
      
      // Setup form submission
      form.onsubmit = (e) => this.handleBookingSubmit(e);
    }
  },

  /**
   * Handle booking form submission
   */
  async handleBookingSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    const bookingData = {
      patientName: formData.get('patientName'),
      patientPhone: formData.get('patientPhone'),
      reason: formData.get('reason') || '',
      date: form.dataset.date,
      startTime: form.dataset.time,
      duration: CONFIG.DEFAULT_DURATION
    };

    // Validate phone
    if (!Utils.validatePhone(bookingData.patientPhone)) {
      Utils.showToast('Невалиден телефонен номер', 'error');
      return;
    }

    // Submit booking
    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Изпращане...';

    const response = await API.createBooking(bookingData);

    if (response.success) {
      Utils.showToast('Резервацията е успешна! Ще получите SMS потвърждение.', 'success');
      form.reset();
      form.hidden = true;
      Router.navigate('/');
    } else {
      Utils.showToast(response.message || 'Грешка при резервацията', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Потвърди резервацията';
    }
  },

  /**
   * Render admin login page
   */
  renderAdminLogin() {
    if (Auth.isAuthenticated()) {
      Router.navigate('/admin/dashboard');
      return;
    }

    Router.render('page-admin-login');

    const loginBtn = document.getElementById('google-login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => Auth.signInWithGoogle());
    }
  },

  /**
   * Render admin dashboard
   */
  async renderDashboard() {
    Router.render('page-admin-dashboard');
    this.setupAdminNav();
    this.setupLogout();

    // Load today's appointments
    const response = await API.getAppointments({ date: Utils.today() });
    
    const todayList = document.getElementById('today-list');
    if (todayList && response.success && response.data) {
      this.renderAppointmentsList(todayList, response.data);
    }
  },

  /**
   * Setup admin navigation
   */
  setupAdminNav() {
    const currentPath = window.location.hash.slice(1);
    document.querySelectorAll('.admin-nav__link').forEach(link => {
      const href = link.getAttribute('href')?.replace('#', '');
      link.classList.toggle('active', href === currentPath);
    });
  },

  /**
   * Setup logout button
   */
  setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => Auth.signOut());
    }
  },

  /**
   * Render appointments list
   */
  renderAppointmentsList(container, appointments) {
    if (!appointments || appointments.length === 0) {
      container.innerHTML = '<p class="text-muted" style="padding: 1rem;">Няма записи</p>';
      return;
    }

    let html = '';
    appointments.forEach(apt => {
      html += `
        <div class="appointment-item" style="padding: 1rem; border-bottom: 1px solid var(--color-gray-200);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>${apt.patientName}</strong>
              <span style="color: var(--color-gray-500); margin-left: 0.5rem;">${Utils.formatTime(apt.startTime)}</span>
            </div>
            <span style="background: ${Utils.getStatusColor(apt.status)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">
              ${Utils.getStatusLabel(apt.status)}
            </span>
          </div>
          ${apt.reason ? `<p style="color: var(--color-gray-500); margin-top: 0.25rem; font-size: 0.875rem;">${apt.reason}</p>` : ''}
        </div>
      `;
    });
    
    container.innerHTML = html;
  },

  /**
   * Render calendar page (placeholder)
   */
  renderCalendar() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page page--admin">
        <h1>📅 Календар</h1>
        <p class="text-muted">Календарът ще бъде имплементиран в следваща версия.</p>
      </div>
    `;
  },

  /**
   * Render finance page (placeholder)
   */
  renderFinance() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page page--admin">
        <h1>💰 Финанси</h1>
        <p class="text-muted">Финансовият модул ще бъде имплементиран в следваща версия.</p>
      </div>
    `;
  },

  /**
   * Render settings page (placeholder)
   */
  renderSettings() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page page--admin">
        <h1>⚙️ Настройки</h1>
        <p class="text-muted">Настройките ще бъдат имплементирани в следваща версия.</p>
      </div>
    `;
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());

// Export for use
window.App = App;

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
    Router.register('/admin/login', () => this.renderAdminLogin());
    Router.register('/admin/dashboard', Router.requireAuth(async () => await this.renderDashboard()));
    Router.register('/admin/calendar', Router.requireAuth(async () => await this.renderCalendar()));
    Router.register('/admin/finance', Router.requireAuth(async () => await this.renderFinance()));
    Router.register('/admin/settings', Router.requireAuth(async () => await this.renderSettings()));
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
      
      // Show booking summary
      const summary = document.getElementById('booking-summary');
      if (summary) {
        summary.innerHTML = `
          <p><strong>📅 Дата:</strong> ${Utils.formatDateBG(date)}</p>
          <p><strong>🕐 Час:</strong> ${Utils.formatTime(time)}</p>
          <p><strong>⏱️ Продължителност:</strong> ${CONFIG.DEFAULT_DURATION} минути</p>
        `;
      }
      
      // Scroll to form
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
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

    const todayList = document.getElementById('today-list');
    if (!todayList) return;

    try {
      // Load today's appointments
      todayList.innerHTML = '<p style="padding: 1rem; color: var(--color-gray-500);">Зареждане...</p>';
      
      const response = await API.getAppointments({ date: Utils.today() });
      
      if (response.success && response.data) {
        this.renderAppointmentsList(todayList, response.data);
      } else {
        console.log('Dashboard API response:', response);
        todayList.innerHTML = '<p style="padding: 1rem; color: var(--color-gray-500);">Няма записи за днес</p>';
      }
    } catch (error) {
      console.error('Dashboard error:', error);
      todayList.innerHTML = '<p style="padding: 1rem; color: var(--color-gray-500);">Няма записи за днес</p>';
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
   * Render calendar page - full appointments calendar
   */
  async renderCalendar() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page page--admin">
        <div class="admin-header">
          <h1>📅 Календар</h1>
        </div>
        <div class="admin-content">
          <div class="calendar-container">
            <div id="admin-calendar" class="admin-calendar"></div>
            <div id="day-appointments" class="day-appointments">
              <h3>Записи</h3>
              <p class="text-muted">Изберете дата от календара</p>
            </div>
          </div>
        </div>
      </div>
    `;
    this.initAdminCalendar();
  },

  /**
   * Initialize admin calendar
   */
  initAdminCalendar() {
    const calendarEl = document.getElementById('admin-calendar');
    if (!calendarEl) return;

    const today = new Date();
    this.renderAdminCalendarMonth(calendarEl, today.getFullYear(), today.getMonth());
  },

  /**
   * Render admin calendar month
   */
  renderAdminCalendarMonth(container, year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay() || 7;

    const monthNames = [
      'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
      'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'
    ];

    let html = `
      <div class="calendar calendar--admin">
        <div class="calendar__header">
          <button class="calendar__nav btn btn--icon" data-action="prev">◀</button>
          <span class="calendar__title">${monthNames[month]} ${year}</span>
          <button class="calendar__nav btn btn--icon" data-action="next">▶</button>
        </div>
        <div class="calendar__weekdays">
          <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Нд</span>
        </div>
        <div class="calendar__days">
    `;

    for (let i = 1; i < startingDay; i++) {
      html += '<span class="calendar__day calendar__day--empty"></span>';
    }

    const today = Utils.today();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = date === today;
      const isWorkingDay = Utils.isWorkingDay(date);
      
      let classes = 'calendar__day';
      if (isToday) classes += ' calendar__day--today';
      if (!isWorkingDay) classes += ' calendar__day--weekend';
      
      html += `<span class="${classes}" data-date="${date}">${day}</span>`;
    }

    html += '</div></div>';
    container.innerHTML = html;

    // Event listeners
    container.querySelectorAll('.calendar__day:not(.calendar__day--empty)').forEach(day => {
      day.addEventListener('click', (e) => {
        document.querySelectorAll('.calendar__day').forEach(d => d.classList.remove('calendar__day--selected'));
        e.target.classList.add('calendar__day--selected');
        this.loadDayAppointments(e.target.dataset.date);
      });
    });

    container.querySelectorAll('.calendar__nav').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        let newMonth = month + (action === 'prev' ? -1 : 1);
        let newYear = year;
        
        if (newMonth < 0) { newMonth = 11; newYear--; }
        if (newMonth > 11) { newMonth = 0; newYear++; }
        
        this.renderAdminCalendarMonth(container, newYear, newMonth);
      });
    });

    // Auto-select today
    const todayEl = container.querySelector('.calendar__day--today');
    if (todayEl) {
      todayEl.classList.add('calendar__day--selected');
      this.loadDayAppointments(today);
    }
  },

  /**
   * Load appointments for a specific day
   */
  async loadDayAppointments(date) {
    const container = document.getElementById('day-appointments');
    if (!container) return;

    container.innerHTML = `<h3>Записи за ${Utils.formatDateBG(date)}</h3><p>Зареждане...</p>`;

    const response = await API.getAppointments({ date });
    
    if (response.success && response.data && response.data.length > 0) {
      let html = `<h3>Записи за ${Utils.formatDateBG(date)}</h3>`;
      html += '<div class="appointments-list">';
      
      response.data.sort((a, b) => a.startTime.localeCompare(b.startTime));
      
      response.data.forEach(apt => {
        html += `
          <div class="appointment-card" data-id="${apt.id}">
            <div class="appointment-card__time">${Utils.formatTime(apt.startTime)}</div>
            <div class="appointment-card__info">
              <strong>${apt.patientName}</strong>
              <span>${apt.patientPhone}</span>
              ${apt.reason ? `<small>${apt.reason}</small>` : ''}
            </div>
            <div class="appointment-card__status">
              <span class="status-badge status-badge--${apt.status}">${Utils.getStatusLabel(apt.status)}</span>
              <div class="appointment-card__actions">
                ${apt.status === 'pending' ? `<button class="btn btn--sm btn--success" onclick="App.updateStatus('${apt.id}', 'confirmed')">✓</button>` : ''}
                ${apt.status === 'confirmed' ? `<button class="btn btn--sm btn--primary" onclick="App.updateStatus('${apt.id}', 'completed')">✓✓</button>` : ''}
                ${apt.status !== 'cancelled' && apt.status !== 'completed' ? `<button class="btn btn--sm btn--danger" onclick="App.updateStatus('${apt.id}', 'cancelled')">✗</button>` : ''}
              </div>
            </div>
          </div>
        `;
      });
      
      html += '</div>';
      container.innerHTML = html;
    } else {
      container.innerHTML = `<h3>Записи за ${Utils.formatDateBG(date)}</h3><p class="text-muted">Няма записи за тази дата</p>`;
    }
  },

  /**
   * Update appointment status
   */
  async updateStatus(appointmentId, status) {
    const response = await API.updateAppointmentStatus(appointmentId, status);
    
    if (response.success) {
      Utils.showToast('Статусът е обновен', 'success');
      // Reload current day
      const selectedDate = document.querySelector('.calendar__day--selected')?.dataset.date;
      if (selectedDate) {
        this.loadDayAppointments(selectedDate);
      }
    } else {
      Utils.showToast('Грешка при обновяване', 'error');
    }
  },

  /**
   * Render finance page
   */
  async renderFinance() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page page--admin">
        <div class="admin-header">
          <h1>💰 Финанси</h1>
          <button id="add-finance-btn" class="btn btn--primary">+ Добави запис</button>
        </div>
        
        <div class="finance-filters">
          <div class="filter-group">
            <label>От дата:</label>
            <input type="date" id="finance-start" value="${Utils.formatDateISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}">
          </div>
          <div class="filter-group">
            <label>До дата:</label>
            <input type="date" id="finance-end" value="${Utils.today()}">
          </div>
          <div class="filter-group">
            <label>Тип:</label>
            <select id="finance-type">
              <option value="">Всички</option>
              <option value="official">Официални</option>
              <option value="custom">Собствени</option>
            </select>
          </div>
          <button id="filter-finance-btn" class="btn btn--secondary">Филтрирай</button>
        </div>

        <div class="finance-summary" id="finance-summary">
          <div class="summary-card">
            <span class="summary-label">Общо:</span>
            <span class="summary-value" id="total-amount">0.00 лв.</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">Официални:</span>
            <span class="summary-value" id="official-amount">0.00 лв.</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">Собствени:</span>
            <span class="summary-value" id="custom-amount">0.00 лв.</span>
          </div>
        </div>

        <div id="finance-list" class="finance-list">
          <p>Зареждане...</p>
        </div>
      </div>

      <!-- Add Finance Modal -->
      <div id="finance-modal" class="modal" hidden>
        <div class="modal__backdrop"></div>
        <div class="modal__content">
          <h2>Добави финансов запис</h2>
          <form id="finance-form">
            <div class="form-group">
              <label>Дата</label>
              <input type="date" name="date" value="${Utils.today()}" required>
            </div>
            <div class="form-group">
              <label>Тип</label>
              <select name="type" required>
                <option value="official">Официален</option>
                <option value="custom">Собствен</option>
              </select>
            </div>
            <div class="form-group">
              <label>Сума (лв.)</label>
              <input type="number" name="amount" step="0.01" min="0" required>
            </div>
            <div class="form-group">
              <label>Описание</label>
              <input type="text" name="description" placeholder="Процедура, пациент...">
            </div>
            <div class="form-group">
              <label>Метод на плащане</label>
              <select name="paymentMethod">
                <option value="cash">В брой</option>
                <option value="card">С карта</option>
                <option value="bank_transfer">Банков превод</option>
              </select>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn--secondary" onclick="App.closeFinanceModal()">Отказ</button>
              <button type="submit" class="btn btn--primary">Запази</button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.setupFinanceListeners();
    this.loadFinanceData();
  },

  /**
   * Setup finance page listeners
   */
  setupFinanceListeners() {
    document.getElementById('add-finance-btn')?.addEventListener('click', () => {
      document.getElementById('finance-modal').hidden = false;
    });

    document.getElementById('finance-modal')?.querySelector('.modal__backdrop')?.addEventListener('click', () => {
      this.closeFinanceModal();
    });

    document.getElementById('finance-form')?.addEventListener('submit', (e) => this.handleFinanceSubmit(e));

    document.getElementById('filter-finance-btn')?.addEventListener('click', () => this.loadFinanceData());
  },

  /**
   * Close finance modal
   */
  closeFinanceModal() {
    document.getElementById('finance-modal').hidden = true;
    document.getElementById('finance-form')?.reset();
  },

  /**
   * Load finance data
   */
  async loadFinanceData() {
    const startDate = document.getElementById('finance-start')?.value;
    const endDate = document.getElementById('finance-end')?.value;
    const type = document.getElementById('finance-type')?.value;

    const listEl = document.getElementById('finance-list');
    
    try {
      const response = await API.getFinance({ startDate, endDate, type });

      if (response.success && response.data) {
        const records = response.data.records || response.data || [];
        
        // Update summary
        let totalOfficial = 0, totalCustom = 0;
        if (Array.isArray(records)) {
          records.forEach(r => {
            if (r.type === 'official') totalOfficial += parseFloat(r.amount) || 0;
            else totalCustom += parseFloat(r.amount) || 0;
          });
        }

        document.getElementById('total-amount').textContent = `${(totalOfficial + totalCustom).toFixed(2)} лв.`;
        document.getElementById('official-amount').textContent = `${totalOfficial.toFixed(2)} лв.`;
        document.getElementById('custom-amount').textContent = `${totalCustom.toFixed(2)} лв.`;

        if (!Array.isArray(records) || records.length === 0) {
          listEl.innerHTML = '<p class="text-muted">Няма записи за избрания период</p>';
          return;
        }

        let html = '<table class="finance-table"><thead><tr><th>Дата</th><th>Описание</th><th>Тип</th><th>Плащане</th><th>Сума</th></tr></thead><tbody>';
        
        records.forEach(r => {
          const typeLabel = r.type === 'official' ? '📋 Официален' : '📝 Собствен';
          const paymentLabel = { cash: 'В брой', card: 'Карта', bank_transfer: 'Превод' }[r.paymentMethod] || '-';
          html += `
            <tr>
              <td>${Utils.formatDateBG(r.date)}</td>
              <td>${r.description || '-'}</td>
              <td>${typeLabel}</td>
              <td>${paymentLabel}</td>
              <td class="text-right"><strong>${parseFloat(r.amount).toFixed(2)} лв.</strong></td>
            </tr>
          `;
        });

        html += '</tbody></table>';
        listEl.innerHTML = html;
      } else {
        console.log('Finance API response:', response);
        listEl.innerHTML = '<p class="text-muted">Няма записи за избрания период</p>';
      }
    } catch (error) {
      console.error('Finance load error:', error);
      listEl.innerHTML = '<p class="text-muted">Няма записи за избрания период</p>';
    }
  },

  /**
   * Handle finance form submit
   */
  async handleFinanceSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const data = {
      date: formData.get('date'),
      type: formData.get('type'),
      amount: parseFloat(formData.get('amount')),
      description: formData.get('description'),
      paymentMethod: formData.get('paymentMethod')
    };

    const response = await API.addFinance(data);

    if (response.success) {
      Utils.showToast('Записът е добавен', 'success');
      this.closeFinanceModal();
      this.loadFinanceData();
    } else {
      Utils.showToast('Грешка при добавяне', 'error');
    }
  },

  /**
   * Render settings page
   */
  async renderSettings() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page page--admin">
        <div class="admin-header">
          <h1>⚙️ Настройки</h1>
        </div>
        
        <div class="settings-container">
          <form id="settings-form" class="settings-form">
            <div class="settings-section">
              <h3>📍 Информация за клиниката</h3>
              <div class="form-group">
                <label>Име на клиниката</label>
                <input type="text" name="clinicName" id="s-clinicName" value="Родопи Дент">
              </div>
              <div class="form-group">
                <label>Адрес</label>
                <input type="text" name="clinicAddress" id="s-clinicAddress" value="">
              </div>
              <div class="form-group">
                <label>Телефон</label>
                <input type="text" name="clinicPhone" id="s-clinicPhone" value="">
              </div>
              <div class="form-group">
                <label>Email</label>
                <input type="email" name="clinicEmail" id="s-clinicEmail" value="">
              </div>
            </div>

            <div class="settings-section">
              <h3>🕐 Работно време</h3>
              <div class="time-row">
                <div class="form-group">
                  <label>Сутрин от:</label>
                  <input type="time" name="morningStart" id="s-morningStart" value="09:00">
                </div>
                <div class="form-group">
                  <label>до:</label>
                  <input type="time" name="morningEnd" id="s-morningEnd" value="12:00">
                </div>
              </div>
              <div class="time-row">
                <div class="form-group">
                  <label>Следобед от:</label>
                  <input type="time" name="afternoonStart" id="s-afternoonStart" value="13:30">
                </div>
                <div class="form-group">
                  <label>до:</label>
                  <input type="time" name="afternoonEnd" id="s-afternoonEnd" value="17:00">
                </div>
              </div>
              <div class="form-group">
                <label>Продължителност на час (мин):</label>
                <input type="number" name="defaultDuration" id="s-defaultDuration" value="60" min="15" step="15">
              </div>
            </div>

            <div class="settings-section">
              <h3>📱 SMS Известия</h3>
              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" name="smsEnabled" id="s-smsEnabled">
                  <span>Изпращай SMS при резервация</span>
                </label>
              </div>
              <div class="form-group">
                <label>Twilio телефон</label>
                <input type="text" name="twilioPhone" id="s-twilioPhone" placeholder="+359...">
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn--primary btn--lg">💾 Запази настройките</button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.loadSettings();
    document.getElementById('settings-form')?.addEventListener('submit', (e) => this.handleSettingsSave(e));
  },

  /**
   * Load settings from API
   */
  async loadSettings() {
    const response = await API.getSettings();
    
    if (response.success && response.data) {
      const settings = response.data;
      
      // Fill form fields
      if (settings.clinicName) document.getElementById('s-clinicName').value = settings.clinicName;
      if (settings.clinicAddress) document.getElementById('s-clinicAddress').value = settings.clinicAddress;
      if (settings.clinicPhone) document.getElementById('s-clinicPhone').value = settings.clinicPhone;
      if (settings.clinicEmail) document.getElementById('s-clinicEmail').value = settings.clinicEmail;
      if (settings.defaultDuration) document.getElementById('s-defaultDuration').value = settings.defaultDuration;
      if (settings.twilioPhone) document.getElementById('s-twilioPhone').value = settings.twilioPhone;
      document.getElementById('s-smsEnabled').checked = settings.smsEnabled === 'true' || settings.smsEnabled === true;

      // Parse working hours if JSON
      if (settings.workingHours) {
        try {
          const hours = typeof settings.workingHours === 'string' ? JSON.parse(settings.workingHours) : settings.workingHours;
          if (hours.morning) {
            document.getElementById('s-morningStart').value = hours.morning.start;
            document.getElementById('s-morningEnd').value = hours.morning.end;
          }
          if (hours.afternoon) {
            document.getElementById('s-afternoonStart').value = hours.afternoon.start;
            document.getElementById('s-afternoonEnd').value = hours.afternoon.end;
          }
        } catch (e) {}
      }
    }
  },

  /**
   * Handle settings save
   */
  async handleSettingsSave(e) {
    e.preventDefault();
    
    const settings = {
      clinicName: document.getElementById('s-clinicName').value,
      clinicAddress: document.getElementById('s-clinicAddress').value,
      clinicPhone: document.getElementById('s-clinicPhone').value,
      clinicEmail: document.getElementById('s-clinicEmail').value,
      defaultDuration: document.getElementById('s-defaultDuration').value,
      smsEnabled: document.getElementById('s-smsEnabled').checked.toString(),
      twilioPhone: document.getElementById('s-twilioPhone').value,
      workingHours: JSON.stringify({
        morning: {
          start: document.getElementById('s-morningStart').value,
          end: document.getElementById('s-morningEnd').value
        },
        afternoon: {
          start: document.getElementById('s-afternoonStart').value,
          end: document.getElementById('s-afternoonEnd').value
        }
      })
    };

    const response = await API.updateSettings(settings);

    if (response.success) {
      Utils.showToast('Настройките са запазени', 'success');
    } else {
      Utils.showToast('Грешка при запазване', 'error');
    }
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());

// Export for use
window.App = App;

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
    Router.register('/admin/workday', Router.requireAuth(async () => await this.renderWorkday()));
    Router.register('/admin/calendar', Router.requireAuth(async () => await this.renderCalendarPage()));
    Router.register('/admin/finance', Router.requireAuth(async () => await this.renderWorkday())); // Redirect to workday
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

    // Show loading state
    slotsEl.innerHTML = '<p class="text-muted">Зареждане на свободни часове...</p>';

    // Get available slots from API (already filtered for booked appointments)
    try {
      const response = await API.getSlots(date);
      if (response.success && response.data && response.data.slots) {
        // API returns pre-filtered available slots
        this.renderTimeSlots(slotsEl, date, response.data.slots);
      } else if (response.success && response.data && response.data.message) {
        // Non-working day or other message
        slotsEl.innerHTML = `<p class="text-muted">${response.data.message}</p>`;
      } else {
        // API error - show message, don't show all slots (prevents double booking)
        slotsEl.innerHTML = '<p class="text-error">⚠️ Грешка при зареждане. Моля, опитайте отново.</p>';
      }
    } catch (error) {
      console.error('Error loading slots:', error);
      slotsEl.innerHTML = '<p class="text-error">⚠️ Грешка при зареждане. Моля, опитайте отново.</p>';
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
      
      // Update booking summary based on duration selection
      const updateSummary = () => {
        const durationSelect = document.getElementById('appointment-duration');
        const duration = durationSelect ? durationSelect.value : CONFIG.DEFAULT_DURATION;
        const summary = document.getElementById('booking-summary');
        if (summary) {
          summary.innerHTML = `
            <p><strong>📅 Дата:</strong> ${Utils.formatDateBG(date)}</p>
            <p><strong>🕐 Час:</strong> ${Utils.formatTime(time)}</p>
            <p><strong>⏱️ Продължителност:</strong> ${duration} минути</p>
          `;
        }
      };
      
      updateSummary();
      
      // Listen for duration changes
      const durationSelect = document.getElementById('appointment-duration');
      if (durationSelect) {
        durationSelect.onchange = updateSummary;
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
      duration: parseInt(formData.get('duration')) || CONFIG.DEFAULT_DURATION
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
      // Show confirmation message
      this.showBookingConfirmation(bookingData);
      form.reset();
      form.hidden = true;
    } else {
      Utils.showToast(response.message || 'Грешка при резервацията', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Потвърди резервацията';
    }
  },

  /**
   * Show booking confirmation message to patient
   */
  showBookingConfirmation(bookingData) {
    const container = document.querySelector('.booking-page') || document.querySelector('.page');
    if (!container) {
      Utils.showToast('✅ Заявката е приета и чака одобрение от доктора!', 'success');
      setTimeout(() => Router.navigate('/'), 3000);
      return;
    }
    
    // Format date nicely
    const dateObj = new Date(bookingData.date);
    const formattedDate = dateObj.toLocaleDateString('bg-BG', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    
    container.innerHTML = `
      <div class="booking-confirmation">
        <div class="booking-confirmation__icon">✅</div>
        <h2>Заявката е приета!</h2>
        <p class="booking-confirmation__subtitle">Чака одобрение от доктора</p>
        
        <div class="booking-confirmation__details">
          <div class="booking-confirmation__row">
            <span class="label">📅 Дата:</span>
            <span class="value">${formattedDate}</span>
          </div>
          <div class="booking-confirmation__row">
            <span class="label">🕐 Час:</span>
            <span class="value">${bookingData.startTime}</span>
          </div>
          <div class="booking-confirmation__row">
            <span class="label">👤 Име:</span>
            <span class="value">${bookingData.patientName}</span>
          </div>
          <div class="booking-confirmation__row">
            <span class="label">📱 Телефон:</span>
            <span class="value">${bookingData.patientPhone}</span>
          </div>
        </div>
        
        <div class="booking-confirmation__note">
          <p>📱 <strong>Ще получите SMS</strong> когато докторът потвърди вашия час.</p>
          <p>Ако не получите отговор до края на деня, ще се свържем с вас по телефона.</p>
        </div>
        
        <a href="#/" class="btn btn--primary btn--lg">
          ← Назад към началото
        </a>
      </div>
    `;
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
    this.setupDashboardListeners();
    
    // Load data for today by default
    this.dashboardPeriod = 'today';
    await this.loadDashboardData('today');
  },

  /**
   * Setup dashboard event listeners
   */
  setupDashboardListeners() {
    // Period buttons - with inline style updates
    const activeStyle = 'padding:16px 28px;font-size:16px;font-weight:600;border-radius:16px;border:2px solid #1d4ed8;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:white;cursor:pointer;box-shadow:0 6px 20px rgba(37,99,235,0.4);';
    const inactiveStyle = 'padding:16px 28px;font-size:16px;font-weight:600;border-radius:16px;border:2px solid #e2e8f0;background:white;color:#475569;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.06);';
    
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const button = e.target.closest('.period-btn');
        if (!button) return;
        
        const period = button.dataset.period;
        if (!period) return;
        
        // Update active state and styles
        document.querySelectorAll('.period-btn').forEach(b => {
          b.classList.remove('active');
          b.style.cssText = inactiveStyle;
        });
        button.classList.add('active');
        button.style.cssText = activeStyle;
        
        // Show/hide custom date range
        const customRange = document.getElementById('custom-date-range');
        if (period === 'custom') {
          customRange.hidden = false;
          customRange.style.display = 'flex';
        } else {
          customRange.hidden = true;
          customRange.style.display = 'none';
          this.dashboardPeriod = period;
          await this.loadDashboardData(period);
        }
      });
    });
    
    // Apply custom date range
    document.getElementById('apply-date-range')?.addEventListener('click', async () => {
      const fromDate = document.getElementById('date-from').value;
      const toDate = document.getElementById('date-to').value;
      
      if (fromDate && toDate) {
        await this.loadDashboardData('custom', fromDate, toDate);
      } else {
        Utils.showToast('Моля въведете и двете дати', 'warning');
      }
    });
    
    // Set default dates for custom range
    const dateFrom = document.getElementById('date-from');
    const dateTo = document.getElementById('date-to');
    if (dateFrom && dateTo) {
      dateFrom.value = Utils.today();
      dateTo.value = Utils.today();
    }
  },

  /**
   * Load dashboard data for a period
   */
  async loadDashboardData(period, customFrom = null, customTo = null) {
    const today = Utils.today();
    let startDate, endDate;
    
    switch (period) {
      case 'today':
        startDate = endDate = today;
        break;
      case 'week':
        // Get Monday of current week
        const date = new Date(today);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(date.setDate(diff)).toISOString().split('T')[0];
        endDate = today;
        break;
      case 'month':
        startDate = today.substring(0, 7) + '-01'; // First day of month
        endDate = today;
        break;
      case 'custom':
        startDate = customFrom;
        endDate = customTo;
        break;
    }
    
    try {
      // Fetch finance data
      const response = await API.getFinance({ startDate, endDate });
      const records = response.data?.records || [];
      
      // Calculate totals
      let totalIncome = 0, totalExpense = 0;
      const incomeByCategory = {};
      const expenseByCategory = {};
      const patients = new Set();
      
      records.forEach(r => {
        const amount = parseFloat(r.amount) || 0;
        
        if (r.type === 'income') {
          totalIncome += amount;
          const cat = r.category || 'other';
          incomeByCategory[cat] = (incomeByCategory[cat] || 0) + amount;
          if (r.patientName) patients.add(r.patientName);
        } else if (r.type === 'expense') {
          totalExpense += amount;
          const cat = r.category || 'other';
          expenseByCategory[cat] = (expenseByCategory[cat] || 0) + amount;
        }
      });
      
      // Update stats
      document.getElementById('stat-income').textContent = `${totalIncome.toFixed(2)} €`;
      document.getElementById('stat-expense').textContent = `${totalExpense.toFixed(2)} €`;
      
      const balance = totalIncome - totalExpense;
      const balanceEl = document.getElementById('stat-balance');
      balanceEl.textContent = `${balance.toFixed(2)} €`;
      balanceEl.style.color = balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
      
      document.getElementById('stat-patients').textContent = patients.size;
      
      // Render breakdowns
      this.renderCategoryBreakdown('income-breakdown', incomeByCategory, 'income');
      this.renderCategoryBreakdown('expense-breakdown', expenseByCategory, 'expense');
      
      // Render recent records
      this.renderRecentRecords(records.slice(0, 10));
      
    } catch (error) {
      console.error('Dashboard load error:', error);
      document.getElementById('stat-income').textContent = '0.00 €';
      document.getElementById('stat-expense').textContent = '0.00 €';
      document.getElementById('stat-balance').textContent = '0.00 €';
      document.getElementById('stat-patients').textContent = '0';
    }
  },

  /**
   * Render category breakdown
   */
  renderCategoryBreakdown(containerId, data, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const categoryLabels = {
      nhif: '🏥 НЗОК',
      private: '💎 Частни',
      materials: '🧪 Материали',
      lab: '🔬 Лаборатория',
      utilities: '💡 Комунални',
      rent: '🏢 Наем',
      salary: '👤 Заплати',
      other: '📦 Други'
    };
    
    const entries = Object.entries(data);
    if (entries.length === 0) {
      container.innerHTML = '<p class="text-muted">Няма данни</p>';
      return;
    }
    
    // Sort by amount descending
    entries.sort((a, b) => b[1] - a[1]);
    
    const total = entries.reduce((sum, [, val]) => sum + val, 0);
    
    let html = '';
    entries.forEach(([cat, amount]) => {
      const percent = total > 0 ? (amount / total * 100).toFixed(0) : 0;
      html += `
        <div class="breakdown-item">
          <div class="breakdown-label">${categoryLabels[cat] || cat}</div>
          <div class="breakdown-bar">
            <div class="breakdown-fill ${type}" style="width: ${percent}%"></div>
          </div>
          <div class="breakdown-value">${amount.toFixed(2)} € (${percent}%)</div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  },

  /**
   * Render recent finance records
   */
  renderRecentRecords(records) {
    const container = document.getElementById('recent-records');
    if (!container) return;
    
    // Store records for editing
    this.dashboardRecords = records;
    
    if (records.length === 0) {
      container.innerHTML = '<p class="text-muted">Няма записи</p>';
      return;
    }
    
    let html = '<table class="records-table"><thead><tr><th>Дата</th><th>Описание</th><th>Категория</th><th>Сума</th><th style="width:60px">Редакция</th></tr></thead><tbody>';
    
    records.forEach((r, index) => {
      const isIncome = r.type === 'income';
      const icon = isIncome ? '💰' : '💸';
      const amountClass = isIncome ? 'amount--positive' : 'amount--negative';
      const categoryIcon = this.getCategoryIcon(r.category);
      
      html += `
        <tr>
          <td>${Utils.formatDateBG(r.date)}</td>
          <td>${icon} ${r.description || 'Без описание'} ${r.patientName ? `<small>(${r.patientName})</small>` : ''}</td>
          <td>${categoryIcon} ${r.category || '-'}</td>
          <td class="${amountClass}">${isIncome ? '+' : '-'}${parseFloat(r.amount).toFixed(2)} €</td>
          <td style="text-align:center">
            <button type="button" class="btn btn--icon edit-record-btn" data-index="${index}" title="Редактирай">
              ✏️
            </button>
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
    
    // Add edit button listeners
    container.querySelectorAll('.edit-record-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.closest('.edit-record-btn').dataset.index);
        this.openEditFinanceModal(this.dashboardRecords[index]);
      });
    });
  },

  /**
   * Open edit finance modal
   */
  openEditFinanceModal(record) {
    // Remove existing modal if any
    document.getElementById('edit-finance-modal')?.remove();
    
    const isIncome = record.type === 'income';
    const categoryOptions = isIncome ? `
      <option value="nhif" ${record.category === 'nhif' ? 'selected' : ''}>🏥 НЗОК</option>
      <option value="private" ${record.category === 'private' ? 'selected' : ''}>💎 Частни</option>
      <option value="other" ${record.category === 'other' ? 'selected' : ''}>📦 Други</option>
    ` : `
      <option value="materials" ${record.category === 'materials' ? 'selected' : ''}>🧪 Материали</option>
      <option value="lab" ${record.category === 'lab' ? 'selected' : ''}>🔬 Лаборатория</option>
      <option value="utilities" ${record.category === 'utilities' ? 'selected' : ''}>💡 Комунални</option>
      <option value="rent" ${record.category === 'rent' ? 'selected' : ''}>🏢 Наем</option>
      <option value="salary" ${record.category === 'salary' ? 'selected' : ''}>👤 Заплати</option>
      <option value="other" ${record.category === 'other' ? 'selected' : ''}>📦 Други</option>
    `;
    
    const serviceCategoryOptions = isIncome ? `
      <div class="form-group">
        <label class="form-group__label">Категория услуга</label>
        <select id="edit-serviceCategory" class="form-group__input">
          <option value="" ${!record.serviceCategory ? 'selected' : ''}>-- Без --</option>
          <option value="Прегледи" ${record.serviceCategory === 'Прегледи' ? 'selected' : ''}>Прегледи</option>
          <option value="Терапия" ${record.serviceCategory === 'Терапия' ? 'selected' : ''}>Терапия</option>
          <option value="Протетика" ${record.serviceCategory === 'Протетика' ? 'selected' : ''}>Протетика</option>
          <option value="Хирургия" ${record.serviceCategory === 'Хирургия' ? 'selected' : ''}>Хирургия</option>
          <option value="Ортодонтия" ${record.serviceCategory === 'Ортодонтия' ? 'selected' : ''}>Ортодонтия</option>
          <option value="Профилактика" ${record.serviceCategory === 'Профилактика' ? 'selected' : ''}>Профилактика</option>
          <option value="Други" ${record.serviceCategory === 'Други' ? 'selected' : ''}>Други</option>
        </select>
      </div>
    ` : '';
    
    const remainingPaymentField = isIncome ? `
      <div class="form-group">
        <label class="form-group__label">Остатък за плащане (дълг)</label>
        <input type="number" id="edit-remainingPayment" class="form-group__input" 
               value="${record.remainingPayment || 0}" min="0" step="0.01">
      </div>
    ` : '';
    
    const modalHtml = `
      <div id="edit-finance-modal" class="modal" style="display:flex">
        <div class="modal__backdrop"></div>
        <div class="modal__content" style="max-width:500px">
          <div class="modal__header">
            <h2 class="modal__title">${isIncome ? '💰 Редакция на приход' : '💸 Редакция на разход'}</h2>
            <button type="button" class="modal__close" id="close-edit-modal">&times;</button>
          </div>
          <form id="edit-finance-form" class="modal__body">
            <input type="hidden" id="edit-record-id" value="${record.id}">
            <input type="hidden" id="edit-record-type" value="${record.type}">
            
            <div class="form-group">
              <label class="form-group__label">Дата</label>
              <input type="text" class="form-group__input" value="${Utils.formatDateBG(record.date)}" readonly disabled>
            </div>
            
            ${record.patientName ? `
            <div class="form-group">
              <label class="form-group__label">Пациент</label>
              <input type="text" class="form-group__input" value="${record.patientName}" readonly disabled>
            </div>
            ` : ''}
            
            <div class="form-group">
              <label class="form-group__label">Категория</label>
              <select id="edit-category" class="form-group__input">
                ${categoryOptions}
              </select>
            </div>
            
            ${serviceCategoryOptions}
            
            <div class="form-group">
              <label class="form-group__label">Описание</label>
              <input type="text" id="edit-description" class="form-group__input" value="${record.description || ''}">
            </div>
            
            <div class="form-group">
              <label class="form-group__label">Сума (€)</label>
              <input type="number" id="edit-amount" class="form-group__input" 
                     value="${record.amount || 0}" min="0" step="0.01" required>
            </div>
            
            ${remainingPaymentField}
            
            <div class="form-group">
              <label class="form-group__label">Начин на плащане</label>
              <select id="edit-paymentMethod" class="form-group__input">
                <option value="cash" ${record.paymentMethod === 'cash' ? 'selected' : ''}>💵 В брой</option>
                <option value="bank" ${record.paymentMethod === 'bank' ? 'selected' : ''}>🏦 Банка</option>
              </select>
            </div>
            
            <div class="modal__footer" style="margin-top:1.5rem;display:flex;gap:1rem;justify-content:flex-end">
              <button type="button" class="btn btn--secondary" id="cancel-edit-btn">Отказ</button>
              <button type="submit" class="btn btn--primary">💾 Запази</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Close modal handlers
    const closeModal = () => document.getElementById('edit-finance-modal')?.remove();
    document.getElementById('close-edit-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-edit-btn').addEventListener('click', closeModal);
    document.getElementById('edit-finance-modal').addEventListener('click', (e) => {
      if (e.target.id === 'edit-finance-modal') closeModal();
    });
    
    // Form submit handler
    document.getElementById('edit-finance-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleEditFinanceSubmit(record);
    });
  },

  /**
   * Handle edit finance form submission
   */
  async handleEditFinanceSubmit(originalRecord) {
    const id = document.getElementById('edit-record-id').value;
    const isIncome = document.getElementById('edit-record-type').value === 'income';
    
    const updates = {
      category: document.getElementById('edit-category').value,
      description: document.getElementById('edit-description').value,
      amount: parseFloat(document.getElementById('edit-amount').value) || 0,
      paymentMethod: document.getElementById('edit-paymentMethod').value
    };
    
    // Add income-specific fields
    if (isIncome) {
      const serviceCategory = document.getElementById('edit-serviceCategory')?.value;
      const remainingPayment = document.getElementById('edit-remainingPayment')?.value;
      if (serviceCategory !== undefined) updates.serviceCategory = serviceCategory;
      if (remainingPayment !== undefined) updates.remainingPayment = parseFloat(remainingPayment) || 0;
    }
    
    try {
      Utils.showLoading();
      await API.updateFinanceRecord(id, updates);
      Utils.hideLoading();
      Utils.showToast('✅ Записът е обновен успешно!', 'success');
      
      // Close modal and reload data
      document.getElementById('edit-finance-modal')?.remove();
      await this.loadDashboardData(this.dashboardPeriod);
      
    } catch (error) {
      Utils.hideLoading();
      console.error('Edit finance error:', error);
      Utils.showToast('❌ Грешка при обновяване', 'error');
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

  // ============================================
  // GOOGLE CALENDAR PAGE - Full Calendar View
  // ============================================

  /**
   * Render Google Calendar page with day/week/month views
   */
  async renderCalendarPage() {
    const main = document.getElementById('main-content');
    
    main.innerHTML = `
      <div class="page page--admin page--calendar">
        <div class="admin-header">
          <h1>📆 Календар</h1>
          <div class="header-actions">
            <button id="logout-btn" class="btn btn--outline">Изход</button>
          </div>
        </div>
        <nav class="admin-nav">
          <a href="#/admin/dashboard" class="admin-nav__link">Табло</a>
          <a href="#/admin/workday" class="admin-nav__link">Работен ден</a>
          <a href="#/admin/calendar" class="admin-nav__link active">Календар</a>
          <a href="#/admin/settings" class="admin-nav__link">Настройки</a>
        </nav>
        
        <div id="calendar-container" class="calendar-page-container">
          <p class="text-muted">Зареждане на календар...</p>
        </div>
      </div>
    `;
    
    this.setupLogout();
    
    // Initialize full calendar view
    const container = document.getElementById('calendar-container');
    if (container && window.Calendar) {
      await Calendar.render(container, 'week');
    }
  },

  // ============================================
  // WORKDAY PAGE - Combined Calendar + Finance
  // ============================================

  /**
   * Render combined Workday page (Calendar + Finance)
   */
  async renderWorkday() {
    const main = document.getElementById('main-content');
    const today = Utils.today();
    
    main.innerHTML = `
      <div class="page page--admin page--workday">
        <div class="admin-header">
          <h1>📅 Работен ден</h1>
          <div class="header-actions">
            <button id="add-income-btn" class="btn btn--success">💰 Приход</button>
            <button id="add-expense-btn" class="btn btn--danger">💸 Разход</button>
            <button id="logout-btn" class="btn btn--outline">Изход</button>
          </div>
        </div>
        <nav class="admin-nav">
          <a href="#/admin/dashboard" class="admin-nav__link">Табло</a>
          <a href="#/admin/workday" class="admin-nav__link active">Работен ден</a>
          <a href="#/admin/calendar" class="admin-nav__link">📆 Календар</a>
          <a href="#/admin/settings" class="admin-nav__link">Настройки</a>
        </nav>
        
        <div class="workday-layout">
          <!-- Left: Calendar -->
          <div class="workday-calendar">
            <div id="admin-calendar" class="admin-calendar"></div>
            
            <!-- Patients with outstanding debt panel -->
            <div id="debt-panel" style="margin-top:16px;background:#fef3c7;border:2px solid #f59e0b;border-radius:10px;padding:12px;">
              <h4 style="margin:0 0 10px 0;font-size:14px;color:#92400e;display:flex;align-items:center;gap:6px;">
                💳 Пациенти с дължими суми
              </h4>
              <div id="debt-list" style="max-height:200px;overflow-y:auto;">
                <p style="color:#a16207;font-size:12px;text-align:center;">Зареждане...</p>
              </div>
            </div>
          </div>
          
          <!-- Center: Day Appointments -->
          <div class="workday-appointments">
            <div class="workday-section-header">
              <h3 id="appointments-date-title">Пациенти за ${Utils.formatDateBG(today)}</h3>
            </div>
            <div id="day-appointments-list" class="appointments-list">
              <p class="text-muted">Зареждане...</p>
            </div>
          </div>
          
          <!-- Right: Day Finance -->
          <div class="workday-finance">
            <div class="workday-section-header">
              <h3>💰 Финанси за деня</h3>
            </div>
            
            <!-- Search by patient name -->
            <div style="margin-bottom:10px;">
              <input type="text" id="finance-search-input" placeholder="🔍 Търси по име на пациент..." style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;">
            </div>
            
            <!-- Filter buttons -->
            <div style="display:flex;gap:4px;margin-bottom:10px;">
              <button type="button" class="finance-filter-btn active" data-filter="all" style="flex:1;padding:6px 8px;background:#e2e8f0;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;">Всички</button>
              <button type="button" class="finance-filter-btn" data-filter="nhif" style="flex:1;padding:6px 8px;background:#f1f5f9;border:none;border-radius:4px;cursor:pointer;font-size:11px;">🏥 НЗОК</button>
              <button type="button" class="finance-filter-btn" data-filter="patient" style="flex:1;padding:6px 8px;background:#f1f5f9;border:none;border-radius:4px;cursor:pointer;font-size:11px;">💎 Доплащане</button>
            </div>
            
            <div class="finance-day-summary">
              <div class="finance-mini-stat income">
                <span class="label">Приходи:</span>
                <span class="value" id="day-income">0.00 €</span>
              </div>
              <div class="finance-mini-stat expense">
                <span class="label">Разходи:</span>
                <span class="value" id="day-expense">0.00 €</span>
              </div>
              <div class="finance-mini-stat total">
                <span class="label">Баланс:</span>
                <span class="value" id="day-balance">0.00 €</span>
              </div>
            </div>
            <div id="day-finance-list" class="finance-day-list">
              <p class="text-muted">Няма записи</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Income Modal with NHIF services + Custom entry -->
      <div id="income-modal" class="modal" hidden>
        <div class="modal__backdrop"></div>
        <div class="modal__content modal__content--wide">
          <h2>💰 Добави приход</h2>
          
          <!-- Patient Name Display (from appointment) or Input (manual) -->
          <div id="income-patient-display" style="background:linear-gradient(135deg,#dbeafe,#e0e7ff);border:2px solid #3b82f6;border-radius:10px;padding:12px;margin-bottom:12px;display:none;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:24px;">👤</span>
              <div>
                <div id="income-patient-name" style="font-weight:700;font-size:16px;color:#1e40af;"></div>
                <div id="income-patient-phone" style="font-size:12px;color:#6b7280;"></div>
              </div>
            </div>
          </div>
          
          <div id="income-patient-input-group" class="form-group" style="margin-bottom:12px;">
            <label style="font-weight:600;">👤 Име на пациент</label>
            <input type="text" id="income-patient-input" name="patientNameInput" placeholder="Въведете име на пациент..." style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;">
          </div>
          
          <!-- Tabs for NHIF / Custom -->
          <div class="income-tabs" style="display:flex;gap:4px;margin-bottom:12px;">
            <button type="button" class="income-tab active" data-tab="nhif" style="flex:1;padding:10px 16px;background:#2563eb;border:2px solid #2563eb;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;color:white;">🏥 НЗОК услуга</button>
            <button type="button" class="income-tab" data-tab="custom" style="flex:1;padding:10px 16px;background:#f1f5f9;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;color:#64748b;">✏️ Ръчно въвеждане</button>
          </div>
          
          <form id="income-form">
            <!-- NHIF Tab Content -->
            <div id="nhif-tab" class="income-tab-content active">
              <div class="form-group">
                <label>Възрастова група</label>
                <div class="age-toggle" style="display:flex;gap:4px;">
                  <button type="button" class="age-btn active" data-age="under18" style="flex:1;padding:8px 12px;background:#dbeafe;border:2px solid #2563eb;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;color:#2563eb;">Под 18 г.</button>
                  <button type="button" class="age-btn" data-age="over18" style="flex:1;padding:8px 12px;background:#f1f5f9;border:2px solid #e2e8f0;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;color:#64748b;">Над 18 г.</button>
                </div>
              </div>
              
              <div class="form-group">
                <label>НЗОК Услуги <small>(изберете една или повече)</small></label>
                <div id="nhif-services-container" class="nhif-services-list">
                  <p class="text-muted">Зареждане на услуги...</p>
                </div>
              </div>
              
              <div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:8px;padding:12px;margin:12px 0;">
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#475569;">
                  <span>НЗОК плаща:</span>
                  <strong id="nhif-fund-price" style="color:#374151;">0.00 €</strong>
                </div>
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#475569;border-bottom:1px dashed #cbd5e1;">
                  <span>Пациент доплаща (НЗОК):</span>
                  <strong id="nhif-patient-price" style="color:#374151;">0.00 €</strong>
                </div>
                
                <!-- Допълнително доплащане - ръчно въвеждане -->
                <div style="margin-top:10px;padding-top:10px;border-top:1px solid #d1fae5;">
                  <div style="font-size:12px;color:#059669;font-weight:600;margin-bottom:6px;">➕ Допълнително доплащане:</div>
                  <div style="display:flex;gap:8px;margin-bottom:6px;">
                    <input type="number" id="extra-patient-pay" name="extraPatientPay" step="0.01" min="0" placeholder="0.00" style="width:90px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;">
                    <span style="color:#6b7280;font-size:13px;line-height:32px;">€</span>
                  </div>
                  <input type="text" id="extra-patient-desc" name="extraPatientDesc" placeholder="Какво е доплатено..." style="width:100%;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;">
                </div>
                
                <div style="display:flex;justify-content:space-between;padding:8px 0 0;font-size:16px;font-weight:700;color:#22c55e;margin-top:8px;border-top:2px solid #22c55e;">
                  <span>Общо:</span>
                  <strong id="nhif-total-price" style="font-size:18px;">0.00 €</strong>
                </div>
              </div>
            </div>
            
            <!-- Custom Tab Content -->
            <div id="custom-tab" class="income-tab-content" hidden>
              <div class="form-group">
                <label>Сума (€)</label>
                <input type="number" name="customAmount" step="0.01" min="0" placeholder="0.00">
              </div>
              <div class="form-group">
                <label>Описание</label>
                <input type="text" name="customDescription" placeholder="Процедура, услуга...">
              </div>
            </div>
            
            <!-- Service Category Dropdown -->
            <div class="form-group">
              <label>📁 Категория услуга</label>
              <select name="serviceCategory" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;cursor:pointer;">
                <option value="">-- Изберете категория --</option>
                <option value="Прегледи">🔍 Прегледи</option>
                <option value="Терапия">💊 Терапия</option>
                <option value="Протетика">🦷 Протетика</option>
                <option value="Ортодонтия">📐 Ортодонтия</option>
                <option value="Пародонтология">🩺 Пародонтология</option>
                <option value="Деца Терапия">👶 Деца Терапия</option>
                <option value="Деца Ортодонтия">👶 Деца Ортодонтия</option>
              </select>
            </div>
            
            <!-- Common fields -->
            <div class="form-group">
              <label>Плащане</label>
              <div class="payment-toggle" style="display:flex;gap:4px;">
                <button type="button" class="payment-btn active" data-method="cash" style="flex:1;padding:8px 12px;background:#dcfce7;border:2px solid #22c55e;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;color:#22c55e;">💵 В брой</button>
                <button type="button" class="payment-btn" data-method="bank" style="flex:1;padding:8px 12px;background:#f1f5f9;border:2px solid #e2e8f0;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;color:#64748b;">🏦 По банков път</button>
              </div>
            </div>
            
            <!-- Remaining Payment - Expandable -->
            <div class="form-group">
              <button type="button" id="toggle-remaining-payment" onclick="App.toggleRemainingPayment()" style="display:flex;align-items:center;gap:6px;background:none;border:1px dashed #94a3b8;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:13px;color:#64748b;width:100%;justify-content:center;">
                <span id="remaining-payment-icon">➕</span> Остатък за доплащане
              </button>
              <div id="remaining-payment-section" style="display:none;margin-top:8px;padding:10px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;">
                <label style="font-size:12px;color:#92400e;font-weight:600;">💳 Остава пациентът да доплати:</label>
                <div style="display:flex;gap:8px;margin-top:6px;">
                  <input type="number" name="remainingPayment" step="0.01" min="0" placeholder="0.00" style="flex:1;padding:8px 10px;border:1px solid #fbbf24;border-radius:6px;font-size:14px;">
                  <span style="color:#92400e;font-size:14px;line-height:36px;font-weight:600;">€</span>
                </div>
              </div>
            </div>
            
            <input type="hidden" name="incomeType" value="nhif">
            <input type="hidden" name="paymentMethod" value="cash">
            <input type="hidden" name="ageGroup" value="under18">
            <input type="hidden" name="eventId" value="">
            <input type="hidden" name="patientName" value="">
            <input type="hidden" name="date" value="${today}">
            
            <div class="form-actions">
              <button type="button" class="btn btn--secondary" onclick="App.closeModal('income-modal')">Отказ</button>
              <button type="submit" class="btn btn--success">💾 Запази</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Expense Modal with cash/bank toggle -->
      <div id="expense-modal" class="modal" hidden>
        <div class="modal__backdrop"></div>
        <div class="modal__content">
          <h2>💸 Добави разход</h2>
          <form id="expense-form">
            <div class="form-group">
              <label>Контрагент / Доставчик</label>
              <input type="text" name="vendorName" placeholder="Име на фирма или лице..." required>
            </div>
            <div class="form-group">
              <label>Сума (€)</label>
              <input type="number" name="amount" step="0.01" min="0" required>
            </div>
            <div class="form-group">
              <label>Описание</label>
              <input type="text" name="description" placeholder="Материали, фактура, куриер...">
            </div>
            <div class="form-group">
              <label>Категория</label>
              <select name="category">
                <option value="materials">🧪 Материали</option>
                <option value="lab">🔬 Лаборатория</option>
                <option value="utilities">💡 Комунални</option>
                <option value="rent">🏢 Наем</option>
                <option value="salary">👤 Заплати</option>
                <option value="other">📦 Друго</option>
              </select>
            </div>
            <div class="form-group">
              <label>Плащане</label>
              <div class="payment-toggle" style="display:flex;gap:4px;">
                <button type="button" class="expense-payment-btn active" data-method="cash" style="flex:1;padding:10px 12px;background:#fee2e2;border:2px solid #ef4444;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;color:#ef4444;">💵 В брой</button>
                <button type="button" class="expense-payment-btn" data-method="bank" style="flex:1;padding:10px 12px;background:#f1f5f9;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;color:#64748b;">🏦 По банков път</button>
              </div>
            </div>
            <input type="hidden" name="paymentMethod" value="cash">
            <input type="hidden" name="date" value="${today}">
            <div class="form-actions">
              <button type="button" class="btn btn--secondary" onclick="App.closeModal('expense-modal')">Отказ</button>
              <button type="submit" class="btn btn--danger">💾 Запази</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Payment Modal (for clicking on appointment) - kept for backwards compatibility -->
      <div id="payment-modal" class="modal" hidden>
        <div class="modal__backdrop"></div>
        <div class="modal__content">
          <h2>💳 Запиши плащане</h2>
          <div id="payment-patient-info"></div>
          <form id="payment-form">
            <div class="form-group">
              <label>Сума (лв.)</label>
              <input type="number" name="amount" step="0.01" min="0" required autofocus>
            </div>
            <div class="form-group">
              <label>Плащане</label>
              <select name="paymentMethod">
                <option value="cash">В брой</option>
                <option value="card">С карта</option>
              </select>
            </div>
            <div class="form-group">
              <label>Бележка</label>
              <input type="text" name="note" placeholder="Допълнителна информация...">
            </div>
            <input type="hidden" name="appointmentId" value="">
            <input type="hidden" name="patientName" value="">
            <input type="hidden" name="date" value="${today}">
            <div class="form-actions">
              <button type="button" class="btn btn--secondary" onclick="App.closeModal('payment-modal')">Отказ</button>
              <button type="submit" class="btn btn--success">Запиши плащане</button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.setupLogout();
    this.setupWorkdayListeners();
    this.initAdminCalendar();
    
    // Store current selected date and load NHIF prices
    this.selectedDate = today;
    this.loadNHIFPrices();
  },

  // NHIF prices cache
  nhifPrices: {},

  /**
   * Load NHIF prices from API
   */
  async loadNHIFPrices() {
    try {
      const response = await API.getNHIFPrices();
      if (response.success && response.data) {
        // Transform array to object keyed by ID (not code!) for easy lookup
        const prices = response.data.prices || response.data || [];
        if (Array.isArray(prices)) {
          this.nhifPrices = {};
          prices.forEach(p => {
            // Use ID as key since codes can be duplicated (e.g. 101 for both under18 and over18)
            const key = p.id || `${p.code}_${p.priceUnder18 > 0 ? 'u18' : 'o18'}`;
            this.nhifPrices[key] = {
              id: p.id || key,
              code: p.code,
              name: p.name,
              priceUnder18: parseFloat(p.priceUnder18) || 0,
              priceOver18: parseFloat(p.priceOver18) || 0,
              patientPayUnder18: parseFloat(p.patientPayUnder18) || 0,
              patientPayOver18: parseFloat(p.patientPayOver18) || 0,
              category: p.category
            };
          });
        } else {
          this.nhifPrices = prices;
        }
        console.log('NHIF prices loaded:', Object.keys(this.nhifPrices).length);
      }
    } catch (error) {
      console.log('NHIF prices load error:', error);
    }
    
    // Always set fallback prices from import-nhif-prices.js (in EUR) - Актуализирано 2026
    if (!this.nhifPrices || Object.keys(this.nhifPrices).length === 0) {
      this.nhifPrices = {
        // ДО 18 ГОДИНИ
        '101_u18': { code: '101', name: 'Обстоен преглед със снемане на орален статус (до 18г.)', priceUnder18: 16.76, priceOver18: 0, patientPayUnder18: 0, patientPayOver18: 0, category: 'Преглед' },
        '301_u18': { code: '301', name: 'Обтурация с химичен композит (до 18г.)', priceUnder18: 45.67, priceOver18: 0, patientPayUnder18: 0, patientPayOver18: 0, category: 'Лечение' },
        '508': { code: '508', name: 'Екстракция на временен зъб с анестезия', priceUnder18: 18.35, priceOver18: 0, patientPayUnder18: 0, patientPayOver18: 0, category: 'Хирургия' },
        '509_u18': { code: '509', name: 'Екстракция на постоянен зъб с анестезия (до 18г.)', priceUnder18: 45.67, priceOver18: 0, patientPayUnder18: 0, patientPayOver18: 0, category: 'Хирургия' },
        '332': { code: '332', name: 'Лечение на пулпит или периодонтит на временен зъб', priceUnder18: 24.58, priceOver18: 0, patientPayUnder18: 0, patientPayOver18: 0, category: 'Ендодонтия' },
        '333': { code: '333', name: 'Лечение на пулпит или периодонтит на постоянен зъб', priceUnder18: 79.27, priceOver18: 0, patientPayUnder18: 0, patientPayOver18: 0, category: 'Ендодонтия' },
        // НАД 18 ГОДИНИ
        '101_o18': { code: '101', name: 'Обстоен преглед със снемане на орален статус (над 18г.)', priceUnder18: 0, priceOver18: 16.76, patientPayUnder18: 0, patientPayOver18: 0, category: 'Преглед' },
        '301_o18': { code: '301', name: 'Обтурация с химичен композит (над 18г.)', priceUnder18: 0, priceOver18: 43.63, patientPayUnder18: 0, patientPayOver18: 0, category: 'Лечение' },
        '509_o18': { code: '509', name: 'Екстракция на постоянен зъб с анестезия (над 18г.)', priceUnder18: 0, priceOver18: 43.63, patientPayUnder18: 0, patientPayOver18: 0, category: 'Хирургия' },
        '832': { code: '832', name: 'Горна цяла протеза', priceUnder18: 0, priceOver18: 146.88, patientPayUnder18: 0, patientPayOver18: 0, category: 'Протетика' },
        '833': { code: '833', name: 'Долна цяла протеза', priceUnder18: 0, priceOver18: 146.88, patientPayUnder18: 0, patientPayOver18: 0, category: 'Протетика' }
      };
      console.log('Using fallback NHIF prices (2026)');
    }
    
    // Populate NHIF services checkboxes
    this.populateNHIFServices();
  },

  /**
   * Populate NHIF services as checkboxes (supports multiple selection)
   * Filters by age group - only shows services with non-zero price for that group
   */
  populateNHIFServices(ageGroup = 'under18') {
    const container = document.getElementById('nhif-services-container');
    if (!container) return;
    
    // Style the container
    container.style.cssText = 'max-height:200px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:6px;background:white;';
    
    // Filter by age group - only show services with price > 0 for selected group
    const filteredPrices = Object.values(this.nhifPrices).filter(p => {
      if (ageGroup === 'under18') {
        return p.priceUnder18 > 0;
      } else {
        return p.priceOver18 > 0;
      }
    });
    
    // Group by category
    const byCategory = {};
    filteredPrices.forEach(p => {
      const cat = p.category || 'Други';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(p);
    });
    
    let html = '';
    Object.entries(byCategory).forEach(([category, services]) => {
      html += `<div style="margin:0;"><div style="background:#2563eb;color:white;padding:4px 8px;font-size:11px;font-weight:700;text-transform:uppercase;position:sticky;top:0;">${category}</div>`;
      services.forEach(s => {
        const price = ageGroup === 'under18' ? s.priceUnder18 : s.priceOver18;
        html += `
          <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;cursor:pointer;border-bottom:1px solid #f1f5f9;">
            <input type="checkbox" name="nhifServices" value="${s.id || s.code}" data-name="${s.name}" data-price="${price}" style="width:16px;height:16px;accent-color:#22c55e;">
            <span style="background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:3px;font-size:11px;font-weight:700;min-width:32px;text-align:center;">${s.code}</span>
            <span style="font-size:12px;color:#374151;line-height:1.2;flex:1;">${s.name}</span>
            <span style="font-size:11px;color:#22c55e;font-weight:600;">${price.toFixed(2)}€</span>
          </label>
        `;
      });
      html += '</div>';
    });
    
    container.innerHTML = html;
    
    // Add change listeners
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => this.updateNHIFPriceDisplay());
    });
    
    // Add listener for extra patient pay input
    document.getElementById('extra-patient-pay')?.addEventListener('input', () => this.updateNHIFPriceDisplay());
  },

  /**
   * Setup workday page event listeners
   */
  setupWorkdayListeners() {
    // Income button - opens modal in NHIF tab
    document.getElementById('add-income-btn')?.addEventListener('click', () => {
      this.openIncomeModal();
    });

    // Expense button
    document.getElementById('add-expense-btn')?.addEventListener('click', () => {
      document.getElementById('expense-modal').hidden = false;
      document.querySelector('#expense-form input[name="amount"]').focus();
    });

    // Modal backdrops
    document.querySelectorAll('.modal__backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', () => {
        backdrop.closest('.modal').hidden = true;
      });
    });

    // Income tabs
    document.querySelectorAll('.income-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        // Update styles
        document.querySelectorAll('.income-tab').forEach(t => {
          if (t.dataset.tab === tabName) {
            t.style.background = '#2563eb';
            t.style.borderColor = '#2563eb';
            t.style.color = 'white';
          } else {
            t.style.background = '#f1f5f9';
            t.style.borderColor = '#e2e8f0';
            t.style.color = '#64748b';
          }
        });
        this.switchIncomeTab(tabName);
      });
    });

    // Age group toggle
    document.querySelectorAll('.age-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.age-btn').forEach(b => {
          b.classList.remove('active');
          b.style.background = '#f1f5f9';
          b.style.borderColor = '#e2e8f0';
          b.style.color = '#64748b';
        });
        e.target.classList.add('active');
        e.target.style.background = '#dbeafe';
        e.target.style.borderColor = '#2563eb';
        e.target.style.color = '#2563eb';
        const ageGroup = e.target.dataset.age;
        document.querySelector('#income-form input[name="ageGroup"]').value = ageGroup;
        // Repopulate services for selected age group
        this.populateNHIFServices(ageGroup);
        this.updateNHIFPriceDisplay();
      });
    });

    // Payment method toggle (income)
    document.querySelectorAll('.payment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.payment-btn').forEach(b => {
          b.classList.remove('active');
          b.style.background = '#f1f5f9';
          b.style.borderColor = '#e2e8f0';
          b.style.color = '#64748b';
        });
        e.target.classList.add('active');
        e.target.style.background = '#dcfce7';
        e.target.style.borderColor = '#22c55e';
        e.target.style.color = '#22c55e';
        document.querySelector('#income-form input[name="paymentMethod"]').value = e.target.dataset.method;
      });
    });

    // Payment method toggle (expense)
    document.querySelectorAll('.expense-payment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.expense-payment-btn').forEach(b => {
          b.classList.remove('active');
          b.style.background = '#f1f5f9';
          b.style.borderColor = '#e2e8f0';
          b.style.color = '#64748b';
        });
        e.target.classList.add('active');
        e.target.style.background = '#fee2e2';
        e.target.style.borderColor = '#ef4444';
        e.target.style.color = '#ef4444';
        document.querySelector('#expense-form input[name="paymentMethod"]').value = e.target.dataset.method;
      });
    });

    // Income form
    document.getElementById('income-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleIncomeSubmit(e.target);
    });

    // Expense form
    document.getElementById('expense-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleExpenseSubmit(e.target);
    });

    // Payment form (legacy)
    document.getElementById('payment-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handlePaymentSubmit(e.target);
    });
  },

  /**
   * Open income modal (general or for specific patient)
   */
  openIncomeModal(eventId = '', patientName = '', patientPhone = '') {
    const modal = document.getElementById('income-modal');
    const patientDisplay = document.getElementById('income-patient-display');
    const patientInputGroup = document.getElementById('income-patient-input-group');
    const patientInput = document.getElementById('income-patient-input');
    const form = document.getElementById('income-form');
    
    // Show patient display (from appointment) or input field (manual entry)
    if (patientName) {
      // From appointment - show patient info, hide input
      document.getElementById('income-patient-name').textContent = patientName;
      document.getElementById('income-patient-phone').textContent = patientPhone || '';
      patientDisplay.style.display = 'block';
      patientInputGroup.style.display = 'none';
      patientInput.value = patientName;
      form.querySelector('input[name="eventId"]').value = eventId;
    } else {
      // Manual entry - show input, hide display
      patientDisplay.style.display = 'none';
      patientInputGroup.style.display = 'block';
      patientInput.value = '';
      form.querySelector('input[name="eventId"]').value = '';
    }
    
    // Reset to NHIF tab
    this.switchIncomeTab('nhif');
    
    // Reset form fields
    const customAmountEl = form.querySelector('input[name="customAmount"]');
    const customDescEl = form.querySelector('input[name="customDescription"]');
    if (customAmountEl) customAmountEl.value = '';
    if (customDescEl) customDescEl.value = '';
    
    // Reset extra patient pay
    const extraPayEl = document.getElementById('extra-patient-pay');
    const extraDescEl = document.getElementById('extra-patient-desc');
    if (extraPayEl) extraPayEl.value = '';
    if (extraDescEl) extraDescEl.value = '';
    
    // Reset NHIF checkboxes
    document.querySelectorAll('#nhif-services-container input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
    
    // Reset toggles
    document.querySelectorAll('.age-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.age-btn[data-age="under18"]')?.classList.add('active');
    form.querySelector('input[name="ageGroup"]').value = 'under18';
    
    // Repopulate services for default age group
    this.populateNHIFServices('under18');
    
    document.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.payment-btn[data-method="cash"]')?.classList.add('active');
    form.querySelector('input[name="paymentMethod"]').value = 'cash';
    
    this.updateNHIFPriceDisplay();
    
    modal.hidden = false;
  },

  /**
   * Open income modal for a specific patient (from appointment click)
   */
  openIncomeModalForPatient(eventId, patientName, patientPhone) {
    this.openIncomeModal(eventId, patientName, patientPhone);
  },

  /**
   * Switch between NHIF and Custom income tabs
   */
  switchIncomeTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.income-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Show/hide tab content
    document.getElementById('nhif-tab').hidden = tabName !== 'nhif';
    document.getElementById('custom-tab').hidden = tabName !== 'custom';
    
    // Update hidden field
    document.querySelector('#income-form input[name="incomeType"]').value = tabName;
    
    // Focus appropriate field
    if (tabName === 'custom') {
      document.querySelector('#income-form input[name="customAmount"]').focus();
    }
  },

  /**
   * Update NHIF price display based on selected services (multiple)
   */
  updateNHIFPriceDisplay() {
    const checkboxes = document.querySelectorAll('#nhif-services-container input[type="checkbox"]:checked');
    const ageGroup = document.querySelector('#income-form input[name="ageGroup"]').value;
    
    const fundPriceEl = document.getElementById('nhif-fund-price');
    const patientPriceEl = document.getElementById('nhif-patient-price');
    const totalPriceEl = document.getElementById('nhif-total-price');
    const extraPayEl = document.getElementById('extra-patient-pay');
    
    let totalFund = 0;
    let totalPatient = 0;
    
    checkboxes.forEach(cb => {
      const id = cb.value; // Now using ID instead of code
      const priceData = this.nhifPrices[id];
      
      if (priceData) {
        if (ageGroup === 'under18') {
          totalFund += priceData.priceUnder18 || 0;
          totalPatient += priceData.patientPayUnder18 || 0;
        } else {
          totalFund += priceData.priceOver18 || 0;
          totalPatient += priceData.patientPayOver18 || 0;
        }
      }
    });
    
    // Add extra patient payment if any
    const extraPay = parseFloat(extraPayEl?.value) || 0;
    
    fundPriceEl.textContent = `${totalFund.toFixed(2)} €`;
    patientPriceEl.textContent = `${totalPatient.toFixed(2)} €`;
    totalPriceEl.textContent = `${(totalFund + totalPatient + extraPay).toFixed(2)} €`;
  },

  /**
   * Toggle remaining payment section visibility
   */
  toggleRemainingPayment() {
    const section = document.getElementById('remaining-payment-section');
    const icon = document.getElementById('remaining-payment-icon');
    if (section.style.display === 'none') {
      section.style.display = 'block';
      icon.textContent = '➖';
    } else {
      section.style.display = 'none';
      icon.textContent = '➕';
      // Clear the value when hiding
      section.querySelector('input[name="remainingPayment"]').value = '';
    }
  },

  /**
   * Close a modal by ID
   */
  closeModal(modalId) {
    document.getElementById(modalId).hidden = true;
    // Reset remaining payment section when closing
    const remainingSection = document.getElementById('remaining-payment-section');
    if (remainingSection) {
      remainingSection.style.display = 'none';
      document.getElementById('remaining-payment-icon').textContent = '➕';
    }
  },

  /**
   * Handle income form submission (NHIF or Custom)
   * Creates separate records for each procedure
   */
  async handleIncomeSubmit(form) {
    const formData = new FormData(form);
    const incomeType = formData.get('incomeType'); // 'nhif' or 'custom'
    const ageGroup = formData.get('ageGroup');
    const paymentMethod = formData.get('paymentMethod');
    const eventId = formData.get('eventId');
    
    // Get patient name from input field
    const patientName = document.getElementById('income-patient-input')?.value?.trim() || '';
    
    if (!patientName) {
      Utils.showToast('Моля въведете име на пациент', 'warning');
      document.getElementById('income-patient-input')?.focus();
      return;
    }
    
    // Get service category
    const serviceCategory = formData.get('serviceCategory') || '';
    
    // Get remaining payment if any (debt - NOT added to amount, just tracked)
    const remainingPayment = parseFloat(document.querySelector('input[name="remainingPayment"]')?.value) || 0;
    
    const baseData = {
      date: this.selectedDate || Utils.today(),
      type: 'income',
      paymentMethod: paymentMethod,
      eventId: eventId || '',
      patientName: patientName,
      serviceCategory: serviceCategory,
      remainingPayment: 0 // Default to 0, will set on first record only
    };
    
    const recordsToSave = [];
    let isFirstRecord = true; // Track if this is the first record to attach remainingPayment
    
    if (incomeType === 'nhif') {
      // NHIF services selected (multiple) - create separate record for each
      const checkboxes = document.querySelectorAll('#nhif-services-container input[type="checkbox"]:checked');
      
      if (checkboxes.length === 0) {
        Utils.showToast('Моля изберете поне една НЗОК услуга', 'warning');
        return;
      }
      
      // Create separate record for each procedure
      checkboxes.forEach(cb => {
        const id = cb.value;
        const priceData = this.nhifPrices[id];
        
        if (priceData) {
          let nhifAmount, patientPay;
          if (ageGroup === 'under18') {
            nhifAmount = priceData.priceUnder18 || 0;
            patientPay = priceData.patientPayUnder18 || 0;
          } else {
            nhifAmount = priceData.priceOver18 || 0;
            patientPay = priceData.patientPayOver18 || 0;
          }
          
          const record = {
            ...baseData,
            category: 'nhif',
            procedureCode: priceData.code,
            procedureName: priceData.name,
            nhifAmount: nhifAmount,
            patientAmount: patientPay,
            amount: nhifAmount + patientPay, // amount does NOT include remainingPayment
            description: `${priceData.code} ${priceData.name}`
          };
          
          // Attach remainingPayment only to first record
          if (isFirstRecord && remainingPayment > 0) {
            record.remainingPayment = remainingPayment;
            isFirstRecord = false;
          }
          
          recordsToSave.push(record);
        }
      });
      
      // Add extra patient payment as separate record if any
      const extraPay = parseFloat(document.getElementById('extra-patient-pay')?.value) || 0;
      const extraDesc = document.getElementById('extra-patient-desc')?.value?.trim() || 'Доплащане';
      
      if (extraPay > 0) {
        recordsToSave.push({
          ...baseData,
          category: 'patient_extra',
          procedureCode: '',
          procedureName: extraDesc,
          nhifAmount: 0,
          patientAmount: extraPay,
          amount: extraPay,
          description: `Доплащане: ${extraDesc}`
        });
      }
    } else {
      // Custom entry - single record
      const customAmount = parseFloat(formData.get('customAmount'));
      const customDescription = formData.get('customDescription')?.trim() || 'Приход';
      
      if (!customAmount || customAmount <= 0) {
        Utils.showToast('Моля въведете сума', 'warning');
        return;
      }
      
      recordsToSave.push({
        ...baseData,
        category: 'private',
        procedureCode: '',
        procedureName: customDescription,
        nhifAmount: 0,
        patientAmount: customAmount,
        amount: customAmount, // amount does NOT include remainingPayment
        remainingPayment: remainingPayment, // Attach debt to this single record
        description: customDescription
      });
    }

    // Save all records to n8n/Google Sheets
    let successCount = 0;
    let errorCount = 0;
    
    for (const record of recordsToSave) {
      try {
        const response = await API.addFinanceRecord(record);
        if (response.success) {
          successCount++;
        } else {
          errorCount++;
          console.error('Finance save error:', response);
        }
      } catch (error) {
        errorCount++;
        console.error('Finance save error:', error);
      }
    }
    
    if (successCount > 0) {
      Utils.showToast(`Записани ${successCount} процедури`, 'success');
    }
    if (errorCount > 0) {
      Utils.showToast(`${errorCount} грешки при запис`, 'error');
    }
    
    this.closeModal('income-modal');
    form.reset();
    document.getElementById('income-patient-input').value = '';
    this.loadWorkdayFinance(this.selectedDate);
  },

  /**
   * Handle expense form submission
   */
  async handleExpenseSubmit(form) {
    const formData = new FormData(form);
    const data = {
      date: this.selectedDate || Utils.today(),
      type: 'expense',
      amount: parseFloat(formData.get('amount')), // Positive amount, type indicates expense
      description: formData.get('description'),
      paymentMethod: formData.get('paymentMethod'),
      category: formData.get('category'),
      patientName: formData.get('vendorName') || '' // Use patientName field for vendor/contractor name
    };

    // Save to n8n/Google Sheets
    try {
      const response = await API.addFinanceRecord(data);
      if (response.success) {
        Utils.showToast('Разходът е записан', 'success');
      } else {
        Utils.showToast('Грешка при запис', 'error');
        console.error('Finance save error:', response);
      }
    } catch (error) {
      Utils.showToast('Грешка при запис', 'error');
      console.error('Finance save error:', error);
    }
    
    this.closeModal('expense-modal');
    form.reset();
    // Reset payment toggle
    document.querySelectorAll('.expense-payment-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.expense-payment-btn[data-method="cash"]').classList.add('active');
    
    this.loadWorkdayFinance(this.selectedDate);
  },

  /**
   * Handle payment from appointment (legacy - redirects to income modal)
   */
  async handlePaymentSubmit(form) {
    // This is kept for backwards compatibility
    // New flow uses openIncomeModalForPatient
    const formData = new FormData(form);
    const data = {
      date: this.selectedDate || Utils.today(),
      type: 'income',
      amount: parseFloat(formData.get('amount')),
      description: `Плащане от ${formData.get('patientName')}`,
      paymentMethod: formData.get('paymentMethod'),
      eventId: formData.get('appointmentId'),
      patientName: formData.get('patientName'),
      category: 'private'
    };

    // Save to n8n/Google Sheets
    try {
      const response = await API.addFinanceRecord(data);
      if (response.success) {
        Utils.showToast('Плащането е записано', 'success');
      } else {
        Utils.showToast('Грешка при запис', 'error');
        console.error('Finance save error:', response);
      }
    } catch (error) {
      Utils.showToast('Грешка при запис', 'error');
      console.error('Finance save error:', error);
    }
    
    this.closeModal('payment-modal');
    form.reset();
    this.loadWorkdayFinance(this.selectedDate);
  },

  /**
   * Add finance record to local storage
   */
  addLocalFinanceRecord(data) {
    const key = 'rodopi_finance_records';
    const records = JSON.parse(localStorage.getItem(key) || '[]');
    data.id = Date.now().toString();
    data.createdAt = new Date().toISOString();
    records.push(data);
    localStorage.setItem(key, JSON.stringify(records));
  },

  /**
   * Get local finance records for a date
   */
  getLocalFinanceRecords(date) {
    const key = 'rodopi_finance_records';
    const records = JSON.parse(localStorage.getItem(key) || '[]');
    return records.filter(r => r.date === date);
  },

  /**
   * Load workday appointments for selected date - uses Google Calendar API
   */
  async loadWorkdayAppointments(date) {
    const container = document.getElementById('day-appointments-list');
    const titleEl = document.getElementById('appointments-date-title');
    
    if (titleEl) {
      titleEl.textContent = `Пациенти за ${Utils.formatDateBG(date)}`;
    }
    
    if (!container) return;
    container.innerHTML = '<p class="text-muted">Зареждане...</p>';

    try {
      // Use Calendar API to get events for the day
      // Note: workflow expects 'date' param for day view
      const response = await API.getCalendarEvents({ 
        date: date,
        view: 'day'
      });
      
      // API wrapper returns { success, data: { success, events, count } }
      // Extract events from the nested structure
      const data = response.data || {};
      const events = data.events || [];
      
      console.log('Calendar response:', response);
      console.log('Events found:', events.length);
      
      if (response.success && events.length > 0) {
        // Sort by start time
        events.sort((a, b) => {
          const timeA = a.startTime || a.start?.dateTime || '';
          const timeB = b.startTime || b.start?.dateTime || '';
          return timeA.localeCompare(timeB);
        });
        
        let html = '';
        
        events.forEach(event => {
          html += this.renderCalendarAppointment(event, date);
        });
        
        container.innerHTML = html;
        
        // Store events for payment modal
        this.dayEvents = events;
        
      } else {
        container.innerHTML = '<p class="text-muted">Няма записани пациенти</p>';
        this.dayEvents = [];
      }
    } catch (error) {
      console.log('Calendar load error:', error);
      container.innerHTML = '<p class="text-muted">Няма записани пациенти</p>';
      this.dayEvents = [];
    }
  },

  /**
   * Render a calendar event as appointment card
   */
  renderCalendarAppointment(event, date) {
    // Extract data from calendar event
    const eventId = event.id || event.eventId;
    const patientName = event.patientName || event.summary || 'Неизвестен';
    const patientPhone = event.patientPhone || event.phone || '';
    const procedure = event.procedure || event.description || '';
    
    // Parse time from event
    let startTime = '';
    let duration = 30;
    
    if (event.startTime) {
      startTime = event.startTime;
    } else if (event.start?.dateTime) {
      startTime = new Date(event.start.dateTime).toTimeString().slice(0, 5);
    }
    
    if (event.duration) {
      duration = event.duration;
    } else if (event.start?.dateTime && event.end?.dateTime) {
      const start = new Date(event.start.dateTime);
      const end = new Date(event.end.dateTime);
      duration = Math.round((end - start) / 60000);
    }
    
    // Check if already paid (has finance record)
    const isPaid = event.isPaid || false;
    
    return `
      <div class="workday-appointment ${isPaid ? 'workday-appointment--paid' : ''}" 
           data-event-id="${eventId}"
           onclick="App.openIncomeModalForPatient('${eventId}', '${this.escapeHtml(patientName)}', '${patientPhone}')">
        <div class="appointment-time">
          ${startTime}
          <small>${duration}м</small>
        </div>
        <div class="appointment-info">
          <strong>${patientName}</strong>
          ${patientPhone ? `<span class="phone">${patientPhone}</span>` : ''}
          ${procedure ? `<small>📝 ${procedure}</small>` : ''}
        </div>
        <div class="appointment-actions">
          ${isPaid ? '<span class="status-badge status-badge--paid">💰 Платено</span>' : '<span class="btn btn--sm btn--success">+ Приход</span>'}
        </div>
      </div>
    `;
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML.replace(/'/g, "\\'");
  },

  /**
   * Render a pending appointment with confirmation buttons
   */
  renderPendingAppointment(apt) {
    return `
      <div class="workday-appointment workday-appointment--pending" data-id="${apt.id}">
        <div class="appointment-time">${Utils.formatTime(apt.startTime)}</div>
        <div class="appointment-info">
          <strong>${apt.patientName}</strong>
          <span class="phone">${apt.patientPhone}</span>
          ${apt.reason ? `<small>📝 ${apt.reason}</small>` : ''}
        </div>
        <div class="appointment-pending-actions">
          <div class="duration-buttons">
            <span class="duration-label">Потвърди:</span>
            <button class="btn btn--sm btn--outline" onclick="App.confirmWithDuration('${apt.id}', 30)">30м</button>
            <button class="btn btn--sm btn--outline" onclick="App.confirmWithDuration('${apt.id}', 45)">45м</button>
            <button class="btn btn--sm btn--outline" onclick="App.confirmWithDuration('${apt.id}', 60)">60м</button>
            <button class="btn btn--sm btn--outline" onclick="App.confirmWithDuration('${apt.id}', 90)">90м</button>
          </div>
          <button class="btn btn--sm btn--danger" onclick="App.cancelAppointment('${apt.id}')">❌</button>
        </div>
      </div>
    `;
  },

  /**
   * Render a confirmed/completed appointment
   */
  renderConfirmedAppointment(apt) {
    const statusClass = apt.status === 'cancelled' ? 'workday-appointment--cancelled' : '';
    return `
      <div class="workday-appointment ${statusClass}" data-id="${apt.id}" onclick="App.openPaymentModal('${apt.id}', '${apt.patientName}', '${apt.patientPhone}')">
        <div class="appointment-time">
          ${Utils.formatTime(apt.startTime)}
          <small>${apt.duration || 30}м</small>
        </div>
        <div class="appointment-info">
          <strong>${apt.patientName}</strong>
          <span class="phone">${apt.patientPhone}</span>
          ${apt.reason ? `<small>${apt.reason}</small>` : ''}
        </div>
        <div class="appointment-actions">
          <span class="status-badge status-badge--${apt.status}">${Utils.getStatusLabel(apt.status)}</span>
          ${apt.status === 'confirmed' ? `<button class="btn btn--sm btn--success" onclick="event.stopPropagation(); App.completeAppointment('${apt.id}')">✓ Завърши</button>` : ''}
        </div>
      </div>
    `;
  },

  /**
   * Setup appointment action event listeners
   */
  setupAppointmentActions() {
    // Already handled via onclick in the HTML
  },

  /**
   * Confirm appointment with specific duration
   */
  async confirmWithDuration(appointmentId, duration) {
    const response = await API.confirmAppointment(appointmentId, duration);
    
    if (response.success) {
      Utils.showToast(`Потвърдено за ${duration} минути`, 'success');
      this.loadWorkdayAppointments(this.selectedDate);
    } else {
      Utils.showToast(response.error || 'Грешка при потвърждение', 'error');
    }
  },

  /**
   * Cancel an appointment
   */
  async cancelAppointment(appointmentId) {
    if (!confirm('Сигурни ли сте, че искате да откажете този час?')) return;
    
    const response = await API.updateAppointmentStatus(appointmentId, 'cancelled');
    
    if (response.success) {
      Utils.showToast('Часът е отказан', 'success');
      this.loadWorkdayAppointments(this.selectedDate);
    } else {
      Utils.showToast('Грешка при отказване', 'error');
    }
  },

  /**
   * Complete an appointment
   */
  async completeAppointment(appointmentId) {
    const response = await API.updateAppointmentStatus(appointmentId, 'completed');
    
    if (response.success) {
      Utils.showToast('Часът е завършен', 'success');
      this.loadWorkdayAppointments(this.selectedDate);
    } else {
      Utils.showToast('Грешка', 'error');
    }
  },

  /**
   * Open payment modal for an appointment
   */
  openPaymentModal(appointmentId, patientName, patientPhone) {
    const modal = document.getElementById('payment-modal');
    const infoEl = document.getElementById('payment-patient-info');
    const form = document.getElementById('payment-form');
    
    infoEl.innerHTML = `
      <div class="patient-info-card">
        <strong>${patientName}</strong>
        <span>${patientPhone}</span>
      </div>
    `;
    
    form.querySelector('[name="appointmentId"]').value = appointmentId;
    form.querySelector('[name="patientName"]').value = patientName;
    form.querySelector('[name="date"]').value = this.selectedDate;
    
    modal.hidden = false;
    form.querySelector('[name="amount"]').focus();
  },

  /**
   * Load workday finance for selected date
   */
  async loadWorkdayFinance(date) {
    const container = document.getElementById('day-finance-list');
    const incomeEl = document.getElementById('day-income');
    const expenseEl = document.getElementById('day-expense');
    const balanceEl = document.getElementById('day-balance');
    
    if (!container) return;
    
    container.innerHTML = '<p class="text-muted">Зареждане...</p>';

    try {
      // Get records from n8n API
      const response = await API.getFinance({ date });
      const records = response.data?.records || [];
      
      // Store records for filtering
      this.financeRecords = records;
      
      // Setup search and filter listeners (only once)
      this.setupFinanceFilters();
      
      // Render with current filter
      this.renderFinanceRecords();
      
    } catch (error) {
      console.error('Finance load error:', error);
      container.innerHTML = '<p class="text-muted">Грешка при зареждане</p>';
      if (incomeEl) incomeEl.textContent = '0.00 €';
      if (expenseEl) expenseEl.textContent = '0.00 €';
      if (balanceEl) balanceEl.textContent = '0.00 €';
    }
  },
  
  /**
   * Setup finance search and filter listeners
   */
  setupFinanceFilters() {
    const searchInput = document.getElementById('finance-search-input');
    const filterBtns = document.querySelectorAll('.finance-filter-btn');
    
    // Remove old listeners by cloning
    if (searchInput && !searchInput.dataset.initialized) {
      searchInput.addEventListener('input', () => this.renderFinanceRecords());
      searchInput.dataset.initialized = 'true';
    }
    
    filterBtns.forEach(btn => {
      if (!btn.dataset.initialized) {
        btn.addEventListener('click', (e) => {
          filterBtns.forEach(b => {
            b.classList.remove('active');
            b.style.background = '#f1f5f9';
          });
          e.target.classList.add('active');
          e.target.style.background = '#e2e8f0';
          this.currentFinanceFilter = e.target.dataset.filter;
          this.renderFinanceRecords();
        });
        btn.dataset.initialized = 'true';
      }
    });
  },
  
  /**
   * Render finance records with search and filter
   */
  renderFinanceRecords() {
    const container = document.getElementById('day-finance-list');
    const incomeEl = document.getElementById('day-income');
    const expenseEl = document.getElementById('day-expense');
    const balanceEl = document.getElementById('day-balance');
    const searchInput = document.getElementById('finance-search-input');
    
    if (!container || !this.financeRecords) return;
    
    const searchTerm = (searchInput?.value || '').toLowerCase().trim();
    const filter = this.currentFinanceFilter || 'all';
    
    // Filter records
    let filteredRecords = this.financeRecords.filter(r => {
      // Search by patient name
      if (searchTerm && !(r.patientName || '').toLowerCase().includes(searchTerm)) {
        return false;
      }
      
      // Filter by category
      if (filter === 'nhif' && r.category !== 'nhif') return false;
      if (filter === 'patient' && r.category !== 'patient_extra' && r.category !== 'private') return false;
      
      return true;
    });
    
    // Calculate totals from ALL records (not filtered)
    let income = 0, expense = 0;
    this.financeRecords.forEach(r => {
      const amount = parseFloat(r.amount) || 0;
      if (r.type === 'income') {
        income += amount;
      } else if (r.type === 'expense') {
        expense += amount;
      }
    });
    
    // Update summary in EUR
    if (incomeEl) incomeEl.textContent = `${income.toFixed(2)} €`;
    if (expenseEl) expenseEl.textContent = `${expense.toFixed(2)} €`;
    if (balanceEl) {
      const balance = income - expense;
      balanceEl.textContent = `${balance.toFixed(2)} €`;
      balanceEl.style.color = balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
    }
    
    // Render filtered records
    if (filteredRecords.length === 0) {
      container.innerHTML = '<p class="text-muted">Няма записи</p>';
      return;
    }
    
    let html = '';
    filteredRecords.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    
    filteredRecords.forEach(r => {
      const amount = parseFloat(r.amount);
      const isIncome = r.type === 'income';
      const icon = isIncome ? '💰' : '💸';
      const categoryIcon = this.getCategoryIcon(r.category);
      const nhifAmount = parseFloat(r.nhifAmount) || 0;
      const patientAmount = parseFloat(r.patientAmount) || 0;
      
      // Show procedure code if available
      const procedureInfo = r.procedureCode ? `<span style="background:#dbeafe;color:#1e40af;padding:1px 4px;border-radius:3px;font-size:10px;font-weight:600;">${r.procedureCode}</span> ` : '';
      
      html += `
        <div class="finance-record ${isIncome ? 'income' : 'expense'}" style="padding:8px;border-bottom:1px solid #f1f5f9;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13px;color:#1e293b;margin-bottom:2px;">
                ${r.patientName || 'Без име'}
              </div>
              <div style="font-size:12px;color:#64748b;">
                ${procedureInfo}${categoryIcon} ${r.procedureName || r.description || 'Без описание'}
              </div>
              ${nhifAmount > 0 || patientAmount > 0 ? `
                <div style="font-size:10px;color:#94a3b8;margin-top:2px;">
                  ${nhifAmount > 0 ? `НЗОК: ${nhifAmount.toFixed(2)}€` : ''}
                  ${patientAmount > 0 ? `Доплащане: ${patientAmount.toFixed(2)}€` : ''}
                </div>
              ` : ''}
            </div>
            <div style="font-weight:700;font-size:14px;color:${isIncome ? '#22c55e' : '#ef4444'};">
              ${isIncome ? '+' : '-'}${amount.toFixed(2)} €
            </div>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  },

  /**
   * Load patients with outstanding debt for the day
   * Matches today's appointments with finance records that have remainingPayment > 0
   */
  async loadDebtPatients() {
    const container = document.getElementById('debt-list');
    if (!container) return;
    
    container.innerHTML = '<p style="color:#a16207;font-size:12px;text-align:center;">Зареждане...</p>';
    
    try {
      // Get all finance records with remainingPayment > 0
      const response = await API.getFinance({});
      const allRecords = response.data?.records || [];
      
      // Filter records with outstanding debt
      const debtRecords = allRecords.filter(r => 
        r.type === 'income' && 
        parseFloat(r.remainingPayment) > 0
      );
      
      if (debtRecords.length === 0) {
        container.innerHTML = '<p style="color:#22c55e;font-size:12px;text-align:center;">✓ Няма пациенти с дължими суми</p>';
        return;
      }
      
      // Get today's appointments to check if any debtors are coming
      const todayAppointments = this.appointments || [];
      const todayPatientNames = todayAppointments.map(a => 
        (a.summary || a.title || '').toLowerCase().split(' ')[0] // First word of name
      );
      
      // Build HTML
      let html = '';
      debtRecords.forEach(record => {
        const patientName = record.patientName || 'Неизвестен';
        const debt = parseFloat(record.remainingPayment).toFixed(2);
        const recordDate = record.date || '';
        const recordId = record.id || '';
        
        // Check if patient is coming today
        const patientFirstName = patientName.toLowerCase().split(' ')[0];
        const isComingToday = todayPatientNames.some(n => n && n.includes(patientFirstName));
        
        html += `
          <div style="background:${isComingToday ? '#fef9c3' : 'white'};border:1px solid ${isComingToday ? '#eab308' : '#fcd34d'};border-radius:6px;padding:8px;margin-bottom:6px;font-size:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-weight:600;color:#78350f;">${patientName}</div>
                <div style="color:#a16207;font-size:10px;">от ${Utils.formatDateBG(recordDate)}</div>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-weight:700;color:#dc2626;">${debt} €</span>
                <button onclick="App.markDebtPaid('${recordId}', ${record.remainingPayment}, '${patientName.replace(/'/g, "\\'")}')" 
                  style="background:#22c55e;color:white;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:11px;font-weight:600;" title="Платил">
                  ✓
                </button>
                <button onclick="App.dismissDebt('${recordId}')" 
                  style="background:#ef4444;color:white;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:11px;font-weight:600;" title="Отказал">
                  ✗
                </button>
              </div>
            </div>
            ${isComingToday ? '<div style="color:#ca8a04;font-size:10px;font-weight:600;margin-top:4px;">⚠️ Идва днес!</div>' : ''}
          </div>
        `;
      });
      
      container.innerHTML = html;
      
    } catch (error) {
      console.error('Debt load error:', error);
      container.innerHTML = '<p style="color:#ef4444;font-size:12px;text-align:center;">Грешка при зареждане</p>';
    }
  },

  /**
   * Mark debt as paid - converts remainingPayment to income
   */
  async markDebtPaid(recordId, amount, patientName) {
    if (!confirm(`Потвърдете плащане от ${patientName} на сума ${parseFloat(amount).toFixed(2)} €?`)) {
      return;
    }
    
    try {
      // Add new income record for the paid debt
      const addResponse = await API.addFinanceRecord({
        date: Utils.today(),
        type: 'income',
        amount: parseFloat(amount),
        patientName: patientName,
        category: 'debt_payment',
        procedureCode: '',
        procedureName: 'Доплатено задължение',
        nhifAmount: 0,
        patientAmount: parseFloat(amount),
        description: `Доплатено задължение от ${patientName}`,
        paymentMethod: 'cash',
        serviceCategory: '',
        remainingPayment: 0
      });
      
      if (addResponse.success) {
        // Update original record to set remainingPayment to 0
        const updateResponse = await API.updateFinanceRecord(recordId, {
          remainingPayment: 0
        });
        
        if (updateResponse.success) {
          Utils.showToast('Плащането е записано и дългът е нулиран', 'success');
        } else {
          Utils.showToast('Плащането е записано, но дългът не е нулиран', 'warning');
        }
        
        this.loadDebtPatients();
        this.loadWorkdayFinance(this.selectedDate);
      } else {
        Utils.showToast('Грешка при запис', 'error');
      }
    } catch (error) {
      console.error('Mark paid error:', error);
      Utils.showToast('Грешка при запис', 'error');
    }
  },

  /**
   * Dismiss debt (patient refused to pay or cancelled)
   */
  async dismissDebt(recordId) {
    if (!confirm('Сигурни ли сте, че искате да махнете това задължение? (Няма да се записва приход)')) {
      return;
    }
    
    try {
      // Update original record to set remainingPayment to 0 without adding income
      const response = await API.updateFinanceRecord(recordId, {
        remainingPayment: 0
      });
      
      if (response.success) {
        Utils.showToast('Задължението е премахнато', 'success');
        this.loadDebtPatients();
      } else {
        Utils.showToast('Грешка при обновяване', 'error');
      }
    } catch (error) {
      console.error('Dismiss debt error:', error);
      Utils.showToast('Грешка при обновяване', 'error');
    }
  },

  /**
   * Get icon for finance category
   */
  getCategoryIcon(category) {
    const icons = {
      nhif: '🏥',
      private: '💎',
      debt_payment: '💳',
      materials: '🧪',
      lab: '🔬',
      utilities: '💡',
      rent: '🏢',
      salary: '👤',
      other: '📦'
    };
    return icons[category] || '';
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
        const selectedDate = e.target.dataset.date;
        
        // Check if on workday page
        if (window.location.hash.includes('workday')) {
          this.selectedDate = selectedDate;
          this.loadWorkdayAppointments(selectedDate);
          this.loadWorkdayFinance(selectedDate);
          this.loadDebtPatients(); // Refresh debt panel for new date
        } else {
          this.loadDayAppointments(selectedDate);
        }
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
      
      if (window.location.hash.includes('workday')) {
        this.selectedDate = today;
        this.loadWorkdayAppointments(today);
        this.loadWorkdayFinance(today);
        this.loadDebtPatients(); // Load patients with outstanding debt
      } else {
        this.loadDayAppointments(today);
      }
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
    
    // API returns { success, count, appointments }
    const appointments = response.data?.appointments || [];
    
    if (response.success && appointments.length > 0) {
      let html = `<h3>Записи за ${Utils.formatDateBG(date)}</h3>`;
      html += '<div class="appointments-list">';
      
      appointments.sort((a, b) => a.startTime.localeCompare(b.startTime));
      
      appointments.forEach(apt => {
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

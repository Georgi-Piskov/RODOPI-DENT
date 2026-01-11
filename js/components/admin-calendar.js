/**
 * Admin Calendar Component
 * Appointment management calendar for admin panel
 */

const AdminCalendar = {
  calendar: null,
  selectedDate: null,
  appointments: [],
  viewMode: 'day', // day, week

  /**
   * Initialize admin calendar
   */
  async init() {
    Utils.log('AdminCalendar: Initializing');

    // Setup calendar
    this.initCalendar();

    // Setup view controls
    this.setupViewControls();

    // Setup appointment actions
    this.setupAppointmentActions();

    // Load today's appointments
    const today = Utils.formatDate(new Date(), 'iso');
    await this.loadAppointments(today);
  },

  /**
   * Initialize calendar component
   */
  initCalendar() {
    const container = document.getElementById('admin-calendar');
    if (!container) return;

    Calendar.init(container, {
      onDateSelect: (date, dateStr) => this.onDateSelected(date, dateStr),
      showNavigation: true
    });

    this.calendar = Calendar;

    // Select today by default
    const today = new Date();
    Calendar.selectDate(today);
  },

  /**
   * Handle date selection
   * @param {Date} date - Selected date
   * @param {string} dateStr - Date string
   */
  async onDateSelected(date, dateStr) {
    this.selectedDate = dateStr;
    
    // Update header
    const headerDate = document.getElementById('calendar-header-date');
    if (headerDate) {
      headerDate.textContent = Utils.formatDate(date, 'long');
    }

    // Load appointments
    await this.loadAppointments(dateStr);
  },

  /**
   * Load appointments for a date
   * @param {string} dateStr - Date string
   */
  async loadAppointments(dateStr) {
    const container = document.getElementById('appointments-list');
    if (!container) return;

    // Show loading
    container.innerHTML = `
      <div class="loading">
        <div class="loading__spinner"></div>
        <p class="loading__text">Зареждане...</p>
      </div>
    `;

    try {
      // Try to get from cache first
      const cacheKey = `appointments_${dateStr}`;
      let appointments = await CacheManager.get(cacheKey);

      if (!appointments && navigator.onLine) {
        // Fetch from API
        const response = await API.getAppointments({ date: dateStr });
        if (response.success) {
          appointments = response.appointments || [];
          // Cache for 5 minutes
          await CacheManager.set(cacheKey, appointments, 5 * 60 * 1000);
        }
      }

      this.appointments = appointments || [];
      this.renderAppointments();

      // Update calendar marks
      this.updateCalendarMarks();

    } catch (error) {
      Utils.error('Failed to load appointments:', error);
      container.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__text">Грешка при зареждане</p>
          <button class="btn btn--outline" onclick="AdminCalendar.loadAppointments('${dateStr}')">
            Опитай отново
          </button>
        </div>
      `;
    }
  },

  /**
   * Render appointments list
   */
  renderAppointments() {
    const container = document.getElementById('appointments-list');
    if (!container) return;

    if (this.appointments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📅</div>
          <p class="empty-state__text">Няма записани часове за тази дата</p>
          <button class="btn btn--primary" onclick="AdminCalendar.showNewAppointmentModal()">
            + Добави час
          </button>
        </div>
      `;
      return;
    }

    // Sort by time
    const sorted = [...this.appointments].sort((a, b) => {
      return a.startTime.localeCompare(b.startTime);
    });

    let html = '<div class="appointments">';

    sorted.forEach(apt => {
      html += this.renderAppointmentCard(apt);
    });

    html += '</div>';
    container.innerHTML = html;

    // Add event listeners
    this.attachAppointmentListeners();
  },

  /**
   * Render a single appointment card
   * @param {Object} apt - Appointment data
   * @returns {string} HTML string
   */
  renderAppointmentCard(apt) {
    const statusLabels = {
      'pending': { text: 'Чака одобрение', class: 'badge--warning' },
      'confirmed': { text: 'Потвърден', class: 'badge--success' },
      'completed': { text: 'Завършен', class: 'badge--default' },
      'cancelled': { text: 'Отказан', class: 'badge--danger' },
      'no-show': { text: 'Неявяване', class: 'badge--danger' }
    };

    const status = statusLabels[apt.status] || statusLabels.pending;
    const duration = apt.duration || 60;

    return `
      <div class="appointment-card" data-id="${apt.id}">
        <div class="appointment-card__time">
          <span class="appointment-card__start">${apt.startTime}</span>
          <span class="appointment-card__duration">${duration} мин</span>
        </div>
        <div class="appointment-card__content">
          <h4 class="appointment-card__patient">${Utils.escapeHtml(apt.patientName)}</h4>
          <p class="appointment-card__phone">
            <a href="tel:${apt.patientPhone}">${apt.patientPhone}</a>
          </p>
          ${apt.notes ? `<p class="appointment-card__notes">${Utils.escapeHtml(apt.notes)}</p>` : ''}
        </div>
        <div class="appointment-card__actions">
          <span class="badge ${status.class}">${status.text}</span>
          <div class="appointment-card__buttons">
            ${apt.status === 'pending' ? `
              <button class="btn btn--small btn--success" data-action="confirm" title="Потвърди">
                ✓
              </button>
              <button class="btn btn--small btn--danger" data-action="reject" title="Откажи">
                ✗
              </button>
            ` : ''}
            ${apt.status === 'confirmed' ? `
              <button class="btn btn--small btn--primary" data-action="complete" title="Завърши">
                ✓
              </button>
              <button class="btn btn--small btn--outline" data-action="no-show" title="Неявяване">
                ∅
              </button>
            ` : ''}
            <button class="btn btn--small btn--outline" data-action="edit" title="Редактирай">
              ✎
            </button>
            <button class="btn btn--small btn--outline" data-action="delete" title="Изтрий">
              🗑
            </button>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Attach event listeners to appointment cards
   */
  attachAppointmentListeners() {
    const cards = document.querySelectorAll('.appointment-card');
    
    cards.forEach(card => {
      const id = card.dataset.id;
      const apt = this.appointments.find(a => a.id === id);

      // Action buttons
      card.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          this.handleAppointmentAction(action, apt);
        });
      });

      // Card click - show details
      card.addEventListener('click', () => {
        this.showAppointmentDetails(apt);
      });
    });
  },

  /**
   * Handle appointment action
   * @param {string} action - Action name
   * @param {Object} apt - Appointment data
   */
  async handleAppointmentAction(action, apt) {
    switch (action) {
      case 'confirm':
        await this.confirmAppointment(apt);
        break;
      case 'reject':
        await this.rejectAppointment(apt);
        break;
      case 'complete':
        await this.completeAppointment(apt);
        break;
      case 'no-show':
        await this.markNoShow(apt);
        break;
      case 'edit':
        this.showEditAppointmentModal(apt);
        break;
      case 'delete':
        await this.deleteAppointment(apt);
        break;
    }
  },

  /**
   * Confirm an appointment
   * @param {Object} apt - Appointment data
   */
  async confirmAppointment(apt) {
    const confirmed = await Modal.confirm({
      title: 'Потвърждение на час',
      message: `Потвърждавате ли часа на ${apt.patientName} за ${apt.startTime}?`,
      confirmText: 'Потвърди',
      confirmClass: 'btn--success'
    });

    if (!confirmed) return;

    try {
      Modal.loading('Потвърждаване...');

      if (navigator.onLine) {
        await API.confirmAppointment(apt.id);
      } else {
        await OfflineQueue.add('confirm_appointment', { id: apt.id });
      }

      Toast.success('Часът е потвърден');
      Modal.close();
      
      // Reload appointments
      await this.loadAppointments(this.selectedDate);

    } catch (error) {
      Modal.close();
      Toast.error('Грешка при потвърждаване');
      Utils.error('Confirm appointment failed:', error);
    }
  },

  /**
   * Reject an appointment
   * @param {Object} apt - Appointment data
   */
  async rejectAppointment(apt) {
    const confirmed = await Modal.confirm({
      title: 'Отказ на час',
      message: `Сигурни ли сте, че искате да откажете часа на ${apt.patientName}?`,
      confirmText: 'Откажи часа',
      danger: true
    });

    if (!confirmed) return;

    try {
      Modal.loading('Обработка...');

      if (navigator.onLine) {
        await API.cancelAppointment(apt.id, 'rejected');
      } else {
        await OfflineQueue.add('cancel_appointment', { id: apt.id, reason: 'rejected' });
      }

      Toast.success('Часът е отказан');
      Modal.close();
      
      await this.loadAppointments(this.selectedDate);

    } catch (error) {
      Modal.close();
      Toast.error('Грешка при отказване');
      Utils.error('Reject appointment failed:', error);
    }
  },

  /**
   * Complete an appointment
   * @param {Object} apt - Appointment data
   */
  async completeAppointment(apt) {
    // Show completion modal with procedure selection
    this.showCompletionModal(apt);
  },

  /**
   * Show completion modal
   * @param {Object} apt - Appointment data
   */
  async showCompletionModal(apt) {
    // Load procedures
    let procedures = [];
    try {
      const response = await API.getProcedures();
      if (response.success) {
        procedures = response.procedures || [];
      }
    } catch (error) {
      Utils.error('Failed to load procedures:', error);
    }

    const procedureOptions = procedures.map(p => 
      `<option value="${p.code}" data-price="${p.price}">${p.code} - ${p.description} (${p.price} EUR)</option>`
    ).join('');

    Modal.show({
      title: 'Завършване на час',
      body: `
        <form id="completion-form">
          <div class="form-group">
            <label class="form-label">Пациент</label>
            <p class="form-static">${Utils.escapeHtml(apt.patientName)}</p>
          </div>
          <div class="form-group">
            <label class="form-label">Извършена процедура</label>
            <select name="procedure" class="form-select" id="completion-procedure">
              <option value="">-- Изберете процедура --</option>
              ${procedureOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Сума (EUR)</label>
            <input type="number" name="amount" class="form-input" id="completion-amount" 
                   step="0.01" min="0" placeholder="0.00">
          </div>
          <div class="form-group">
            <label class="form-label">Бележки</label>
            <textarea name="notes" class="form-textarea" rows="2"></textarea>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn--outline" data-action="cancel">Отказ</button>
        <button class="btn btn--success" data-action="complete">Завърши</button>
      `,
      onShow: (modal) => {
        // Procedure selection updates amount
        const procedureSelect = modal.querySelector('#completion-procedure');
        const amountInput = modal.querySelector('#completion-amount');
        
        procedureSelect?.addEventListener('change', () => {
          const selected = procedureSelect.options[procedureSelect.selectedIndex];
          const price = selected?.dataset.price || '';
          amountInput.value = price;
        });

        // Button handlers
        modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
          Modal.close();
        });

        modal.querySelector('[data-action="complete"]')?.addEventListener('click', async () => {
          const form = modal.querySelector('#completion-form');
          const formData = new FormData(form);
          
          try {
            Modal.loading('Запазване...');

            const data = {
              appointmentId: apt.id,
              procedure: formData.get('procedure'),
              amount: parseFloat(formData.get('amount')) || 0,
              notes: formData.get('notes')
            };

            if (navigator.onLine) {
              await API.completeAppointment(apt.id, data);
            } else {
              await OfflineQueue.add('complete_appointment', data);
            }

            Toast.success('Часът е завършен');
            Modal.close();
            await this.loadAppointments(this.selectedDate);

          } catch (error) {
            Modal.close();
            Toast.error('Грешка при запазване');
            Utils.error('Complete appointment failed:', error);
          }
        });
      }
    });
  },

  /**
   * Mark appointment as no-show
   * @param {Object} apt - Appointment data
   */
  async markNoShow(apt) {
    const confirmed = await Modal.confirm({
      title: 'Неявяване',
      message: `Отбележете ${apt.patientName} като неявил се?`,
      confirmText: 'Потвърди',
      danger: true
    });

    if (!confirmed) return;

    try {
      if (navigator.onLine) {
        await API.updateAppointmentStatus(apt.id, 'no-show');
      } else {
        await OfflineQueue.add('update_appointment_status', { id: apt.id, status: 'no-show' });
      }

      Toast.success('Статусът е обновен');
      await this.loadAppointments(this.selectedDate);

    } catch (error) {
      Toast.error('Грешка при обновяване');
      Utils.error('Mark no-show failed:', error);
    }
  },

  /**
   * Delete an appointment
   * @param {Object} apt - Appointment data
   */
  async deleteAppointment(apt) {
    const confirmed = await Modal.confirm({
      title: 'Изтриване на час',
      message: `Сигурни ли сте, че искате да изтриете часа на ${apt.patientName}?`,
      confirmText: 'Изтрий',
      danger: true
    });

    if (!confirmed) return;

    try {
      Modal.loading('Изтриване...');

      if (navigator.onLine) {
        await API.deleteAppointment(apt.id);
      } else {
        await OfflineQueue.add('delete_appointment', { id: apt.id });
      }

      Toast.success('Часът е изтрит');
      Modal.close();
      await this.loadAppointments(this.selectedDate);

    } catch (error) {
      Modal.close();
      Toast.error('Грешка при изтриване');
      Utils.error('Delete appointment failed:', error);
    }
  },

  /**
   * Show appointment details modal
   * @param {Object} apt - Appointment data
   */
  showAppointmentDetails(apt) {
    const statusLabels = {
      'pending': 'Чака одобрение',
      'confirmed': 'Потвърден',
      'completed': 'Завършен',
      'cancelled': 'Отказан',
      'no-show': 'Неявяване'
    };

    Modal.show({
      title: 'Детайли за час',
      body: `
        <div class="appointment-details">
          <div class="detail-row">
            <span class="detail-label">Пациент:</span>
            <span class="detail-value">${Utils.escapeHtml(apt.patientName)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Телефон:</span>
            <span class="detail-value">
              <a href="tel:${apt.patientPhone}">${apt.patientPhone}</a>
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Дата:</span>
            <span class="detail-value">${Utils.formatDate(apt.date, 'long')}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Час:</span>
            <span class="detail-value">${apt.startTime}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Продължителност:</span>
            <span class="detail-value">${apt.duration || 60} минути</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Статус:</span>
            <span class="detail-value">${statusLabels[apt.status] || apt.status}</span>
          </div>
          ${apt.notes ? `
          <div class="detail-row">
            <span class="detail-label">Бележки:</span>
            <span class="detail-value">${Utils.escapeHtml(apt.notes)}</span>
          </div>
          ` : ''}
        </div>
      `,
      footer: `
        <button class="btn btn--outline" onclick="Modal.close()">Затвори</button>
        <button class="btn btn--primary" onclick="AdminCalendar.showEditAppointmentModal(AdminCalendar.appointments.find(a => a.id === '${apt.id}'))">
          Редактирай
        </button>
      `
    });
  },

  /**
   * Show new appointment modal
   */
  showNewAppointmentModal() {
    const selectedDate = this.selectedDate || Utils.formatDate(new Date(), 'iso');
    const slots = this.generateTimeSlots();

    Modal.show({
      title: 'Нов час',
      size: 'large',
      body: `
        <form id="new-appointment-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Дата *</label>
              <input type="date" name="date" class="form-input" value="${selectedDate}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Час *</label>
              <select name="time" class="form-select" required>
                ${slots.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Продължителност</label>
            <select name="duration" class="form-select">
              <option value="30">30 минути</option>
              <option value="60" selected>1 час</option>
              <option value="90">1.5 часа</option>
              <option value="120">2 часа</option>
              <option value="180">3 часа</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Име на пациент *</label>
            <input type="text" name="patientName" class="form-input" required>
          </div>
          <div class="form-group">
            <label class="form-label">Телефон *</label>
            <input type="tel" name="patientPhone" class="form-input" placeholder="+359..." required>
          </div>
          <div class="form-group">
            <label class="form-label">Бележки</label>
            <textarea name="notes" class="form-textarea" rows="2"></textarea>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn--outline" data-action="cancel">Отказ</button>
        <button class="btn btn--primary" data-action="save">Запази</button>
      `,
      onShow: (modal) => {
        modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
          Modal.close();
        });

        modal.querySelector('[data-action="save"]')?.addEventListener('click', async () => {
          const form = modal.querySelector('#new-appointment-form');
          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }

          const formData = new FormData(form);
          await this.createAppointment({
            date: formData.get('date'),
            startTime: formData.get('time'),
            duration: parseInt(formData.get('duration')),
            patientName: formData.get('patientName'),
            patientPhone: formData.get('patientPhone'),
            notes: formData.get('notes'),
            status: 'confirmed'
          });
        });
      }
    });
  },

  /**
   * Show edit appointment modal
   * @param {Object} apt - Appointment data
   */
  showEditAppointmentModal(apt) {
    if (!apt) return;
    Modal.close();

    const slots = this.generateTimeSlots();

    Modal.show({
      title: 'Редактиране на час',
      size: 'large',
      body: `
        <form id="edit-appointment-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Дата</label>
              <input type="date" name="date" class="form-input" value="${apt.date}">
            </div>
            <div class="form-group">
              <label class="form-label">Час</label>
              <select name="time" class="form-select">
                ${slots.map(s => `<option value="${s}" ${s === apt.startTime ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Продължителност</label>
            <select name="duration" class="form-select">
              <option value="30" ${apt.duration === 30 ? 'selected' : ''}>30 минути</option>
              <option value="60" ${apt.duration === 60 ? 'selected' : ''}>1 час</option>
              <option value="90" ${apt.duration === 90 ? 'selected' : ''}>1.5 часа</option>
              <option value="120" ${apt.duration === 120 ? 'selected' : ''}>2 часа</option>
              <option value="180" ${apt.duration === 180 ? 'selected' : ''}>3 часа</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Име на пациент</label>
            <input type="text" name="patientName" class="form-input" value="${Utils.escapeHtml(apt.patientName)}">
          </div>
          <div class="form-group">
            <label class="form-label">Телефон</label>
            <input type="tel" name="patientPhone" class="form-input" value="${apt.patientPhone}">
          </div>
          <div class="form-group">
            <label class="form-label">Статус</label>
            <select name="status" class="form-select">
              <option value="pending" ${apt.status === 'pending' ? 'selected' : ''}>Чака одобрение</option>
              <option value="confirmed" ${apt.status === 'confirmed' ? 'selected' : ''}>Потвърден</option>
              <option value="completed" ${apt.status === 'completed' ? 'selected' : ''}>Завършен</option>
              <option value="cancelled" ${apt.status === 'cancelled' ? 'selected' : ''}>Отказан</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Бележки</label>
            <textarea name="notes" class="form-textarea" rows="2">${Utils.escapeHtml(apt.notes || '')}</textarea>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn--outline" data-action="cancel">Отказ</button>
        <button class="btn btn--primary" data-action="save">Запази</button>
      `,
      onShow: (modal) => {
        modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
          Modal.close();
        });

        modal.querySelector('[data-action="save"]')?.addEventListener('click', async () => {
          const form = modal.querySelector('#edit-appointment-form');
          const formData = new FormData(form);
          
          await this.updateAppointment(apt.id, {
            date: formData.get('date'),
            startTime: formData.get('time'),
            duration: parseInt(formData.get('duration')),
            patientName: formData.get('patientName'),
            patientPhone: formData.get('patientPhone'),
            status: formData.get('status'),
            notes: formData.get('notes')
          });
        });
      }
    });
  },

  /**
   * Create new appointment
   * @param {Object} data - Appointment data
   */
  async createAppointment(data) {
    try {
      Modal.loading('Запазване...');

      if (navigator.onLine) {
        await API.createAppointment(data);
      } else {
        await OfflineQueue.add('create_appointment', data);
      }

      Toast.success('Часът е създаден');
      Modal.close();
      
      // If same date, reload
      if (data.date === this.selectedDate) {
        await this.loadAppointments(this.selectedDate);
      }

    } catch (error) {
      Modal.close();
      Toast.error('Грешка при създаване');
      Utils.error('Create appointment failed:', error);
    }
  },

  /**
   * Update appointment
   * @param {string} id - Appointment ID
   * @param {Object} data - Updated data
   */
  async updateAppointment(id, data) {
    try {
      Modal.loading('Запазване...');

      if (navigator.onLine) {
        await API.updateAppointment(id, data);
      } else {
        await OfflineQueue.add('update_appointment', { id, ...data });
      }

      Toast.success('Часът е обновен');
      Modal.close();
      await this.loadAppointments(this.selectedDate);

    } catch (error) {
      Modal.close();
      Toast.error('Грешка при обновяване');
      Utils.error('Update appointment failed:', error);
    }
  },

  /**
   * Generate time slots array
   * @returns {Array} Time slots
   */
  generateTimeSlots() {
    const slots = [];
    const workHours = CONFIG.WORK_HOURS;

    // Morning
    for (let h = workHours.MORNING_START; h < workHours.MORNING_END; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
      slots.push(`${h.toString().padStart(2, '0')}:30`);
    }

    // Afternoon
    slots.push('13:30');
    for (let h = 14; h < workHours.AFTERNOON_END; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
      slots.push(`${h.toString().padStart(2, '0')}:30`);
    }

    return slots;
  },

  /**
   * Update calendar marks with appointment counts
   */
  async updateCalendarMarks() {
    // This would fetch monthly counts and mark the calendar
    // For now, just mark selected date if has appointments
    if (this.appointments.length > 0 && this.selectedDate) {
      this.calendar?.markDate(this.selectedDate, {
        type: 'has-appointments',
        count: this.appointments.length
      });
    }
  },

  /**
   * Setup view controls
   */
  setupViewControls() {
    const dayBtn = document.getElementById('view-day-btn');
    const weekBtn = document.getElementById('view-week-btn');
    const addBtn = document.getElementById('add-appointment-btn');

    dayBtn?.addEventListener('click', () => this.setViewMode('day'));
    weekBtn?.addEventListener('click', () => this.setViewMode('week'));
    addBtn?.addEventListener('click', () => this.showNewAppointmentModal());
  },

  /**
   * Set view mode
   * @param {string} mode - View mode (day/week)
   */
  setViewMode(mode) {
    this.viewMode = mode;
    
    // Update button states
    document.getElementById('view-day-btn')?.classList.toggle('active', mode === 'day');
    document.getElementById('view-week-btn')?.classList.toggle('active', mode === 'week');

    // Re-render
    if (mode === 'week') {
      // Week view not implemented yet
      Toast.info('Седмичен изглед - скоро');
    }
  },

  /**
   * Setup appointment actions
   */
  setupAppointmentActions() {
    // Refresh button
    const refreshBtn = document.getElementById('refresh-appointments-btn');
    refreshBtn?.addEventListener('click', async () => {
      // Clear cache
      await CacheManager.clear();
      await this.loadAppointments(this.selectedDate);
      Toast.success('Обновено');
    });
  },

  /**
   * Cleanup
   */
  destroy() {
    this.calendar?.destroy();
    this.appointments = [];
  }
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdminCalendar;
}

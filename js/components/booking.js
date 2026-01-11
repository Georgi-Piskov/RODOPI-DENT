/**
 * Booking Component
 * Patient booking page functionality
 */

const Booking = {
  selectedDate: null,
  selectedTime: null,
  selectedDuration: 60,
  patientData: null,
  calendar: null,
  timeSlots: null,
  currentStep: 1,

  /**
   * Initialize booking page
   */
  async init() {
    Utils.log('Booking: Initializing');

    // Get container
    const page = document.getElementById('page-booking');
    if (!page) {
      Utils.error('Booking page not found');
      return;
    }

    // Reset state
    this.reset();

    // Initialize calendar
    this.initCalendar();

    // Setup form handlers
    this.setupFormHandlers();

    // Setup step navigation
    this.setupStepNavigation();

    // Load any saved booking data from localStorage
    this.loadSavedData();
  },

  /**
   * Reset booking state
   */
  reset() {
    this.selectedDate = null;
    this.selectedTime = null;
    this.selectedDuration = 60;
    this.patientData = null;
    this.currentStep = 1;
  },

  /**
   * Initialize calendar component
   */
  initCalendar() {
    const calendarContainer = document.getElementById('booking-calendar');
    if (!calendarContainer) return;

    // Set minimum date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Set maximum date to 3 months ahead
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);

    Calendar.init(calendarContainer, {
      minDate: tomorrow,
      maxDate: maxDate,
      onDateSelect: (date, dateStr) => this.onDateSelected(date, dateStr)
    });

    this.calendar = Calendar;
  },

  /**
   * Handle date selection
   * @param {Date} date - Selected date
   * @param {string} dateStr - Date string
   */
  async onDateSelected(date, dateStr) {
    this.selectedDate = dateStr;
    this.selectedTime = null;

    // Update UI to show selected date
    const selectedDateEl = document.getElementById('selected-date-display');
    if (selectedDateEl) {
      selectedDateEl.textContent = Utils.formatDate(date, 'long');
    }

    // Show time slots container
    const timeSlotsSection = document.getElementById('time-slots-section');
    if (timeSlotsSection) {
      timeSlotsSection.hidden = false;
    }

    // Load available slots
    await this.loadTimeSlots(dateStr);
  },

  /**
   * Load available time slots for a date
   * @param {string} dateStr - Date string
   */
  async loadTimeSlots(dateStr) {
    const container = document.getElementById('time-slots');
    if (!container) return;

    // Show loading
    TimeSlots.init(container, { slots: [] });
    TimeSlots.showLoading();

    try {
      // Check if online
      if (!navigator.onLine) {
        // Generate default slots for offline mode
        const slots = this.generateDefaultSlots();
        TimeSlots.setSlots(slots);
        Toast.warning('Офлайн режим - показани са стандартните часове');
        return;
      }

      // Fetch available slots from API
      const response = await API.getAvailability(dateStr);
      
      if (response.success && response.slots) {
        TimeSlots.init(container, {
          slots: response.slots,
          onSlotSelect: (time) => this.onTimeSelected(time)
        });
      } else {
        // Fallback to default slots
        const slots = this.generateDefaultSlots();
        TimeSlots.init(container, {
          slots: slots,
          onSlotSelect: (time) => this.onTimeSelected(time)
        });
      }
    } catch (error) {
      Utils.error('Failed to load time slots:', error);
      
      // Show default slots on error
      const slots = this.generateDefaultSlots();
      TimeSlots.init(container, {
        slots: slots,
        onSlotSelect: (time) => this.onTimeSelected(time)
      });
      
      Toast.error('Грешка при зареждане на часовете');
    }
  },

  /**
   * Generate default time slots based on work hours
   * @returns {Array} Slots array
   */
  generateDefaultSlots() {
    const slots = [];
    const workHours = CONFIG.WORK_HOURS;

    // Morning slots
    for (let hour = workHours.MORNING_START; hour < workHours.MORNING_END; hour++) {
      slots.push({ time: `${hour.toString().padStart(2, '0')}:00`, available: true });
    }

    // Afternoon slots
    const afternoonStart = Math.ceil(workHours.AFTERNOON_START);
    for (let hour = afternoonStart; hour < workHours.AFTERNOON_END; hour++) {
      if (hour === 13) {
        slots.push({ time: '13:30', available: true });
      } else {
        slots.push({ time: `${hour.toString().padStart(2, '0')}:00`, available: true });
      }
    }

    return slots;
  },

  /**
   * Handle time selection
   * @param {string} time - Selected time
   */
  onTimeSelected(time) {
    this.selectedTime = time;

    // Enable next step button
    const nextBtn = document.getElementById('booking-step1-next');
    if (nextBtn) {
      nextBtn.disabled = false;
    }

    // Update display
    const selectedTimeEl = document.getElementById('selected-time-display');
    if (selectedTimeEl) {
      selectedTimeEl.textContent = time;
    }
  },

  /**
   * Setup step navigation
   */
  setupStepNavigation() {
    // Step 1 -> Step 2
    const step1Next = document.getElementById('booking-step1-next');
    if (step1Next) {
      step1Next.addEventListener('click', () => this.goToStep(2));
    }

    // Step 2 -> Step 1 (back)
    const step2Back = document.getElementById('booking-step2-back');
    if (step2Back) {
      step2Back.addEventListener('click', () => this.goToStep(1));
    }

    // Step 2 -> Step 3 (submit)
    const step2Submit = document.getElementById('booking-step2-submit');
    if (step2Submit) {
      step2Submit.addEventListener('click', () => this.submitBooking());
    }
  },

  /**
   * Go to a specific step
   * @param {number} step - Step number
   */
  goToStep(step) {
    // Validate step transition
    if (step === 2 && (!this.selectedDate || !this.selectedTime)) {
      Toast.warning('Моля, изберете дата и час');
      return;
    }

    this.currentStep = step;

    // Update step indicators
    const steps = document.querySelectorAll('.booking-step');
    steps.forEach((el, index) => {
      el.classList.remove('active', 'completed');
      if (index + 1 < step) {
        el.classList.add('completed');
      } else if (index + 1 === step) {
        el.classList.add('active');
      }
    });

    // Show/hide step content
    const step1Content = document.getElementById('booking-step1-content');
    const step2Content = document.getElementById('booking-step2-content');

    if (step === 1) {
      step1Content.hidden = false;
      step2Content.hidden = true;
    } else if (step === 2) {
      step1Content.hidden = true;
      step2Content.hidden = false;
      this.updateStep2Summary();
    }
  },

  /**
   * Update step 2 summary
   */
  updateStep2Summary() {
    const dateDisplay = document.getElementById('summary-date');
    const timeDisplay = document.getElementById('summary-time');

    if (dateDisplay && this.selectedDate) {
      dateDisplay.textContent = Utils.formatDate(this.selectedDate, 'long');
    }
    if (timeDisplay && this.selectedTime) {
      timeDisplay.textContent = this.selectedTime;
    }
  },

  /**
   * Setup form handlers
   */
  setupFormHandlers() {
    const form = document.getElementById('booking-form');
    if (!form) return;

    // Phone input formatting
    const phoneInput = form.querySelector('input[name="phone"]');
    if (phoneInput) {
      phoneInput.addEventListener('input', (e) => {
        // Allow only numbers and +
        e.target.value = e.target.value.replace(/[^\d+]/g, '');
      });
    }

    // Form validation on input
    const inputs = form.querySelectorAll('input[required]');
    inputs.forEach(input => {
      input.addEventListener('blur', () => {
        this.validateInput(input);
      });
    });
  },

  /**
   * Validate a single input
   * @param {HTMLInputElement} input - Input element
   * @returns {boolean} Is valid
   */
  validateInput(input) {
    const value = input.value.trim();
    let isValid = true;
    let errorMsg = '';

    if (input.required && !value) {
      isValid = false;
      errorMsg = 'Това поле е задължително';
    } else if (input.name === 'phone' && value) {
      if (!Utils.validatePhone(value)) {
        isValid = false;
        errorMsg = 'Невалиден телефонен номер';
      }
    } else if (input.name === 'name' && value) {
      if (value.length < 2) {
        isValid = false;
        errorMsg = 'Името трябва да е поне 2 символа';
      }
    }

    // Update UI
    const group = input.closest('.form-group');
    if (group) {
      group.classList.toggle('has-error', !isValid);
      
      let errorEl = group.querySelector('.form-error');
      if (!isValid) {
        if (!errorEl) {
          errorEl = document.createElement('span');
          errorEl.className = 'form-error';
          group.appendChild(errorEl);
        }
        errorEl.textContent = errorMsg;
      } else if (errorEl) {
        errorEl.remove();
      }
    }

    return isValid;
  },

  /**
   * Validate entire form
   * @returns {boolean} Is valid
   */
  validateForm() {
    const form = document.getElementById('booking-form');
    if (!form) return false;

    const inputs = form.querySelectorAll('input[required]');
    let isValid = true;

    inputs.forEach(input => {
      if (!this.validateInput(input)) {
        isValid = false;
      }
    });

    return isValid;
  },

  /**
   * Get form data
   * @returns {Object} Form data
   */
  getFormData() {
    const form = document.getElementById('booking-form');
    if (!form) return null;

    const formData = new FormData(form);
    return {
      name: formData.get('name')?.trim() || '',
      phone: formData.get('phone')?.trim() || '',
      notes: formData.get('notes')?.trim() || ''
    };
  },

  /**
   * Submit booking
   */
  async submitBooking() {
    // Validate form
    if (!this.validateForm()) {
      Toast.warning('Моля, попълнете всички задължителни полета');
      return;
    }

    // Get form data
    const formData = this.getFormData();
    if (!formData) return;

    // Validate date and time
    if (!this.selectedDate || !this.selectedTime) {
      Toast.error('Моля, изберете дата и час');
      return;
    }

    // Prepare booking data
    const bookingData = {
      date: this.selectedDate,
      time: this.selectedTime,
      duration: this.selectedDuration,
      patientName: formData.name,
      patientPhone: formData.phone,
      notes: formData.notes,
      status: 'pending'
    };

    // Show loading
    const submitBtn = document.getElementById('booking-step2-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading__spinner loading__spinner--small"></span> Изпращане...';
    }

    try {
      let response;

      if (navigator.onLine) {
        // Submit to API
        response = await API.createBooking(bookingData);
      } else {
        // Queue for later
        await OfflineQueue.add('booking', bookingData);
        response = { success: true, offline: true };
      }

      if (response.success) {
        // Show success
        this.showSuccessMessage(bookingData, response.offline);
        
        // Clear saved data
        Utils.storage.remove('booking_draft');
        
        // Reset form
        this.reset();
      } else {
        throw new Error(response.error || 'Грешка при записване');
      }
    } catch (error) {
      Utils.error('Booking submission failed:', error);
      Toast.error(error.message || 'Грешка при изпращане на заявката');
    } finally {
      // Reset button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Потвърди записването';
      }
    }
  },

  /**
   * Show success message
   * @param {Object} bookingData - Booking data
   * @param {boolean} isOffline - Was submitted offline
   */
  showSuccessMessage(bookingData, isOffline = false) {
    const content = document.getElementById('booking-content');
    if (!content) return;

    const offlineNote = isOffline 
      ? '<p class="text-warning">⚠️ Заявката ще бъде изпратена при възстановяване на връзката.</p>'
      : '';

    content.innerHTML = `
      <div class="booking-success">
        <div class="booking-success__icon">✓</div>
        <h2 class="booking-success__title">Успешно изпратена заявка!</h2>
        <p class="booking-success__text">
          Вашата заявка за час на <strong>${Utils.formatDate(bookingData.date, 'long')}</strong> 
          в <strong>${bookingData.time}</strong> часа е получена.
        </p>
        <p class="booking-success__text">
          Ще получите SMS потвърждение на номер <strong>${bookingData.patientPhone}</strong>
          след одобрение от клиниката.
        </p>
        ${offlineNote}
        <div class="booking-success__actions">
          <a href="#/" class="btn btn--primary">Към началната страница</a>
          <button class="btn btn--outline" onclick="Booking.newBooking()">Нова заявка</button>
        </div>
      </div>
    `;
  },

  /**
   * Start new booking
   */
  newBooking() {
    // Navigate to booking and reinitialize
    Router.navigate('/booking');
    this.init();
  },

  /**
   * Save current data to localStorage (for recovery)
   */
  saveData() {
    const formData = this.getFormData();
    const data = {
      date: this.selectedDate,
      time: this.selectedTime,
      duration: this.selectedDuration,
      patient: formData,
      step: this.currentStep
    };
    Utils.storage.set('booking_draft', data);
  },

  /**
   * Load saved data from localStorage
   */
  loadSavedData() {
    const saved = Utils.storage.get('booking_draft');
    if (!saved) return;

    // Check if data is recent (less than 1 hour old)
    const savedTime = saved._savedAt || 0;
    const hourAgo = Date.now() - (60 * 60 * 1000);
    if (savedTime < hourAgo) {
      Utils.storage.remove('booking_draft');
      return;
    }

    // Restore data
    if (saved.date) {
      this.selectedDate = saved.date;
      this.calendar?.selectDate(saved.date);
    }
    if (saved.time) {
      this.selectedTime = saved.time;
    }
    if (saved.patient) {
      const form = document.getElementById('booking-form');
      if (form && saved.patient.name) {
        const nameInput = form.querySelector('input[name="name"]');
        if (nameInput) nameInput.value = saved.patient.name;
      }
      if (form && saved.patient.phone) {
        const phoneInput = form.querySelector('input[name="phone"]');
        if (phoneInput) phoneInput.value = saved.patient.phone;
      }
    }
  },

  /**
   * Cleanup
   */
  destroy() {
    this.saveData();
    Calendar.destroy();
    TimeSlots.destroy();
  }
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Booking;
}

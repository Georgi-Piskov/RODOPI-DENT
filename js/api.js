// API client for Rodopi Dent PWA

const API = {
  // Request timeout in milliseconds
  TIMEOUT: 5000,

  /**
   * Base fetch wrapper with error handling and timeout
   */
  async request(endpoint, options = {}) {
    const url = CONFIG.API_BASE_URL + endpoint;
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // Add auth token if available
    const token = Auth.getToken();
    if (token) {
      mergedOptions.headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
      // Check if online
      if (!Utils.isOnline()) {
        throw new Error('OFFLINE');
      }
      
      // Add timeout using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);
      mergedOptions.signal = controller.signal;
      
      const response = await fetch(url, mergedOptions);
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return { success: true, data };
      
    } catch (error) {
      console.error('API Error:', error);
      
      // Handle timeout
      if (error.name === 'AbortError') {
        return { success: false, error: 'TIMEOUT', message: 'Заявката отне твърде дълго' };
      }
      
      // Handle offline
      if (error.message === 'OFFLINE' || !navigator.onLine) {
        return { success: false, error: 'OFFLINE', message: 'Няма интернет връзка' };
      }
      
      return { success: false, error: error.message, message: 'Грешка при заявката' };
    }
  },

  // ============================================
  // Public Endpoints (Calendar-based with fallback)
  // ============================================

  /**
   * Get available time slots for a date
   * Tries Calendar endpoint first, falls back to Sheets if not available
   */
  async getSlots(date) {
    // Try new calendar-based endpoint first
    let result = await this.request(`${CONFIG.ENDPOINTS.PUBLIC_SLOTS}?date=${date}`);
    
    // If calendar endpoint fails (404 or error), fallback to old sheets endpoint
    if (!result.success && (result.error?.includes('404') || result.error?.includes('TIMEOUT'))) {
      console.log('Calendar endpoint unavailable, using fallback');
      result = await this.request(`${CONFIG.ENDPOINTS.SLOTS}?date=${date}`);
    }
    
    return result;
  },

  /**
   * Create a new booking
   * Tries Calendar endpoint first, falls back to Sheets if not available
   */
  async createBooking(bookingData) {
    // Try new calendar-based endpoint first
    let result = await this.request(CONFIG.ENDPOINTS.PUBLIC_BOOKING, {
      method: 'POST',
      body: JSON.stringify(bookingData)
    });
    
    // If calendar endpoint fails, fallback to old booking endpoint
    if (!result.success && (result.error?.includes('404') || result.error?.includes('TIMEOUT'))) {
      console.log('Calendar booking endpoint unavailable, using fallback');
      result = await this.request(CONFIG.ENDPOINTS.BOOKING, {
        method: 'POST',
        body: JSON.stringify(bookingData)
      });
    }
    
    return result;
  },

  /**
   * Cancel a booking
   */
  async cancelBooking(appointmentId, phone) {
    return this.request(CONFIG.ENDPOINTS.CANCEL, {
      method: 'POST',
      body: JSON.stringify({ appointmentId, phone })
    });
  },

  // ============================================
  // Admin Endpoints
  // ============================================

  /**
   * Get appointments (with optional filters)
   */
  async getAppointments(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const endpoint = params 
      ? `${CONFIG.ENDPOINTS.APPOINTMENTS}?${params}` 
      : CONFIG.ENDPOINTS.APPOINTMENTS;
    return this.request(endpoint);
  },

  /**
   * Confirm an appointment with duration
   */
  async confirmAppointment(appointmentId, duration = 30) {
    return this.request(CONFIG.ENDPOINTS.CONFIRM, {
      method: 'POST',
      body: JSON.stringify({ appointmentId, status: 'confirmed', duration })
    });
  },

  /**
   * Update appointment status
   */
  async updateAppointmentStatus(appointmentId, status) {
    return this.request(CONFIG.ENDPOINTS.CONFIRM, {
      method: 'POST',
      body: JSON.stringify({ appointmentId, status })
    });
  },

  /**
   * Get procedures list
   */
  async getProcedures() {
    return this.request(CONFIG.ENDPOINTS.PROCEDURES);
  },

  /**
   * Get NHIF prices
   */
  async getNHIFPrices() {
    return this.request(CONFIG.ENDPOINTS.NHIF_PRICES);
  },

  /**
   * Get settings
   */
  async getSettings() {
    return this.request(CONFIG.ENDPOINTS.SETTINGS);
  },

  /**
   * Update settings
   */
  async updateSettings(settings) {
    return this.request(CONFIG.ENDPOINTS.SETTINGS, {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  },

  /**
   * Get finance records
   */
  async getFinance(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const endpoint = params 
      ? `${CONFIG.ENDPOINTS.FINANCE}?${params}` 
      : CONFIG.ENDPOINTS.FINANCE;
    return this.request(endpoint);
  },

  /**
   * Add finance record
   */
  async addFinanceRecord(record) {
    return this.request(CONFIG.ENDPOINTS.FINANCE_ADD, {
      method: 'POST',
      body: JSON.stringify(record)
    });
  },

  /**
   * Update finance record
   */
  async updateFinanceRecord(id, updates) {
    return this.request(CONFIG.ENDPOINTS.FINANCE_UPDATE, {
      method: 'POST',
      body: JSON.stringify({ id, ...updates })
    });
  },

  /**
   * Delete finance record
   */
  async deleteFinanceRecord(id) {
    return this.request(CONFIG.ENDPOINTS.FINANCE_DELETE, {
      method: 'POST',
      body: JSON.stringify({ id })
    });
  },

  // ============================================
  // Google Calendar Endpoints
  // ============================================

  /**
   * Get calendar events for a period
   * @param {Object} params - { startDate, endDate, view }
   */
  async getCalendarEvents(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const endpoint = queryParams 
      ? `${CONFIG.ENDPOINTS.CALENDAR_EVENTS}?${queryParams}` 
      : CONFIG.ENDPOINTS.CALENDAR_EVENTS;
    return this.request(endpoint);
  },

  /**
   * Create a new calendar event
   * @param {Object} eventData - { patientName, patientPhone, date, startTime, duration, procedure, notes }
   */
  async createCalendarEvent(eventData) {
    return this.request(CONFIG.ENDPOINTS.CALENDAR_CREATE, {
      method: 'POST',
      body: JSON.stringify(eventData)
    });
  },

  /**
   * Update an existing calendar event
   * @param {Object} eventData - { eventId, patientName, patientPhone, date, startTime, duration, procedure, notes }
   */
  async updateCalendarEvent(eventData) {
    return this.request(CONFIG.ENDPOINTS.CALENDAR_UPDATE, {
      method: 'POST',
      body: JSON.stringify(eventData)
    });
  },

  /**
   * Delete a calendar event
   * @param {string} eventId - The Google Calendar event ID
   */
  async deleteCalendarEvent(eventId) {
    return this.request(CONFIG.ENDPOINTS.CALENDAR_DELETE, {
      method: 'POST',
      body: JSON.stringify({ eventId })
    });
  },

  /**
   * Send SMS to patient
   * @param {Object} smsData - { phone, message, template?, date?, time?, duration?, patientName? }
   * Templates: booking_received, booking_confirmed, booking_rejected, booking_conflict, booking_expired, reminder
   */
  async sendSMS(smsData) {
    return this.request(CONFIG.ENDPOINTS.SEND_SMS, {
      method: 'POST',
      body: JSON.stringify(smsData)
    });
  }
};

// Export for use
window.API = API;

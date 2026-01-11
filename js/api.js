/**
 * API Client
 * Handles all communication with n8n webhooks
 */

const API = {
  /**
   * Base fetch wrapper with error handling
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Response data
   */
  async request(endpoint, options = {}) {
    const url = CONFIG.API.BASE_URL + endpoint;
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    // Add auth token if available and not a public endpoint
    const token = Auth.getToken();
    if (token && !endpoint.includes('booking') && !endpoint.includes('availability')) {
      defaultOptions.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const fetchOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };
    
    Utils.log('API Request:', url, fetchOptions);
    
    try {
      const response = await fetch(url, fetchOptions);
      
      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      
      Utils.log('API Response:', response.status, data);
      
      if (!response.ok) {
        throw new APIError(
          data.message || data.error || 'Възникна грешка',
          response.status,
          data
        );
      }
      
      return data;
    } catch (error) {
      // Check if offline
      if (!navigator.onLine) {
        // Queue for later sync if it's a write operation
        if (options.method && options.method !== 'GET') {
          await OfflineQueue.add({
            endpoint,
            options: fetchOptions,
            timestamp: Date.now()
          });
          
          return {
            queued: true,
            message: 'Заявката е запазена и ще бъде изпратена при връзка'
          };
        }
        
        throw new APIError('Няма връзка с интернет', 0, null);
      }
      
      // Re-throw API errors
      if (error instanceof APIError) {
        throw error;
      }
      
      // Wrap other errors
      Utils.error('API Error:', error);
      throw new APIError('Грешка при връзка със сървъра', 0, error);
    }
  },

  /**
   * GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Response data
   */
  async get(endpoint, params = {}) {
    const queryString = Utils.buildQueryString(params);
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    
    return this.request(url, { method: 'GET' });
  },

  /**
   * POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @returns {Promise<Object>} Response data
   */
  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  /**
   * PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @returns {Promise<Object>} Response data
   */
  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  /**
   * DELETE request
   * @param {string} endpoint - API endpoint
   * @returns {Promise<Object>} Response data
   */
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },

  // ==========================================
  // Public Endpoints (Patient-facing)
  // ==========================================

  /**
   * Get available time slots for a date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Object>} Available slots and settings
   */
  async getAvailability(date) {
    return this.get(CONFIG.API.ENDPOINTS.PUBLIC_AVAILABILITY, { date });
  },

  /**
   * Create a new booking request
   * @param {Object} bookingData - Booking details
   * @returns {Promise<Object>} Booking confirmation
   */
  async createBooking(bookingData) {
    return this.post(CONFIG.API.ENDPOINTS.PUBLIC_BOOKING, {
      patientName: bookingData.patientName,
      patientPhone: Utils.normalizePhone(bookingData.patientPhone),
      date: bookingData.date,
      startTime: bookingData.time,
      duration: CONFIG.SCHEDULE.DEFAULT_SLOT_DURATION,
      reason: bookingData.reason || ''
    });
  },

  /**
   * Cancel an appointment (patient-initiated)
   * @param {string} appointmentId - Appointment ID
   * @param {string} cancellationCode - Cancellation verification code
   * @returns {Promise<Object>} Cancellation confirmation
   */
  async cancelBooking(appointmentId, cancellationCode) {
    return this.post(CONFIG.API.ENDPOINTS.PUBLIC_CANCEL, {
      appointmentId,
      cancellationCode
    });
  },

  // ==========================================
  // Admin Endpoints
  // ==========================================

  /**
   * Get all appointments (with optional filters)
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Appointments list
   */
  async getAppointments(filters = {}) {
    return this.get(CONFIG.API.ENDPOINTS.ADMIN_APPOINTMENTS, filters);
  },

  /**
   * Get single appointment by ID
   * @param {string} id - Appointment ID
   * @returns {Promise<Object>} Appointment data
   */
  async getAppointment(id) {
    return this.get(`${CONFIG.API.ENDPOINTS.ADMIN_APPOINTMENTS}/${id}`);
  },

  /**
   * Create appointment (admin-initiated)
   * @param {Object} appointmentData - Appointment details
   * @returns {Promise<Object>} Created appointment
   */
  async createAppointment(appointmentData) {
    return this.post(CONFIG.API.ENDPOINTS.ADMIN_APPOINTMENTS, {
      patientName: appointmentData.patientName,
      patientPhone: Utils.normalizePhone(appointmentData.patientPhone),
      date: appointmentData.date,
      startTime: appointmentData.startTime,
      duration: appointmentData.duration || CONFIG.SCHEDULE.DEFAULT_SLOT_DURATION,
      reason: appointmentData.reason || '',
      status: 'confirmed', // Admin-created appointments are auto-confirmed
      sendSms: appointmentData.sendSms !== false
    });
  },

  /**
   * Update appointment
   * @param {string} id - Appointment ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated appointment
   */
  async updateAppointment(id, updates) {
    return this.put(`${CONFIG.API.ENDPOINTS.ADMIN_APPOINTMENTS}/${id}`, updates);
  },

  /**
   * Confirm pending appointment
   * @param {string} id - Appointment ID
   * @returns {Promise<Object>} Confirmed appointment
   */
  async confirmAppointment(id) {
    return this.post(CONFIG.API.ENDPOINTS.ADMIN_CONFIRM, {
      appointmentId: id,
      action: 'confirm'
    });
  },

  /**
   * Cancel appointment (admin-initiated)
   * @param {string} id - Appointment ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancelled appointment
   */
  async cancelAppointment(id, reason = '') {
    return this.post(CONFIG.API.ENDPOINTS.ADMIN_CONFIRM, {
      appointmentId: id,
      action: 'cancel',
      reason
    });
  },

  /**
   * Mark appointment as completed
   * @param {string} id - Appointment ID
   * @returns {Promise<Object>} Completed appointment
   */
  async completeAppointment(id) {
    return this.post(CONFIG.API.ENDPOINTS.ADMIN_CONFIRM, {
      appointmentId: id,
      action: 'complete'
    });
  },

  // ==========================================
  // Finance Endpoints
  // ==========================================

  /**
   * Get financial transactions
   * @param {Object} filters - Filter options (dateFrom, dateTo, type)
   * @returns {Promise<Array>} Transactions list
   */
  async getTransactions(filters = {}) {
    return this.get(CONFIG.API.ENDPOINTS.ADMIN_FINANCE, filters);
  },

  /**
   * Add revenue entry
   * @param {Object} revenueData - Revenue details
   * @returns {Promise<Object>} Created transaction
   */
  async addRevenue(revenueData) {
    return this.post(CONFIG.API.ENDPOINTS.ADMIN_FINANCE, {
      type: revenueData.type, // 'official' or 'custom'
      appointmentId: revenueData.appointmentId || null,
      procedureCode: revenueData.procedureCode || null,
      amount: revenueData.amount,
      description: revenueData.description || '',
      paymentMethod: revenueData.paymentMethod || 'cash',
      notes: revenueData.notes || '',
      date: revenueData.date || Utils.formatDateISO(new Date())
    });
  },

  /**
   * Get financial summary
   * @param {string} period - Period ('today', 'week', 'month')
   * @returns {Promise<Object>} Summary data
   */
  async getFinanceSummary(period = 'month') {
    return this.get(`${CONFIG.API.ENDPOINTS.ADMIN_FINANCE}/summary`, { period });
  },

  // ==========================================
  // Procedures Endpoints
  // ==========================================

  /**
   * Get all NHIF procedures
   * @returns {Promise<Array>} Procedures list
   */
  async getProcedures() {
    // Check cache first
    const cached = Utils.storage.get('procedures_cache');
    if (cached && Date.now() - cached.timestamp < CONFIG.CACHE.PROCEDURES_TTL) {
      return cached.data;
    }
    
    const data = await this.get(CONFIG.API.ENDPOINTS.ADMIN_PROCEDURES);
    
    // Cache the result
    Utils.storage.set('procedures_cache', {
      data,
      timestamp: Date.now()
    });
    
    return data;
  },

  /**
   * Search procedures by name or code
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching procedures
   */
  async searchProcedures(query) {
    const procedures = await this.getProcedures();
    const lowerQuery = query.toLowerCase();
    
    return procedures.filter(p => 
      p.description.toLowerCase().includes(lowerQuery) ||
      p.nhifCode.includes(query) ||
      p.ksmpCode.includes(query)
    );
  },

  // ==========================================
  // Settings Endpoints
  // ==========================================

  /**
   * Get clinic settings
   * @returns {Promise<Object>} Settings object
   */
  async getSettings() {
    // Check cache first
    const cached = Utils.storage.get('settings_cache');
    if (cached && Date.now() - cached.timestamp < CONFIG.CACHE.SETTINGS_TTL) {
      return cached.data;
    }
    
    const data = await this.get(CONFIG.API.ENDPOINTS.ADMIN_SETTINGS);
    
    // Cache the result
    Utils.storage.set('settings_cache', {
      data,
      timestamp: Date.now()
    });
    
    return data;
  },

  /**
   * Update clinic settings
   * @param {Object} settings - Settings to update
   * @returns {Promise<Object>} Updated settings
   */
  async updateSettings(settings) {
    const result = await this.put(CONFIG.API.ENDPOINTS.ADMIN_SETTINGS, settings);
    
    // Clear cache
    Utils.storage.remove('settings_cache');
    
    return result;
  },

  /**
   * Add special date
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} type - 'open' or 'closed'
   * @returns {Promise<Object>} Updated special dates
   */
  async addSpecialDate(date, type) {
    return this.post(`${CONFIG.API.ENDPOINTS.ADMIN_SETTINGS}/special-dates`, {
      date,
      type
    });
  },

  /**
   * Remove special date
   * @param {string} date - Date to remove
   * @returns {Promise<Object>} Updated special dates
   */
  async removeSpecialDate(date) {
    return this.delete(`${CONFIG.API.ENDPOINTS.ADMIN_SETTINGS}/special-dates/${date}`);
  }
};

/**
 * Custom API Error class
 */
class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API, APIError };
}

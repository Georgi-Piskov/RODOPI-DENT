/**
 * Utility Functions
 * Common helper functions used throughout the application
 */

const Utils = {
  /**
   * Generate a unique ID
   * @returns {string} UUID v4
   */
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  /**
   * Format date to various formats
   * @param {Date|string} date - Date to format
   * @param {string|boolean} format - Format type: 'iso', 'long', 'short', or boolean for includeWeekday
   * @returns {string} Formatted date string
   */
  formatDate(date, format = 'short') {
    const d = new Date(date);
    
    // Handle ISO format
    if (format === 'iso') {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    const day = d.getDate();
    const month = CONFIG.MONTH_NAMES[d.getMonth()];
    const year = d.getFullYear();
    
    // Handle 'long' format (with weekday)
    if (format === 'long' || format === true) {
      const weekday = CONFIG.DAY_NAMES_FULL[d.getDay()];
      return `${weekday}, ${day} ${month} ${year}`;
    }
    
    // Default 'short' format
    return `${day} ${month} ${year}`;
  },

  /**
   * Format date to ISO format (YYYY-MM-DD)
   * @param {Date} date - Date to format
   * @returns {string} ISO date string
   */
  formatDateISO(date) {
    return this.formatDate(date, 'iso');
  },

  /**
   * Format time to HH:MM format
   * @param {string|Date} time - Time to format
   * @returns {string} Formatted time string
   */
  formatTime(time) {
    if (typeof time === 'string' && time.includes(':')) {
      return time.substring(0, 5);
    }
    const d = new Date(time);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  /**
   * Format currency in EUR
   * @param {number} amount - Amount to format
   * @returns {string} Formatted currency string
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('bg-BG', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(amount);
  },

  /**
   * Parse time string to minutes since midnight
   * @param {string} time - Time in HH:MM format
   * @returns {number} Minutes since midnight
   */
  timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  },

  /**
   * Convert minutes since midnight to time string
   * @param {number} minutes - Minutes since midnight
   * @returns {string} Time in HH:MM format
   */
  minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  },

  /**
   * Validate Bulgarian phone number
   * @param {string} phone - Phone number to validate
   * @returns {boolean} Is valid
   */
  isValidPhone(phone) {
    // Accept formats: +359XXXXXXXXX, 0XXXXXXXXX, 359XXXXXXXXX
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    return /^(\+?359|0)[0-9]{9}$/.test(cleaned);
  },

  /**
   * Normalize phone number to +359 format
   * @param {string} phone - Phone number to normalize
   * @returns {string} Normalized phone number
   */
  normalizePhone(phone) {
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    if (cleaned.startsWith('0')) {
      cleaned = '+359' + cleaned.substring(1);
    } else if (cleaned.startsWith('359')) {
      cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+359' + cleaned;
    }
    
    return cleaned;
  },

  /**
   * Debounce function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in ms
   * @returns {Function} Debounced function
   */
  debounce(func, wait = CONFIG.UI.DEBOUNCE_DELAY) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle function
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in ms
   * @returns {Function} Throttled function
   */
  throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Deep clone an object
   * @param {Object} obj - Object to clone
   * @returns {Object} Cloned object
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * Check if date is today
   * @param {Date|string} date - Date to check
   * @returns {boolean} Is today
   */
  isToday(date) {
    const d = new Date(date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  },

  /**
   * Check if date is in the past
   * @param {Date|string} date - Date to check
   * @returns {boolean} Is past
   */
  isPast(date) {
    const d = new Date(date);
    const now = new Date();
    d.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    return d < now;
  },

  /**
   * Check if date is a working day
   * @param {Date} date - Date to check
   * @param {Array} workingDays - Array of working day numbers (1-7, Monday-Sunday)
   * @param {Array} specialDates - Array of special dates {date, type}
   * @returns {boolean} Is working day
   */
  isWorkingDay(date, workingDays = CONFIG.SCHEDULE.WORKING_DAYS, specialDates = []) {
    const dateStr = this.formatDateISO(date);
    
    // Check special dates first
    const special = specialDates.find(s => s.date === dateStr);
    if (special) {
      return special.type === 'open';
    }
    
    // Check regular working days (convert JS day to ISO: 0=Sunday -> 7, 1-6 stay same)
    const jsDay = date.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;
    return workingDays.includes(isoDay);
  },

  /**
   * Get available time slots for a date
   * @param {Date} date - Date to get slots for
   * @param {Array} bookedSlots - Array of booked appointments
   * @param {Object} settings - Work hours settings
   * @returns {Array} Available time slots
   */
  getAvailableSlots(date, bookedSlots = [], settings = CONFIG.SCHEDULE.WORK_HOURS) {
    const slots = [];
    const slotDuration = CONFIG.SCHEDULE.DEFAULT_SLOT_DURATION;
    
    // Morning slots
    let currentTime = this.timeToMinutes(settings.MORNING_START);
    const morningEnd = this.timeToMinutes(settings.MORNING_END);
    
    while (currentTime + slotDuration <= morningEnd) {
      const timeStr = this.minutesToTime(currentTime);
      const isBooked = this.isSlotBooked(date, timeStr, slotDuration, bookedSlots);
      
      slots.push({
        time: timeStr,
        available: !isBooked
      });
      
      currentTime += slotDuration;
    }
    
    // Afternoon slots
    currentTime = this.timeToMinutes(settings.AFTERNOON_START);
    const afternoonEnd = this.timeToMinutes(settings.AFTERNOON_END);
    
    while (currentTime + slotDuration <= afternoonEnd) {
      const timeStr = this.minutesToTime(currentTime);
      const isBooked = this.isSlotBooked(date, timeStr, slotDuration, bookedSlots);
      
      slots.push({
        time: timeStr,
        available: !isBooked
      });
      
      currentTime += slotDuration;
    }
    
    // Filter out past slots if date is today
    if (this.isToday(date)) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const minAdvance = CONFIG.BOOKING.MIN_ADVANCE_HOURS * 60;
      
      return slots.map(slot => ({
        ...slot,
        available: slot.available && this.timeToMinutes(slot.time) > currentMinutes + minAdvance
      }));
    }
    
    return slots;
  },

  /**
   * Check if a time slot is booked
   * @param {Date} date - Date to check
   * @param {string} time - Time to check
   * @param {number} duration - Duration in minutes
   * @param {Array} bookedSlots - Array of booked appointments
   * @returns {boolean} Is booked
   */
  isSlotBooked(date, time, duration, bookedSlots) {
    const dateStr = this.formatDateISO(date);
    const slotStart = this.timeToMinutes(time);
    const slotEnd = slotStart + duration;
    
    return bookedSlots.some(booking => {
      if (booking.date !== dateStr) return false;
      if (booking.status === 'cancelled') return false;
      
      const bookingStart = this.timeToMinutes(booking.startTime);
      const bookingEnd = bookingStart + (booking.duration || 60);
      
      // Check for overlap
      return slotStart < bookingEnd && slotEnd > bookingStart;
    });
  },

  /**
   * Get days in month
   * @param {number} year - Year
   * @param {number} month - Month (0-11)
   * @returns {number} Number of days
   */
  getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  },

  /**
   * Get first day of month (0-6, Sunday-Saturday)
   * @param {number} year - Year
   * @param {number} month - Month (0-11)
   * @returns {number} Day of week
   */
  getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
  },

  /**
   * Add days to date
   * @param {Date} date - Base date
   * @param {number} days - Days to add
   * @returns {Date} New date
   */
  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },

  /**
   * Get start of week (Monday)
   * @param {Date} date - Date
   * @returns {Date} Start of week
   */
  getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  },

  /**
   * Escape HTML to prevent XSS
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Parse query string
   * @param {string} queryString - Query string to parse
   * @returns {Object} Parsed parameters
   */
  parseQueryString(queryString) {
    const params = {};
    const searchParams = new URLSearchParams(queryString);
    for (const [key, value] of searchParams) {
      params[key] = value;
    }
    return params;
  },

  /**
   * Build query string from object
   * @param {Object} params - Parameters object
   * @returns {string} Query string
   */
  buildQueryString(params) {
    return new URLSearchParams(params).toString();
  },

  /**
   * Local storage helpers with JSON support
   */
  storage: {
    get(key, defaultValue = null) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (e) {
        console.error('Storage get error:', e);
        return defaultValue;
      }
    },
    
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        console.error('Storage set error:', e);
        return false;
      }
    },
    
    remove(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (e) {
        console.error('Storage remove error:', e);
        return false;
      }
    },
    
    clear() {
      try {
        localStorage.clear();
        return true;
      } catch (e) {
        console.error('Storage clear error:', e);
        return false;
      }
    }
  },

  /**
   * Log with debug mode check
   * @param {...any} args - Arguments to log
   */
  log(...args) {
    if (CONFIG.DEBUG) {
      console.log('[Rodopi Dent]', ...args);
    }
  },

  /**
   * Log error
   * @param {...any} args - Arguments to log
   */
  error(...args) {
    console.error('[Rodopi Dent Error]', ...args);
  }
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}

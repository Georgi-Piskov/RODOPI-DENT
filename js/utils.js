// Utility functions for Rodopi Dent PWA

const Utils = {
  /**
   * Format date to YYYY-MM-DD (local timezone)
   */
  formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Format date for display (Bulgarian format)
   */
  formatDateBG(date) {
    const d = new Date(date);
    return d.toLocaleDateString('bg-BG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  /**
   * Format time to HH:MM
   */
  formatTime(time) {
    if (!time) return '';
    return time.substring(0, 5);
  },

  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  /**
   * Get today's date as YYYY-MM-DD
   */
  today() {
    return this.formatDate(new Date());
  },

  /**
   * Format date to ISO string (YYYY-MM-DD) from Date object
   */
  formatDateISO(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Check if a date is a working day
   */
  isWorkingDay(date) {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    return CONFIG.WORKING_DAYS.includes(dayOfWeek);
  },

  /**
   * Get available time slots for a given date
   * Uses SLOT_INTERVAL for spacing between slots
   */
  getTimeSlots(interval = CONFIG.SLOT_INTERVAL || 30) {
    const slots = [];
    const { morning, afternoon } = CONFIG.WORKING_HOURS;
    
    // Morning slots
    let current = this.timeToMinutes(morning.start);
    const morningEnd = this.timeToMinutes(morning.end);
    while (current < morningEnd) {
      slots.push(this.minutesToTime(current));
      current += interval;
    }
    
    // Afternoon slots
    current = this.timeToMinutes(afternoon.start);
    const afternoonEnd = this.timeToMinutes(afternoon.end);
    while (current < afternoonEnd) {
      slots.push(this.minutesToTime(current));
      current += interval;
    }
    
    return slots;
  },

  /**
   * Convert time string (HH:MM) to minutes
   */
  timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  },

  /**
   * Convert minutes to time string (HH:MM)
   */
  minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  },

  /**
   * Validate Bulgarian phone number
   */
  validatePhone(phone) {
    const cleaned = phone.replace(/\s/g, '');
    // Bulgarian phone formats: 0888123456, +359888123456
    return /^(\+359|0)[0-9]{9}$/.test(cleaned);
  },

  /**
   * Format phone number for display
   */
  formatPhone(phone) {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.startsWith('+359')) {
      return cleaned.replace(/(\+359)(\d{2})(\d{3})(\d{4})/, '$1 $2 $3 $4');
    }
    return cleaned.replace(/^0(\d{2})(\d{3})(\d{4})$/, '0$1 $2 $3');
  },

  /**
   * Show loading overlay
   */
  showLoading() {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Зареждане...</p>
      `;
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
        font-size: 1.2rem;
      `;
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
  },

  /**
   * Hide loading overlay
   */
  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  },

  /**
   * Show toast notification
   */
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /**
   * Debounce function
   */
  debounce(func, wait) {
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
   * Deep clone an object
   */
  clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * Check if online
   */
  isOnline() {
    return navigator.onLine;
  },

  /**
   * Get status label in Bulgarian
   */
  getStatusLabel(status) {
    return CONFIG.STATUS_LABELS[status] || status;
  },

  /**
   * Get status color
   */
  getStatusColor(status) {
    return CONFIG.STATUS_COLORS[status] || '#gray';
  },

  /**
   * Format currency (BGN)
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('bg-BG', {
      style: 'currency',
      currency: 'BGN'
    }).format(amount);
  },

  /**
   * Parse query string
   */
  parseQuery(queryString) {
    const params = new URLSearchParams(queryString);
    const result = {};
    for (const [key, value] of params) {
      result[key] = value;
    }
    return result;
  },

  /**
   * Local storage helpers with JSON support
   */
  storage: {
    get(key, defaultValue = null) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch {
        return defaultValue;
      }
    },
    
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    
    remove(key) {
      localStorage.removeItem(key);
    }
  }
};

// Export for use
window.Utils = Utils;

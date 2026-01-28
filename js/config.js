// Configuration for Rodopi Dent PWA
const CONFIG = {
  // App info
  APP_NAME: 'Родопи Дент',
  APP_VERSION: '1.0.0',
  
  // API Configuration
  API_BASE_URL: 'https://n8n.simeontsvetanovn8nworkflows.site/webhook',
  
  // Google Sheets ID
  SHEETS_ID: '1hv4XAfHhScA40Bm1kQ3I-Ih4SJuCBpOJxTOYDNb167g',
  
  // Google Calendar ID
  CALENDAR_ID: 'rodopi.dent@gmail.com',
  
  // API Endpoints
  ENDPOINTS: {
    // Old Sheet-based endpoints (deprecated)
    SLOTS: '/slots-webhook',
    BOOKING: '/booking-webhook',
    CANCEL: '/cancel-webhook',
    APPOINTMENTS: '/appointments-webhook',
    CONFIRM: '/confirm-webhook',
    PROCEDURES: '/procedures-webhook',
    SETTINGS: '/settings-webhook',
    
    // Finance endpoints
    FINANCE: '/finance-webhook',
    FINANCE_ADD: '/finance-add',
    NHIF_PRICES: '/nhif-prices',
    
    // Calendar endpoints (admin)
    CALENDAR_EVENTS: '/calendar-events',
    CALENDAR_CREATE: '/calendar-create',
    CALENDAR_UPDATE: '/calendar-update',
    CALENDAR_DELETE: '/calendar-delete',
    
    // Public Calendar endpoints (patient booking)
    PUBLIC_SLOTS: '/public-slots',
    PUBLIC_BOOKING: '/public-booking',
    
    // SMS endpoint
    SEND_SMS: '/send-sms'
  },
  
  // Google OAuth2 Configuration
  GOOGLE_CLIENT_ID: '758029403966-j68sst10c2pjtd2qllk6j34esqsn319n.apps.googleusercontent.com',
  
  // Working hours (real schedule)
  WORKING_HOURS: {
    morning: { start: '09:00', end: '12:00' },
    afternoon: { start: '13:30', end: '18:00' }  // Last slot at 17:30
  },
  
  // Working days (0 = Sunday, 1 = Monday, etc.)
  WORKING_DAYS: [1, 2, 3, 4, 5], // Monday to Friday
  
  // Slot interval in minutes (how often slots appear)
  SLOT_INTERVAL: 30,
  
  // Default appointment duration in minutes
  DEFAULT_DURATION: 30,
  
  // Available durations for appointments
  DURATIONS: [30, 45, 60, 90, 120],
  
  // Appointment statuses
  STATUSES: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },
  
  // Status colors (for UI)
  STATUS_COLORS: {
    pending: '#fbbf24',
    confirmed: '#22c55e',
    completed: '#3b82f6',
    cancelled: '#ef4444'
  },
  
  // Status labels in Bulgarian
  STATUS_LABELS: {
    pending: 'Чакащ',
    confirmed: 'Потвърден',
    completed: 'Завършен',
    cancelled: 'Отменен'
  },
  
  // Finance types
  FINANCE_TYPES: {
    OFFICIAL: 'official',
    CUSTOM: 'custom'
  },
  
  // Payment methods
  PAYMENT_METHODS: {
    CASH: 'cash',
    CARD: 'card',
    BANK_TRANSFER: 'bank_transfer'
  },
  
  // IndexedDB configuration for offline support
  INDEXED_DB: {
    NAME: 'RodopiDentDB',
    VERSION: 1,
    STORES: {
      APPOINTMENTS: 'appointments',
      FINANCE: 'finance',
      SETTINGS: 'settings',
      PENDING_SYNC: 'pendingSync'
    }
  },
  
  // Demo mode (when API is unavailable)
  DEMO_MODE: false
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.ENDPOINTS);
Object.freeze(CONFIG.WORKING_HOURS);
Object.freeze(CONFIG.STATUSES);
Object.freeze(CONFIG.STATUS_COLORS);
Object.freeze(CONFIG.STATUS_LABELS);
Object.freeze(CONFIG.INDEXED_DB);

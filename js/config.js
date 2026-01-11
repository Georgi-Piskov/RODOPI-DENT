/**
 * Application Configuration
 * Contains all configurable settings for the Rodopi Dent PWA
 */

const CONFIG = {
  // App Info
  APP_NAME: 'Родопи Дент',
  APP_VERSION: '1.0.0',
  
  // Clinic Information (to be updated)
  CLINIC: {
    name: 'Родопи Дент',
    doctor: 'Д-р',
    phone: '+359 00 000 0000',
    address: 'Адресът ще бъде добавен',
    email: ''
  },
  
  // Google Sheets ID
  GOOGLE_SHEETS_ID: '1hv4XAfHhScA40Bm1kQ3I-Ih4SJuCBpOJxTOYDNb167g',
  
  // n8n Webhook URLs
  API: {
    BASE_URL: 'https://n8n.simeontsvetanovn8nworkflows.site',
    ENDPOINTS: {
      // Public endpoints
      PUBLIC_SLOTS: '/webhook/slots-webhook',
      PUBLIC_BOOKING: '/webhook/booking-webhook',
      PUBLIC_CANCEL: '/webhook/cancel-webhook',
      
      // Admin endpoints
      ADMIN_AUTH: '/webhook/auth-webhook',
      ADMIN_APPOINTMENTS: '/webhook/appointments-webhook',
      ADMIN_CONFIRM: '/webhook/confirm-webhook',
      ADMIN_FINANCE: '/webhook/finance-webhook',
      ADMIN_SETTINGS: '/webhook/settings-webhook',
      ADMIN_PROCEDURES: '/webhook/procedures-webhook'
    }
  },
  
  // Google OAuth2 Configuration
  OAUTH: {
    CLIENT_ID: '', // To be configured
    REDIRECT_URI: window.location.origin + window.location.pathname,
    SCOPES: ['email', 'profile']
  },
  
  // Work Schedule Defaults
  SCHEDULE: {
    WORK_HOURS: {
      MORNING_START: '09:00',
      MORNING_END: '12:00',
      AFTERNOON_START: '13:30',
      AFTERNOON_END: '17:00'
    },
    WORKING_DAYS: [1, 2, 3, 4, 5], // Monday to Friday (ISO week days)
    DEFAULT_SLOT_DURATION: 60, // minutes
    SLOT_DURATIONS: [30, 60, 90, 120, 180] // Available duration options
  },
  
  // Booking Configuration
  BOOKING: {
    MIN_ADVANCE_HOURS: 2, // Minimum hours in advance to book
    MAX_ADVANCE_DAYS: 60, // Maximum days in advance to book
    CANCELLATION_DEADLINE_DAYS: 1 // Days before appointment when cancellation is allowed
  },
  
  // SMS Templates
  SMS_TEMPLATES: {
    CONFIRMATION: 'Здравейте, {patientName}!\n\nВашият час при {doctorName} е потвърден:\n📅 Дата: {date}\n🕐 Час: {time}\n\nЗа отказ: {cancelLink}\n\nРодопи Дент\n{clinicPhone}',
    CANCELLATION: 'Здравейте, {patientName}!\n\nВашият час на {date} от {time} е отменен.\n\nЗа нова резервация: {bookingLink}\n\nРодопи Дент\n{clinicPhone}',
    REMINDER: 'Здравейте, {patientName}!\n\nУтре имате час при {doctorName}:\n🕐 Час: {time}\n\nРодопи Дент\n{clinicPhone}'
  },
  
  // UI Settings
  UI: {
    TOAST_DURATION: 4000, // milliseconds
    DEBOUNCE_DELAY: 300, // milliseconds for search inputs
    ANIMATION_DURATION: 200 // milliseconds
  },
  
  // Cache Settings
  CACHE: {
    APPOINTMENTS_TTL: 5 * 60 * 1000, // 5 minutes
    PROCEDURES_TTL: 24 * 60 * 60 * 1000, // 24 hours
    SETTINGS_TTL: 60 * 60 * 1000 // 1 hour
  },
  
  // Status Labels (Bulgarian)
  STATUS_LABELS: {
    pending: 'Чакащ',
    confirmed: 'Потвърден',
    cancelled: 'Отменен',
    completed: 'Завършен'
  },
  
  // Payment Method Labels
  PAYMENT_METHODS: {
    cash: 'В брой',
    card: 'С карта',
    bank_transfer: 'Банков превод'
  },
  
  // Procedure Categories
  PROCEDURE_CATEGORIES: [
    { id: 'exams', name: 'Прегледи' },
    { id: 'fillings', name: 'Обтурации' },
    { id: 'extractions', name: 'Екстракции' },
    { id: 'endodontics', name: 'Ендодонтия' },
    { id: 'prosthetics', name: 'Протези' }
  ],
  
  // Internationalization (Bulgarian)
  I18N: {
    DAYS_SHORT: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
    DAYS: ['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота', 'Неделя'],
    MONTHS: [
      'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
      'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'
    ]
  },
  
  // Day Names (Bulgarian) - legacy
  DAY_NAMES: ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  DAY_NAMES_FULL: ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'],
  
  // Month Names (Bulgarian) - legacy
  MONTH_NAMES: [
    'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
    'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'
  ],
  
  // Debug Mode - enabled for development (localhost, 127.0.0.1, or github.io pages)
  DEBUG: window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' ||
         window.location.hostname.endsWith('.github.io')
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.CLINIC);
Object.freeze(CONFIG.API);
Object.freeze(CONFIG.I18N);
Object.freeze(CONFIG.API.ENDPOINTS);
Object.freeze(CONFIG.OAUTH);
Object.freeze(CONFIG.SCHEDULE);
Object.freeze(CONFIG.SCHEDULE.WORK_HOURS);
Object.freeze(CONFIG.BOOKING);
Object.freeze(CONFIG.SMS_TEMPLATES);
Object.freeze(CONFIG.UI);
Object.freeze(CONFIG.CACHE);
Object.freeze(CONFIG.STATUS_LABELS);
Object.freeze(CONFIG.PAYMENT_METHODS);
Object.freeze(CONFIG.PROCEDURE_CATEGORIES);

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}

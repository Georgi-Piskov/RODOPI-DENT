/**
 * Rodopi Dent PWA - Main Application
 * Entry point and initialization
 */

const App = {
  initialized: false,
  currentPage: null,

  /**
   * Initialize the application
   */
  async init() {
    if (this.initialized) return;

    Utils.log('App: Initializing Rodopi Dent PWA');

    try {
      // Register service worker
      await this.registerServiceWorker();

      // Initialize core modules
      Modal.init();
      Toast.init();
      Auth.init();
      OfflineStatus.init();
      OfflineQueue.init();

      // Setup router
      this.setupRouter();

      // Setup global event listeners
      this.setupEventListeners();

      // Check authentication state
      await this.checkAuth();

      // Handle initial route
      Router.handleRoute();

      this.initialized = true;
      Utils.log('App: Initialization complete');

    } catch (error) {
      Utils.error('App initialization failed:', error);
      Toast.error('Грешка при стартиране на приложението');
    }
  },

  /**
   * Register service worker
   */
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      Utils.log('Service Worker not supported');
      return;
    }

    try {
      // Get base path for GitHub Pages compatibility
      const basePath = window.location.pathname.replace(/\/[^\/]*$/, '/');
      const swPath = basePath + 'sw.js';
      
      const registration = await navigator.serviceWorker.register(swPath, {
        scope: basePath
      });

      Utils.log('Service Worker registered:', registration.scope);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            this.showUpdateNotification();
          }
        });
      });

    } catch (error) {
      Utils.error('Service Worker registration failed:', error);
    }
  },

  /**
   * Show update notification
   */
  showUpdateNotification() {
    const toast = Toast.show('Налична е нова версия!', {
      type: 'info',
      duration: 0 // Don't auto-dismiss
    });

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'btn btn--small btn--primary ml-2';
    refreshBtn.textContent = 'Обнови';
    refreshBtn.onclick = () => {
      window.location.reload();
    };

    toast.querySelector('.toast__message')?.appendChild(refreshBtn);
  },

  /**
   * Setup router
   */
  setupRouter() {
    // Public routes
    Router.register('/', () => this.showPage('home'));
    Router.register('/booking', () => this.showPage('booking'));

    // Admin routes
    Router.register('/admin', () => {
      if (Auth.isAuthenticated()) {
        Router.navigate('/admin/calendar');
      } else {
        Router.navigate('/admin/login');
      }
    });

    Router.register('/admin/login', () => this.showPage('admin-login'));

    // Protected admin routes
    Router.register('/admin/calendar', () => {
      this.requireAuth(() => this.showPage('admin-calendar'));
    });

    Router.register('/admin/finance', () => {
      this.requireAuth(() => this.showPage('admin-finance'));
    });

    Router.register('/admin/settings', () => {
      this.requireAuth(() => this.showPage('admin-settings'));
    });

    // 404
    Router.register('*', () => this.showPage('home'));

    // Initialize router
    Router.init();
  },

  /**
   * Require authentication
   * @param {Function} callback - Callback if authenticated
   */
  requireAuth(callback) {
    if (Auth.isAuthenticated()) {
      callback();
    } else {
      // Store intended destination
      Utils.storage.set('auth_redirect', window.location.hash);
      Router.navigate('/admin/login');
    }
  },

  /**
   * Check authentication state
   */
  async checkAuth() {
    if (Auth.isAuthenticated()) {
      // Verify token is still valid
      const valid = await Auth.verifyToken();
      if (!valid) {
        Auth.logout();
      }
    }
  },

  /**
   * Show a page
   * @param {string} pageId - Page ID
   */
  async showPage(pageId) {
    Utils.log('App: Showing page:', pageId);

    // Cleanup current page
    if (this.currentPage) {
      this.cleanupPage(this.currentPage);
    }

    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
      page.hidden = true;
      page.classList.remove('active');
    });

    // Show target page
    const page = document.getElementById(`page-${pageId}`);
    if (page) {
      page.hidden = false;
      page.classList.add('active');
    }

    // Update navigation
    this.updateNavigation(pageId);

    // Initialize page
    await this.initPage(pageId);

    this.currentPage = pageId;

    // Scroll to top
    window.scrollTo(0, 0);
  },

  /**
   * Initialize page components
   * @param {string} pageId - Page ID
   */
  async initPage(pageId) {
    switch (pageId) {
      case 'home':
        // Home page doesn't need special init
        break;

      case 'booking':
        if (typeof Booking !== 'undefined') {
          await Booking.init();
        }
        break;

      case 'admin-login':
        this.initLoginPage();
        break;

      case 'admin-calendar':
        if (typeof AdminCalendar !== 'undefined') {
          await AdminCalendar.init();
        }
        break;

      case 'admin-finance':
        if (typeof AdminFinance !== 'undefined') {
          await AdminFinance.init();
        }
        break;

      case 'admin-settings':
        if (typeof AdminSettings !== 'undefined') {
          await AdminSettings.init();
        }
        break;
    }
  },

  /**
   * Cleanup page before leaving
   * @param {string} pageId - Page ID
   */
  cleanupPage(pageId) {
    switch (pageId) {
      case 'booking':
        if (typeof Booking !== 'undefined') {
          Booking.destroy?.();
        }
        break;

      case 'admin-calendar':
        if (typeof AdminCalendar !== 'undefined') {
          AdminCalendar.destroy?.();
        }
        break;

      case 'admin-finance':
        if (typeof AdminFinance !== 'undefined') {
          AdminFinance.destroy?.();
        }
        break;

      case 'admin-settings':
        if (typeof AdminSettings !== 'undefined') {
          if (!AdminSettings.canLeave?.()) {
            return false;
          }
          AdminSettings.destroy?.();
        }
        break;
    }
    return true;
  },

  /**
   * Initialize login page
   */
  initLoginPage() {
    const googleBtn = document.getElementById('google-login-btn');

    // Google login button
    if (googleBtn) {
      googleBtn.addEventListener('click', () => {
        // Auth.login() handles both Google OAuth and dev mode
        Auth.login();
      });
    }
  },

  /**
   * Update navigation state
   * @param {string} pageId - Current page ID
   */
  updateNavigation(pageId) {
    // Main nav
    document.querySelectorAll('.nav__link').forEach(link => {
      const href = link.getAttribute('href');
      const isActive = href === `#/${pageId}` || 
                       (pageId === 'home' && href === '#/') ||
                       (pageId.startsWith('admin') && href === '#/admin');
      link.classList.toggle('active', isActive);
    });

    // Admin sidebar
    document.querySelectorAll('.sidebar__link').forEach(link => {
      const href = link.getAttribute('href');
      const isActive = href === `#/${pageId.replace('-', '/')}`;
      link.classList.toggle('active', isActive);
    });

    // Show/hide admin sidebar
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.hidden = !pageId.startsWith('admin-') || pageId === 'admin-login';
    }

    // Update header for admin pages
    const header = document.querySelector('.header');
    if (header) {
      header.classList.toggle('header--admin', pageId.startsWith('admin-') && pageId !== 'admin-login');
    }
  },

  /**
   * Setup global event listeners
   */
  setupEventListeners() {
    // Handle network status changes
    window.addEventListener('online', () => {
      Toast.success('Връзката е възстановена');
      OfflineQueue.process();
    });

    window.addEventListener('offline', () => {
      Toast.warning('Няма интернет връзка. Работите офлайн.');
    });

    // Handle visibility change (refresh data when tab becomes visible)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.onAppVisible();
      }
    });

    // Handle before unload (warn about unsaved changes)
    window.addEventListener('beforeunload', (e) => {
      if (this.hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // Mobile menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    
    menuToggle?.addEventListener('click', () => {
      mobileMenu?.classList.toggle('open');
    });

    // Close mobile menu on link click
    mobileMenu?.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
      });
    });

    // Handle PWA install
    Auth.setupPWAInstall();
  },

  /**
   * Handle app becoming visible
   */
  onAppVisible() {
    // Refresh current page data if needed
    if (this.currentPage === 'admin-calendar') {
      AdminCalendar?.loadAppointments?.(AdminCalendar.selectedDate);
    }
  },

  /**
   * Check for unsaved changes
   * @returns {boolean}
   */
  hasUnsavedChanges() {
    if (this.currentPage === 'admin-settings') {
      return AdminSettings?.isDirty || false;
    }
    return false;
  }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = App;
}

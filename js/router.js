/**
 * Router Module
 * Hash-based routing for SPA navigation
 */

const Router = {
  routes: {},
  currentRoute: null,
  
  /**
   * Register a route
   * @param {string} path - Route path (e.g., '/admin')
   * @param {Object} config - Route configuration
   */
  register(path, config) {
    this.routes[path] = {
      template: config.template,
      title: config.title || CONFIG.APP_NAME,
      requiresAuth: config.requiresAuth || false,
      onEnter: config.onEnter || null,
      onLeave: config.onLeave || null
    };
  },

  /**
   * Initialize the router
   */
  init() {
    // Register all routes
    this.registerRoutes();
    
    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRoute());
    
    // Handle initial route
    this.handleRoute();
  },

  /**
   * Register all application routes
   */
  registerRoutes() {
    // Public routes
    this.register('/', {
      template: 'template-home',
      title: 'Родопи Дент - Начало'
    });
    
    this.register('/booking', {
      template: 'template-booking',
      title: 'Запази час - Родопи Дент',
      onEnter: () => {
        if (typeof BookingPage !== 'undefined') {
          BookingPage.init();
        }
      }
    });
    
    // Admin routes
    this.register('/admin/login', {
      template: 'template-admin-login',
      title: 'Вход - Родопи Дент'
    });
    
    this.register('/admin', {
      template: 'template-admin-dashboard',
      title: 'Табло - Родопи Дент',
      requiresAuth: true,
      onEnter: () => {
        if (typeof AdminDashboard !== 'undefined') {
          AdminDashboard.init();
        }
      }
    });
    
    this.register('/admin/calendar', {
      template: 'template-admin-calendar',
      title: 'Календар - Родопи Дент',
      requiresAuth: true,
      onEnter: () => {
        if (typeof AdminCalendar !== 'undefined') {
          AdminCalendar.init();
        }
      }
    });
    
    this.register('/admin/finance', {
      template: 'template-admin-finance',
      title: 'Финанси - Родопи Дент',
      requiresAuth: true,
      onEnter: () => {
        if (typeof AdminFinance !== 'undefined') {
          AdminFinance.init();
        }
      }
    });
    
    this.register('/admin/settings', {
      template: 'template-admin-settings',
      title: 'Настройки - Родопи Дент',
      requiresAuth: true,
      onEnter: () => {
        if (typeof AdminSettings !== 'undefined') {
          AdminSettings.init();
        }
      }
    });
  },

  /**
   * Handle route change
   */
  handleRoute() {
    // Get the hash path
    let path = window.location.hash.slice(1) || '/';
    
    // Remove query string if present
    const queryIndex = path.indexOf('?');
    if (queryIndex !== -1) {
      path = path.substring(0, queryIndex);
    }
    
    // Check for OAuth callback
    if (path.includes('access_token')) {
      Auth.handleCallback();
      return;
    }
    
    Utils.log('Routing to:', path);
    
    // Find matching route
    let route = this.routes[path];
    
    // If no exact match, try to find parent route
    if (!route) {
      // Try /admin for /admin/* paths
      if (path.startsWith('/admin')) {
        route = this.routes['/admin'];
      }
    }
    
    // Default to home if route not found
    if (!route) {
      Utils.log('Route not found, redirecting to home');
      window.location.hash = '#/';
      return;
    }
    
    // Check authentication
    if (route.requiresAuth && !Auth.isAuthenticated()) {
      Utils.log('Auth required, redirecting to login');
      window.location.hash = '#/admin/login';
      return;
    }
    
    // Call onLeave for current route
    if (this.currentRoute && this.currentRoute.onLeave) {
      this.currentRoute.onLeave();
    }
    
    // Update current route
    this.currentRoute = route;
    
    // Update document title
    document.title = route.title;
    
    // Render the template
    this.render(route.template);
    
    // Update navigation
    this.updateNavigation(path);
    
    // Call onEnter
    if (route.onEnter) {
      // Small delay to ensure DOM is ready
      setTimeout(() => route.onEnter(), 50);
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
  },

  /**
   * Render a template into the main content area
   * @param {string} templateId - Template element ID
   */
  render(templateId) {
    const template = document.getElementById(templateId);
    const content = document.getElementById('app-content');
    
    if (!template || !content) {
      Utils.error('Template or content container not found:', templateId);
      return;
    }
    
    // Clone template content
    const clone = template.content.cloneNode(true);
    
    // Clear and insert
    content.innerHTML = '';
    content.appendChild(clone);
  },

  /**
   * Update navigation links
   * @param {string} currentPath - Current route path
   */
  updateNavigation(currentPath) {
    const headerNav = document.getElementById('header-nav');
    const mobileNavLinks = document.getElementById('mobile-nav-links');
    
    if (!headerNav || !mobileNavLinks) return;
    
    const isAdmin = Auth.isAuthenticated();
    const isAdminPage = currentPath.startsWith('/admin');
    
    let navHtml = '';
    
    if (isAdmin && isAdminPage) {
      // Admin navigation
      navHtml = `
        <a href="#/admin" class="${currentPath === '/admin' ? 'active' : ''}">Табло</a>
        <a href="#/admin/calendar" class="${currentPath === '/admin/calendar' ? 'active' : ''}">Календар</a>
        <a href="#/admin/finance" class="${currentPath === '/admin/finance' ? 'active' : ''}">Финанси</a>
        <a href="#/admin/settings" class="${currentPath === '/admin/settings' ? 'active' : ''}">Настройки</a>
        <a href="#" onclick="Auth.logout(); return false;">Изход</a>
      `;
    } else {
      // Public navigation
      navHtml = `
        <a href="#/" class="${currentPath === '/' ? 'active' : ''}">Начало</a>
        <a href="#/booking" class="${currentPath === '/booking' ? 'active' : ''}">Запази час</a>
        ${isAdmin ? '<a href="#/admin">Администрация</a>' : '<a href="#/admin/login">Вход</a>'}
      `;
    }
    
    headerNav.innerHTML = navHtml;
    mobileNavLinks.innerHTML = navHtml;
  },

  /**
   * Navigate to a route programmatically
   * @param {string} path - Route path
   */
  navigate(path) {
    window.location.hash = '#' + path;
  },

  /**
   * Go back in history
   */
  back() {
    window.history.back();
  },

  /**
   * Get current route path
   * @returns {string} Current path
   */
  getCurrentPath() {
    return window.location.hash.slice(1) || '/';
  },

  /**
   * Get query parameters from current URL
   * @returns {Object} Query parameters
   */
  getQueryParams() {
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    
    if (queryIndex === -1) {
      return {};
    }
    
    return Utils.parseQueryString(hash.substring(queryIndex + 1));
  }
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Router;
}

// Router for Rodopi Dent PWA (Hash-based routing)

const Router = {
  routes: {},
  currentRoute: null,

  /**
   * Initialize router
   */
  init() {
    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRoute());
    
    // Handle initial route
    this.handleRoute();
  },

  /**
   * Register a route
   */
  register(path, handler) {
    this.routes[path] = handler;
  },

  /**
   * Navigate to a route
   */
  navigate(path) {
    window.location.hash = path;
  },

  /**
   * Handle current route
   */
  async handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, queryString] = hash.split('?');
    const query = queryString ? Utils.parseQuery(queryString) : {};
    
    // Find matching route
    let handler = this.routes[path];
    let params = {};
    
    // Check for dynamic routes (e.g., /admin/appointment/:id)
    if (!handler) {
      for (const [routePath, routeHandler] of Object.entries(this.routes)) {
        const match = this.matchRoute(routePath, path);
        if (match) {
          handler = routeHandler;
          params = match;
          break;
        }
      }
    }
    
    // Default to home if no route found
    if (!handler) {
      handler = this.routes['/'] || this.notFound;
    }
    
    // Update current route
    this.currentRoute = { path, query, params };
    
    // Update active nav links
    this.updateNavLinks(path);
    
    // Execute handler
    try {
      await handler({ path, query, params });
    } catch (error) {
      console.error('Route error:', error);
      this.showError('Грешка при зареждане на страницата');
    }
  },

  /**
   * Match dynamic route pattern
   */
  matchRoute(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    
    if (patternParts.length !== pathParts.length) {
      return null;
    }
    
    const params = {};
    
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        // Dynamic parameter
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }
    
    return params;
  },

  /**
   * Update active state on nav links
   */
  updateNavLinks(currentPath) {
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        const linkPath = href.replace('#', '');
        const isActive = currentPath === linkPath || 
          (linkPath !== '/' && currentPath.startsWith(linkPath));
        link.classList.toggle('active', isActive);
      }
    });
  },

  /**
   * Render a template into main content
   */
  render(templateId, data = {}) {
    const template = document.getElementById(templateId);
    const main = document.getElementById('main-content');
    
    if (!template || !main) {
      console.error('Template or main container not found:', templateId);
      return;
    }
    
    // Clone template content
    const content = template.content.cloneNode(true);
    
    // Clear and append
    main.innerHTML = '';
    main.appendChild(content);
    
    return main;
  },

  /**
   * Show 404 page
   */
  notFound() {
    const main = document.getElementById('main-content');
    if (main) {
      main.innerHTML = `
        <div class="page text-center">
          <h1>404</h1>
          <p>Страницата не е намерена</p>
          <a href="#/" class="btn btn--primary">Към началото</a>
        </div>
      `;
    }
  },

  /**
   * Show error page
   */
  showError(message) {
    const main = document.getElementById('main-content');
    if (main) {
      main.innerHTML = `
        <div class="page text-center">
          <h1>⚠️ Грешка</h1>
          <p>${message}</p>
          <a href="#/" class="btn btn--primary">Към началото</a>
        </div>
      `;
    }
  },

  /**
   * Show loading state
   */
  showLoading() {
    const main = document.getElementById('main-content');
    if (main) {
      main.innerHTML = `
        <div class="loading">
          <div class="loading__spinner"></div>
          <p class="loading__text">Зареждане...</p>
        </div>
      `;
    }
  },

  /**
   * Check if user is authenticated for admin routes
   */
  requireAuth(handler) {
    return async (context) => {
      if (!Auth.isAuthenticated()) {
        this.navigate('/admin');
        return;
      }
      await handler(context);
    };
  }
};

// Export for use
window.Router = Router;

// Authentication module for Rodopi Dent PWA

const Auth = {
  // Storage keys
  TOKEN_KEY: 'rodopi_auth_token',
  USER_KEY: 'rodopi_auth_user',

  /**
   * Initialize Google OAuth
   */
  init() {
    // Load Google Identity Services
    if (CONFIG.GOOGLE_CLIENT_ID) {
      this.loadGoogleScript();
    }
  },

  /**
   * Load Google Identity Services script
   */
  loadGoogleScript() {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => this.initGoogleAuth();
    document.head.appendChild(script);
  },

  /**
   * Initialize Google Auth after script loads
   */
  initGoogleAuth() {
    if (!window.google || !CONFIG.GOOGLE_CLIENT_ID) return;

    window.google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: (response) => this.handleGoogleCallback(response),
      auto_select: false
    });
  },

  /**
   * Trigger Google Sign In
   */
  signInWithGoogle() {
    if (!window.google || !CONFIG.GOOGLE_CLIENT_ID) {
      Utils.showToast('Google вход не е конфигуриран', 'error');
      
      // For development: simulate login
      if (CONFIG.DEMO_MODE) {
        this.setUser({
          name: 'Demo User',
          email: 'demo@rodopident.bg',
          picture: ''
        });
        this.setToken('demo-token');
        Router.navigate('/admin/dashboard');
      }
      return;
    }

    window.google.accounts.id.prompt();
  },

  /**
   * Handle Google OAuth callback
   */
  handleGoogleCallback(response) {
    if (response.credential) {
      // Decode JWT token
      const payload = this.decodeJWT(response.credential);
      
      if (payload) {
        this.setUser({
          name: payload.name,
          email: payload.email,
          picture: payload.picture
        });
        this.setToken(response.credential);
        
        Utils.showToast(`Добре дошли, ${payload.name}!`, 'success');
        Router.navigate('/admin/dashboard');
      }
    }
  },

  /**
   * Decode JWT token
   */
  decodeJWT(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  },

  /**
   * Sign out
   */
  signOut() {
    this.clearAuth();
    Utils.showToast('Излязохте от профила си', 'info');
    Router.navigate('/');
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.getToken() && !!this.getUser();
  },

  /**
   * Get current user
   */
  getUser() {
    return Utils.storage.get(this.USER_KEY);
  },

  /**
   * Set current user
   */
  setUser(user) {
    Utils.storage.set(this.USER_KEY, user);
  },

  /**
   * Get auth token
   */
  getToken() {
    return Utils.storage.get(this.TOKEN_KEY);
  },

  /**
   * Set auth token
   */
  setToken(token) {
    Utils.storage.set(this.TOKEN_KEY, token);
  },

  /**
   * Clear all auth data
   */
  clearAuth() {
    Utils.storage.remove(this.TOKEN_KEY);
    Utils.storage.remove(this.USER_KEY);
  }
};

// Export for use
window.Auth = Auth;

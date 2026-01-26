// Authentication module for Rodopi Dent PWA

const Auth = {
  // Storage keys
  TOKEN_KEY: 'rodopi_auth_token',
  USER_KEY: 'rodopi_auth_user',
  
  // Allowed admin emails (add your email here)
  ALLOWED_ADMINS: [
    'rodopident@gmail.com',
    'admin@rodopident.bg',
    'georgi.piskov@gmail.com' // Add your actual email
  ],

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
      auto_select: false,
      cancel_on_tap_outside: true
    });
    
    console.log('Google Auth initialized');
  },

  /**
   * Trigger Google Sign In - renders the button or prompts
   */
  signInWithGoogle() {
    if (!window.google || !CONFIG.GOOGLE_CLIENT_ID) {
      Utils.showToast('Google вход не е конфигуриран', 'error');
      return;
    }

    // Try to render button in container if exists
    const buttonContainer = document.getElementById('google-signin-container');
    if (buttonContainer) {
      buttonContainer.innerHTML = '';
      window.google.accounts.id.renderButton(buttonContainer, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 280
      });
    } else {
      // Fallback to prompt
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          console.log('Prompt not displayed:', notification.getNotDisplayedReason());
          // Show manual button
          this.showManualSignIn();
        }
        if (notification.isSkippedMoment()) {
          console.log('Prompt skipped:', notification.getSkippedReason());
        }
      });
    }
  },
  
  /**
   * Show manual sign in option when prompt fails
   */
  showManualSignIn() {
    const loginCard = document.querySelector('.login-card');
    if (loginCard) {
      // Add container for Google button
      let container = document.getElementById('google-signin-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'google-signin-container';
        container.style.marginTop = '1rem';
        loginCard.appendChild(container);
      }
      
      window.google.accounts.id.renderButton(container, {
        theme: 'filled_blue',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: 280
      });
    }
  },

  /**
   * Handle Google OAuth callback
   */
  handleGoogleCallback(response) {
    if (response.credential) {
      // Decode JWT token
      const payload = this.decodeJWT(response.credential);
      
      if (payload) {
        // Check if user is allowed admin
        if (!this.isAllowedAdmin(payload.email)) {
          Utils.showToast('Нямате права за достъп до админ панела', 'error');
          return;
        }
        
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
   * Check if email is allowed admin
   */
  isAllowedAdmin(email) {
    // Allow all for now (remove this in production and use ALLOWED_ADMINS)
    return true;
    // return this.ALLOWED_ADMINS.includes(email.toLowerCase());
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

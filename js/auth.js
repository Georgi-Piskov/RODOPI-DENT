/**
 * Authentication Module
 * Handles Google OAuth2 authentication for admin users
 */

const Auth = {
  // Storage keys
  TOKEN_KEY: 'rodopi_auth_token',
  USER_KEY: 'rodopi_auth_user',
  
  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;
    
    // Check if token is expired
    const user = this.getUser();
    if (user && user.expiresAt && Date.now() > user.expiresAt) {
      this.logout();
      return false;
    }
    
    return true;
  },

  /**
   * Get stored token
   * @returns {string|null}
   */
  getToken() {
    return Utils.storage.get(this.TOKEN_KEY);
  },

  /**
   * Get stored user info
   * @returns {Object|null}
   */
  getUser() {
    return Utils.storage.get(this.USER_KEY);
  },

  /**
   * Save authentication data
   * @param {string} token - Auth token
   * @param {Object} user - User info
   */
  saveAuth(token, user) {
    Utils.storage.set(this.TOKEN_KEY, token);
    Utils.storage.set(this.USER_KEY, {
      ...user,
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    });
  },

  /**
   * Clear authentication data
   */
  logout() {
    Utils.storage.remove(this.TOKEN_KEY);
    Utils.storage.remove(this.USER_KEY);
    
    // Clear any cached data
    Utils.storage.remove('settings_cache');
    Utils.storage.remove('procedures_cache');
    
    // Redirect to home
    window.location.hash = '#/';
  },

  /**
   * Initiate Google OAuth2 login
   */
  async login() {
    if (!CONFIG.OAUTH.CLIENT_ID) {
      // If no OAuth configured, use simple password auth for development
      Utils.log('OAuth not configured, using dev mode');
      this.showDevLoginModal();
      return;
    }
    
    // Build OAuth URL
    const params = {
      client_id: CONFIG.OAUTH.CLIENT_ID,
      redirect_uri: CONFIG.OAUTH.REDIRECT_URI,
      response_type: 'token',
      scope: CONFIG.OAUTH.SCOPES.join(' '),
      state: Utils.generateId(),
      prompt: 'select_account'
    };
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${Utils.buildQueryString(params)}`;
    
    // Store state for verification
    Utils.storage.set('oauth_state', params.state);
    
    // Redirect to Google
    window.location.href = authUrl;
  },

  /**
   * Handle OAuth callback
   * Called when redirected back from Google
   */
  async handleCallback() {
    const hash = window.location.hash;
    
    // Check if this is an OAuth callback
    if (!hash.includes('access_token')) {
      return false;
    }
    
    // Parse the hash fragment
    const params = {};
    hash.substring(1).split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      params[key] = decodeURIComponent(value);
    });
    
    // Verify state
    const storedState = Utils.storage.get('oauth_state');
    if (params.state !== storedState) {
      Utils.error('OAuth state mismatch');
      Toast.error('Грешка при автентикация');
      return false;
    }
    
    Utils.storage.remove('oauth_state');
    
    try {
      // Get user info from Google
      const userInfo = await this.fetchGoogleUserInfo(params.access_token);
      
      // Validate with backend (n8n)
      const authResult = await this.validateWithBackend(params.access_token, userInfo);
      
      if (authResult.success) {
        // Save auth data
        this.saveAuth(authResult.token, {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          role: authResult.role || 'admin'
        });
        
        // Clear the hash and redirect to admin
        window.location.hash = '#/admin';
        
        Toast.success(`Добре дошли, ${userInfo.name}!`);
        
        // Show PWA install prompt if available
        setTimeout(() => {
          PWAInstall.showPrompt();
        }, 2000);
        
        return true;
      } else {
        Toast.error(authResult.message || 'Нямате достъп до администрацията');
        window.location.hash = '#/';
        return false;
      }
    } catch (error) {
      Utils.error('OAuth callback error:', error);
      Toast.error('Грешка при автентикация');
      window.location.hash = '#/';
      return false;
    }
  },

  /**
   * Fetch user info from Google
   * @param {string} accessToken - Google access token
   * @returns {Promise<Object>} User info
   */
  async fetchGoogleUserInfo(accessToken) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch Google user info');
    }
    
    return response.json();
  },

  /**
   * Validate OAuth token with backend
   * @param {string} accessToken - Google access token
   * @param {Object} userInfo - Google user info
   * @returns {Promise<Object>} Validation result
   */
  async validateWithBackend(accessToken, userInfo) {
    try {
      const result = await API.post(CONFIG.API.ENDPOINTS.ADMIN_AUTH, {
        googleToken: accessToken,
        email: userInfo.email
      });
      
      return result;
    } catch (error) {
      // For development, allow any Google account
      if (CONFIG.DEBUG) {
        Utils.log('Dev mode: allowing auth without backend validation');
        return {
          success: true,
          token: accessToken,
          role: 'admin'
        };
      }
      
      throw error;
    }
  },

  /**
   * Show development login modal (when OAuth is not configured)
   */
  showDevLoginModal() {
    const modal = Modal.show({
      title: 'Вход в администрация',
      body: `
        <div class="form-group">
          <label class="form-label">Парола</label>
          <input type="password" id="dev-password" class="form-input" placeholder="Въведете парола">
        </div>
        <p class="form-hint" style="margin-top: var(--space-2); color: var(--color-warning);">
          ⚠️ Режим за разработка - OAuth не е конфигуриран
        </p>
      `,
      footer: `
        <button class="btn btn--outline" onclick="Modal.close()">Отказ</button>
        <button class="btn btn--primary" id="dev-login-btn">Вход</button>
      `,
      onShow: () => {
        const passwordInput = document.getElementById('dev-password');
        const loginBtn = document.getElementById('dev-login-btn');
        
        loginBtn.addEventListener('click', () => {
          const password = passwordInput.value;
          
          // Simple password check for development
          if (password === 'admin' || password === 'rodopi') {
            Auth.saveAuth('dev-token', {
              email: 'admin@rodopident.bg',
              name: 'Администратор',
              role: 'admin'
            });
            
            Modal.close();
            window.location.hash = '#/admin';
            Toast.success('Добре дошли, Администратор!');
            
            setTimeout(() => {
              PWAInstall.showPrompt();
            }, 2000);
          } else {
            Toast.error('Грешна парола');
          }
        });
        
        // Enter key to submit
        passwordInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            loginBtn.click();
          }
        });
        
        // Focus password input
        passwordInput.focus();
      }
    });
  },

  /**
   * Check and handle OAuth callback on page load
   */
  init() {
    // Check for OAuth callback
    if (window.location.hash.includes('access_token')) {
      this.handleCallback();
    }
  }
};

/**
 * PWA Install Prompt Handler
 */
const PWAInstall = {
  deferredPrompt: null,
  
  /**
   * Initialize PWA install handling
   */
  init() {
    // Capture the install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      Utils.log('PWA install prompt captured');
    });
    
    // Track successful installs
    window.addEventListener('appinstalled', () => {
      Utils.log('PWA installed successfully');
      this.deferredPrompt = null;
      this.hidePromptUI();
    });
    
    // Setup UI handlers
    const installBtn = document.getElementById('pwa-install-btn');
    const dismissBtn = document.getElementById('pwa-install-dismiss');
    
    if (installBtn) {
      installBtn.addEventListener('click', () => this.install());
    }
    
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => this.hidePromptUI());
    }
  },

  /**
   * Show install prompt (only for admins)
   */
  showPrompt() {
    // Only show for authenticated admins
    if (!Auth.isAuthenticated()) {
      return;
    }
    
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      Utils.log('App is already installed');
      return;
    }
    
    // Check if prompt was dismissed recently
    const dismissed = Utils.storage.get('pwa_install_dismissed');
    if (dismissed && Date.now() - dismissed < 7 * 24 * 60 * 60 * 1000) {
      return;
    }
    
    // Check if we have a deferred prompt
    if (!this.deferredPrompt) {
      Utils.log('No deferred prompt available');
      return;
    }
    
    // Show the prompt UI
    const promptUI = document.getElementById('pwa-install-prompt');
    if (promptUI) {
      promptUI.hidden = false;
    }
  },

  /**
   * Hide install prompt UI
   */
  hidePromptUI() {
    const promptUI = document.getElementById('pwa-install-prompt');
    if (promptUI) {
      promptUI.hidden = true;
    }
    
    // Remember dismissal
    Utils.storage.set('pwa_install_dismissed', Date.now());
  },

  /**
   * Trigger the install prompt
   */
  async install() {
    if (!this.deferredPrompt) {
      Utils.log('No install prompt available');
      return;
    }
    
    // Show the browser's install prompt
    this.deferredPrompt.prompt();
    
    // Wait for the user's response
    const { outcome } = await this.deferredPrompt.userChoice;
    Utils.log('PWA install outcome:', outcome);
    
    // Clear the deferred prompt
    this.deferredPrompt = null;
    this.hidePromptUI();
    
    if (outcome === 'accepted') {
      Toast.success('Приложението ще бъде инсталирано!');
    }
  }
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Auth, PWAInstall };
}

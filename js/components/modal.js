/**
 * Modal Component
 * Reusable modal dialog system
 */

const Modal = {
  container: null,
  currentModal: null,
  onCloseCallback: null,

  /**
   * Initialize modal system
   */
  init() {
    this.container = document.getElementById('modal-container');
    
    if (!this.container) {
      Utils.error('Modal container not found');
      return;
    }
    
    // Close on backdrop click
    const backdrop = this.container.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => this.close());
    }
    
    // Close on close button click
    const closeBtn = this.container.querySelector('.modal__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.container.hidden) {
        this.close();
      }
    });
  },

  /**
   * Show a modal
   * @param {Object} options - Modal options
   * @returns {HTMLElement} Modal element
   */
  show(options = {}) {
    if (!this.container) {
      this.init();
    }
    
    const {
      title = '',
      body = '',
      footer = '',
      size = 'default',
      onShow = null,
      onClose = null,
      closable = true
    } = options;
    
    // Get modal elements
    const modal = this.container.querySelector('.modal');
    const titleEl = this.container.querySelector('.modal__title');
    const bodyEl = this.container.querySelector('.modal__body');
    const footerEl = this.container.querySelector('.modal__footer');
    const closeBtn = this.container.querySelector('.modal__close');
    
    // Set content
    titleEl.textContent = title;
    bodyEl.innerHTML = body;
    
    if (footer) {
      footerEl.innerHTML = footer;
      footerEl.hidden = false;
    } else {
      footerEl.hidden = true;
    }
    
    // Set size class
    modal.className = 'modal';
    if (size === 'large') {
      modal.classList.add('modal--large');
    } else if (size === 'small') {
      modal.classList.add('modal--small');
    }
    
    // Handle closable option
    if (closable) {
      closeBtn.hidden = false;
    } else {
      closeBtn.hidden = true;
    }
    
    // Store callback
    this.onCloseCallback = onClose;
    
    // Show modal
    this.container.hidden = false;
    document.body.style.overflow = 'hidden';
    
    // Store reference
    this.currentModal = modal;
    
    // Call onShow callback
    if (onShow) {
      setTimeout(() => onShow(modal), 50);
    }
    
    return modal;
  },

  /**
   * Close the current modal
   * @param {any} result - Result to pass to callback
   */
  close(result = null) {
    if (!this.container) return;
    
    this.container.hidden = true;
    document.body.style.overflow = '';
    
    // Call close callback
    if (this.onCloseCallback) {
      this.onCloseCallback(result);
      this.onCloseCallback = null;
    }
    
    this.currentModal = null;
  },

  /**
   * Show confirmation dialog
   * @param {Object} options - Confirmation options
   * @returns {Promise<boolean>} User's choice
   */
  confirm(options = {}) {
    return new Promise((resolve) => {
      const {
        title = 'Потвърждение',
        message = 'Сигурни ли сте?',
        confirmText = 'Да',
        cancelText = 'Отказ',
        confirmClass = 'btn--primary',
        danger = false
      } = options;
      
      this.show({
        title,
        body: `<p>${message}</p>`,
        footer: `
          <button class="btn btn--outline" data-action="cancel">${cancelText}</button>
          <button class="btn ${danger ? 'btn--danger' : confirmClass}" data-action="confirm">${confirmText}</button>
        `,
        onShow: (modal) => {
          const confirmBtn = modal.querySelector('[data-action="confirm"]');
          const cancelBtn = modal.querySelector('[data-action="cancel"]');
          
          confirmBtn.addEventListener('click', () => {
            this.close();
            resolve(true);
          });
          
          cancelBtn.addEventListener('click', () => {
            this.close();
            resolve(false);
          });
        },
        onClose: () => {
          resolve(false);
        }
      });
    });
  },

  /**
   * Show alert dialog
   * @param {Object} options - Alert options
   */
  alert(options = {}) {
    return new Promise((resolve) => {
      const {
        title = 'Съобщение',
        message = '',
        buttonText = 'ОК'
      } = options;
      
      this.show({
        title,
        body: `<p>${message}</p>`,
        footer: `
          <button class="btn btn--primary" data-action="ok">${buttonText}</button>
        `,
        onShow: (modal) => {
          const okBtn = modal.querySelector('[data-action="ok"]');
          okBtn.addEventListener('click', () => {
            this.close();
            resolve();
          });
          okBtn.focus();
        },
        onClose: () => {
          resolve();
        }
      });
    });
  },

  /**
   * Show loading modal
   * @param {string} message - Loading message
   */
  loading(message = 'Зареждане...') {
    this.show({
      title: '',
      body: `
        <div class="loading">
          <div class="loading__spinner"></div>
          <p class="loading__text">${message}</p>
        </div>
      `,
      closable: false
    });
  },

  /**
   * Show modal from template
   * @param {string} templateId - Template element ID
   * @param {Object} options - Modal options
   * @returns {HTMLElement} Modal element
   */
  showTemplate(templateId, options = {}) {
    const template = document.getElementById(templateId);
    
    if (!template) {
      Utils.error('Template not found:', templateId);
      return null;
    }
    
    const clone = template.content.cloneNode(true);
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(clone);
    
    return this.show({
      ...options,
      body: tempDiv.innerHTML
    });
  },

  /**
   * Update modal footer
   * @param {string} footer - New footer HTML
   */
  updateFooter(footer) {
    const footerEl = this.container.querySelector('.modal__footer');
    if (footerEl) {
      footerEl.innerHTML = footer;
      footerEl.hidden = !footer;
    }
  },

  /**
   * Get modal body element
   * @returns {HTMLElement}
   */
  getBody() {
    return this.container?.querySelector('.modal__body');
  }
};

/**
 * Toast Notification System
 */
const Toast = {
  container: null,
  queue: [],
  
  /**
   * Initialize toast system
   */
  init() {
    this.container = document.getElementById('toast-container');
    
    if (!this.container) {
      Utils.error('Toast container not found');
    }
  },

  /**
   * Show a toast notification
   * @param {string} message - Toast message
   * @param {Object} options - Toast options
   */
  show(message, options = {}) {
    if (!this.container) {
      this.init();
    }
    
    const {
      type = 'default',
      duration = CONFIG.UI.TOAST_DURATION,
      icon = null
    } = options;
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    
    // Default icons by type
    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ',
      default: ''
    };
    
    const displayIcon = icon || icons[type] || '';
    
    toast.innerHTML = `
      ${displayIcon ? `<span class="toast__icon">${displayIcon}</span>` : ''}
      <span class="toast__message">${Utils.escapeHtml(message)}</span>
      <button class="toast__close" aria-label="Затвори">×</button>
    `;
    
    // Add close handler
    const closeBtn = toast.querySelector('.toast__close');
    closeBtn.addEventListener('click', () => this.dismiss(toast));
    
    // Add to container
    this.container.appendChild(toast);
    
    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => this.dismiss(toast), duration);
    }
    
    return toast;
  },

  /**
   * Dismiss a toast
   * @param {HTMLElement} toast - Toast element
   */
  dismiss(toast) {
    if (!toast || !toast.parentNode) return;
    
    toast.style.animation = 'slideOut 0.2s ease forwards';
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 200);
  },

  /**
   * Show success toast
   * @param {string} message - Message
   */
  success(message) {
    return this.show(message, { type: 'success' });
  },

  /**
   * Show error toast
   * @param {string} message - Message
   */
  error(message) {
    return this.show(message, { type: 'error', duration: 6000 });
  },

  /**
   * Show warning toast
   * @param {string} message - Message
   */
  warning(message) {
    return this.show(message, { type: 'warning' });
  },

  /**
   * Show info toast
   * @param {string} message - Message
   */
  info(message) {
    return this.show(message, { type: 'info' });
  },

  /**
   * Clear all toasts
   */
  clear() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
};

// Add slideOut animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideOut {
    to { opacity: 0; transform: translateX(100%); }
  }
`;
document.head.appendChild(style);

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  Modal.init();
  Toast.init();
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Modal, Toast };
}

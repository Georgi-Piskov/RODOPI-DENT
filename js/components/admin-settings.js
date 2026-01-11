/**
 * Admin Settings Component
 * Settings management for admin panel
 */

const AdminSettings = {
  settings: {},
  procedures: [],
  isDirty: false,

  /**
   * Initialize settings page
   */
  async init() {
    Utils.log('AdminSettings: Initializing');

    // Setup tab navigation
    this.setupTabs();

    // Load settings
    await this.loadSettings();

    // Load procedures
    await this.loadProcedures();

    // Setup form handlers
    this.setupFormHandlers();

    // Setup action buttons
    this.setupActions();
  },

  /**
   * Setup tab navigation
   */
  setupTabs() {
    const tabs = document.querySelectorAll('.settings-tab');
    const panels = document.querySelectorAll('.settings-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;

        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Show target panel
        panels.forEach(p => {
          p.classList.remove('active');
          if (p.id === `settings-${target}`) {
            p.classList.add('active');
          }
        });
      });
    });
  },

  /**
   * Load settings from API/cache
   */
  async loadSettings() {
    try {
      // Try cache first
      let settings = await CacheManager.get('settings');

      if (!settings && navigator.onLine) {
        const response = await API.getSettings();
        if (response.success) {
          settings = response.settings || {};
          await CacheManager.set('settings', settings, 60 * 60 * 1000);
        }
      }

      this.settings = settings || this.getDefaultSettings();
      this.populateSettingsForm();

    } catch (error) {
      Utils.error('Failed to load settings:', error);
      this.settings = this.getDefaultSettings();
      this.populateSettingsForm();
    }
  },

  /**
   * Get default settings
   * @returns {Object} Default settings
   */
  getDefaultSettings() {
    return {
      clinicName: 'Родопи Дент',
      clinicPhone: '',
      clinicAddress: '',
      doctorName: '',
      workHours: {
        morningStart: '09:00',
        morningEnd: '12:00',
        afternoonStart: '13:30',
        afternoonEnd: '17:00'
      },
      defaultDuration: 60,
      allowOnlineBooking: true,
      requireConfirmation: true,
      smsEnabled: true,
      smsConfirmation: true,
      smsReminder: true,
      reminderHours: 24
    };
  },

  /**
   * Populate settings form with current values
   */
  populateSettingsForm() {
    const s = this.settings;

    // Clinic info
    this.setInputValue('setting-clinic-name', s.clinicName);
    this.setInputValue('setting-clinic-phone', s.clinicPhone);
    this.setInputValue('setting-clinic-address', s.clinicAddress);
    this.setInputValue('setting-doctor-name', s.doctorName);

    // Work hours
    this.setInputValue('setting-morning-start', s.workHours?.morningStart);
    this.setInputValue('setting-morning-end', s.workHours?.morningEnd);
    this.setInputValue('setting-afternoon-start', s.workHours?.afternoonStart);
    this.setInputValue('setting-afternoon-end', s.workHours?.afternoonEnd);

    // Booking settings
    this.setInputValue('setting-default-duration', s.defaultDuration);
    this.setCheckboxValue('setting-allow-booking', s.allowOnlineBooking);
    this.setCheckboxValue('setting-require-confirmation', s.requireConfirmation);

    // SMS settings
    this.setCheckboxValue('setting-sms-enabled', s.smsEnabled);
    this.setCheckboxValue('setting-sms-confirmation', s.smsConfirmation);
    this.setCheckboxValue('setting-sms-reminder', s.smsReminder);
    this.setInputValue('setting-reminder-hours', s.reminderHours);

    this.isDirty = false;
  },

  /**
   * Set input value helper
   * @param {string} id - Input ID
   * @param {any} value - Value
   */
  setInputValue(id, value) {
    const input = document.getElementById(id);
    if (input && value !== undefined) {
      input.value = value;
    }
  },

  /**
   * Set checkbox value helper
   * @param {string} id - Checkbox ID
   * @param {boolean} checked - Checked state
   */
  setCheckboxValue(id, checked) {
    const input = document.getElementById(id);
    if (input) {
      input.checked = !!checked;
    }
  },

  /**
   * Load procedures list
   */
  async loadProcedures() {
    try {
      let procedures = await CacheManager.get('procedures');

      if (!procedures && navigator.onLine) {
        const response = await API.getProcedures();
        if (response.success) {
          procedures = response.procedures || [];
          await CacheManager.set('procedures', procedures, 24 * 60 * 60 * 1000);
        }
      }

      this.procedures = procedures || [];
      this.renderProceduresTable();

    } catch (error) {
      Utils.error('Failed to load procedures:', error);
    }
  },

  /**
   * Render procedures table
   */
  renderProceduresTable() {
    const container = document.getElementById('procedures-table-body');
    if (!container) return;

    if (this.procedures.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="5" class="text-center">Няма процедури. Натиснете "Добави" за да добавите.</td>
        </tr>
      `;
      return;
    }

    // Group by category
    const grouped = this.procedures.reduce((acc, p) => {
      const cat = p.category || 'Други';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});

    let html = '';
    
    Object.entries(grouped).forEach(([category, procs]) => {
      // Category header
      html += `
        <tr class="procedures-category-row">
          <td colspan="5"><strong>${Utils.escapeHtml(category)}</strong></td>
        </tr>
      `;

      // Procedures in category
      procs.forEach(p => {
        html += `
          <tr data-code="${p.code}">
            <td>${Utils.escapeHtml(p.nhifCode || '-')}</td>
            <td>${Utils.escapeHtml(p.code)}</td>
            <td>${Utils.escapeHtml(p.description)}</td>
            <td class="text-right">${p.price.toFixed(2)} EUR</td>
            <td class="text-center">
              <button class="btn btn--small btn--outline" data-action="edit" title="Редактирай">✎</button>
              <button class="btn btn--small btn--outline" data-action="delete" title="Изтрий">🗑</button>
            </td>
          </tr>
        `;
      });
    });

    container.innerHTML = html;

    // Attach listeners
    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.closest('tr').dataset.code;
        const proc = this.procedures.find(p => p.code === code);
        this.showEditProcedureModal(proc);
      });
    });

    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.closest('tr').dataset.code;
        const proc = this.procedures.find(p => p.code === code);
        this.deleteProcedure(proc);
      });
    });
  },

  /**
   * Setup form handlers
   */
  setupFormHandlers() {
    // Track changes
    const inputs = document.querySelectorAll('.settings-panel input, .settings-panel select, .settings-panel textarea');
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        this.isDirty = true;
      });
    });

    // SMS enable toggle
    const smsEnabled = document.getElementById('setting-sms-enabled');
    smsEnabled?.addEventListener('change', () => {
      this.toggleSmsSettings(smsEnabled.checked);
    });

    // Initialize SMS settings visibility
    this.toggleSmsSettings(this.settings.smsEnabled);
  },

  /**
   * Toggle SMS settings visibility
   * @param {boolean} enabled - SMS enabled state
   */
  toggleSmsSettings(enabled) {
    const smsDetails = document.querySelectorAll('.sms-detail-setting');
    smsDetails.forEach(el => {
      el.style.display = enabled ? '' : 'none';
    });
  },

  /**
   * Setup action buttons
   */
  setupActions() {
    // Save settings button
    const saveBtn = document.getElementById('save-settings-btn');
    saveBtn?.addEventListener('click', () => this.saveSettings());

    // Add procedure button
    const addProcBtn = document.getElementById('add-procedure-btn');
    addProcBtn?.addEventListener('click', () => this.showAddProcedureModal());

    // Import procedures button
    const importBtn = document.getElementById('import-procedures-btn');
    importBtn?.addEventListener('click', () => this.showImportModal());

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn?.addEventListener('click', () => this.logout());

    // Clear cache button
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    clearCacheBtn?.addEventListener('click', () => this.clearCache());
  },

  /**
   * Collect settings from form
   * @returns {Object} Settings object
   */
  collectSettings() {
    return {
      clinicName: document.getElementById('setting-clinic-name')?.value || '',
      clinicPhone: document.getElementById('setting-clinic-phone')?.value || '',
      clinicAddress: document.getElementById('setting-clinic-address')?.value || '',
      doctorName: document.getElementById('setting-doctor-name')?.value || '',
      workHours: {
        morningStart: document.getElementById('setting-morning-start')?.value || '09:00',
        morningEnd: document.getElementById('setting-morning-end')?.value || '12:00',
        afternoonStart: document.getElementById('setting-afternoon-start')?.value || '13:30',
        afternoonEnd: document.getElementById('setting-afternoon-end')?.value || '17:00'
      },
      defaultDuration: parseInt(document.getElementById('setting-default-duration')?.value) || 60,
      allowOnlineBooking: document.getElementById('setting-allow-booking')?.checked ?? true,
      requireConfirmation: document.getElementById('setting-require-confirmation')?.checked ?? true,
      smsEnabled: document.getElementById('setting-sms-enabled')?.checked ?? true,
      smsConfirmation: document.getElementById('setting-sms-confirmation')?.checked ?? true,
      smsReminder: document.getElementById('setting-sms-reminder')?.checked ?? true,
      reminderHours: parseInt(document.getElementById('setting-reminder-hours')?.value) || 24
    };
  },

  /**
   * Save settings
   */
  async saveSettings() {
    const settings = this.collectSettings();

    try {
      Modal.loading('Запазване...');

      if (navigator.onLine) {
        await API.updateSettings(settings);
      } else {
        await OfflineQueue.add('update_settings', settings);
      }

      // Update local
      this.settings = settings;
      await CacheManager.set('settings', settings, 60 * 60 * 1000);

      // Update CONFIG
      CONFIG.WORK_HOURS.MORNING_START = parseInt(settings.workHours.morningStart.split(':')[0]);
      CONFIG.WORK_HOURS.MORNING_END = parseInt(settings.workHours.morningEnd.split(':')[0]);
      CONFIG.WORK_HOURS.AFTERNOON_START = parseFloat(settings.workHours.afternoonStart.replace(':', '.'));
      CONFIG.WORK_HOURS.AFTERNOON_END = parseInt(settings.workHours.afternoonEnd.split(':')[0]);

      this.isDirty = false;
      Modal.close();
      Toast.success('Настройките са запазени');

    } catch (error) {
      Modal.close();
      Toast.error('Грешка при запазване');
      Utils.error('Save settings failed:', error);
    }
  },

  /**
   * Show add procedure modal
   */
  showAddProcedureModal() {
    Modal.show({
      title: 'Добави процедура',
      body: `
        <form id="procedure-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">НЗОК код</label>
              <input type="text" name="nhifCode" class="form-input" placeholder="D01">
            </div>
            <div class="form-group">
              <label class="form-label">КСМП код *</label>
              <input type="text" name="code" class="form-input" placeholder="51101" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Описание *</label>
            <input type="text" name="description" class="form-input" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Цена (EUR) *</label>
              <input type="number" name="price" class="form-input" step="0.01" min="0" required>
            </div>
            <div class="form-group">
              <label class="form-label">Категория</label>
              <input type="text" name="category" class="form-input" placeholder="Профилактика">
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn--outline" data-action="cancel">Отказ</button>
        <button class="btn btn--primary" data-action="save">Добави</button>
      `,
      onShow: (modal) => {
        modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
          Modal.close();
        });

        modal.querySelector('[data-action="save"]')?.addEventListener('click', async () => {
          const form = modal.querySelector('#procedure-form');
          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }

          const formData = new FormData(form);
          await this.addProcedure({
            nhifCode: formData.get('nhifCode'),
            code: formData.get('code'),
            description: formData.get('description'),
            price: parseFloat(formData.get('price')),
            category: formData.get('category') || 'Други'
          });
        });
      }
    });
  },

  /**
   * Show edit procedure modal
   * @param {Object} procedure - Procedure data
   */
  showEditProcedureModal(procedure) {
    if (!procedure) return;

    Modal.show({
      title: 'Редактирай процедура',
      body: `
        <form id="procedure-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">НЗОК код</label>
              <input type="text" name="nhifCode" class="form-input" value="${procedure.nhifCode || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">КСМП код *</label>
              <input type="text" name="code" class="form-input" value="${procedure.code}" required readonly>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Описание *</label>
            <input type="text" name="description" class="form-input" value="${Utils.escapeHtml(procedure.description)}" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Цена (EUR) *</label>
              <input type="number" name="price" class="form-input" step="0.01" min="0" value="${procedure.price}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Категория</label>
              <input type="text" name="category" class="form-input" value="${Utils.escapeHtml(procedure.category || '')}">
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn--outline" data-action="cancel">Отказ</button>
        <button class="btn btn--primary" data-action="save">Запази</button>
      `,
      onShow: (modal) => {
        modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
          Modal.close();
        });

        modal.querySelector('[data-action="save"]')?.addEventListener('click', async () => {
          const form = modal.querySelector('#procedure-form');
          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }

          const formData = new FormData(form);
          await this.updateProcedure(procedure.code, {
            nhifCode: formData.get('nhifCode'),
            code: formData.get('code'),
            description: formData.get('description'),
            price: parseFloat(formData.get('price')),
            category: formData.get('category') || 'Други'
          });
        });
      }
    });
  },

  /**
   * Add new procedure
   * @param {Object} data - Procedure data
   */
  async addProcedure(data) {
    try {
      Modal.loading('Добавяне...');

      if (navigator.onLine) {
        await API.createProcedure(data);
      } else {
        await OfflineQueue.add('create_procedure', data);
      }

      // Update local list
      this.procedures.push(data);
      await CacheManager.set('procedures', this.procedures, 24 * 60 * 60 * 1000);
      this.renderProceduresTable();

      Modal.close();
      Toast.success('Процедурата е добавена');

    } catch (error) {
      Modal.close();
      Toast.error('Грешка при добавяне');
      Utils.error('Add procedure failed:', error);
    }
  },

  /**
   * Update procedure
   * @param {string} code - Procedure code
   * @param {Object} data - Updated data
   */
  async updateProcedure(code, data) {
    try {
      Modal.loading('Запазване...');

      if (navigator.onLine) {
        await API.updateProcedure(code, data);
      } else {
        await OfflineQueue.add('update_procedure', { code, ...data });
      }

      // Update local list
      const index = this.procedures.findIndex(p => p.code === code);
      if (index >= 0) {
        this.procedures[index] = { ...this.procedures[index], ...data };
      }
      await CacheManager.set('procedures', this.procedures, 24 * 60 * 60 * 1000);
      this.renderProceduresTable();

      Modal.close();
      Toast.success('Процедурата е обновена');

    } catch (error) {
      Modal.close();
      Toast.error('Грешка при запазване');
      Utils.error('Update procedure failed:', error);
    }
  },

  /**
   * Delete procedure
   * @param {Object} procedure - Procedure data
   */
  async deleteProcedure(procedure) {
    const confirmed = await Modal.confirm({
      title: 'Изтриване на процедура',
      message: `Сигурни ли сте, че искате да изтриете "${procedure.description}"?`,
      confirmText: 'Изтрий',
      danger: true
    });

    if (!confirmed) return;

    try {
      if (navigator.onLine) {
        await API.deleteProcedure(procedure.code);
      } else {
        await OfflineQueue.add('delete_procedure', { code: procedure.code });
      }

      // Update local list
      this.procedures = this.procedures.filter(p => p.code !== procedure.code);
      await CacheManager.set('procedures', this.procedures, 24 * 60 * 60 * 1000);
      this.renderProceduresTable();

      Toast.success('Процедурата е изтрита');

    } catch (error) {
      Toast.error('Грешка при изтриване');
      Utils.error('Delete procedure failed:', error);
    }
  },

  /**
   * Show import modal
   */
  showImportModal() {
    Modal.show({
      title: 'Импорт на процедури',
      body: `
        <p>Изберете CSV файл с процедури. Файлът трябва да съдържа колони:</p>
        <code>НЗОК код, КСМП код, Описание, Цена (EUR), Категория</code>
        <br><br>
        <input type="file" id="import-file" accept=".csv" class="form-input">
      `,
      footer: `
        <button class="btn btn--outline" data-action="cancel">Отказ</button>
        <button class="btn btn--primary" data-action="import">Импортирай</button>
      `,
      onShow: (modal) => {
        modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
          Modal.close();
        });

        modal.querySelector('[data-action="import"]')?.addEventListener('click', async () => {
          const fileInput = modal.querySelector('#import-file');
          const file = fileInput?.files[0];
          
          if (!file) {
            Toast.warning('Изберете файл');
            return;
          }

          await this.importProcedures(file);
        });
      }
    });
  },

  /**
   * Import procedures from CSV
   * @param {File} file - CSV file
   */
  async importProcedures(file) {
    try {
      Modal.loading('Импортиране...');

      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      
      // Skip header
      const dataLines = lines.slice(1);
      const imported = [];

      dataLines.forEach(line => {
        const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
        if (parts.length >= 4) {
          imported.push({
            nhifCode: parts[0] || '',
            code: parts[1],
            description: parts[2],
            price: parseFloat(parts[3]) || 0,
            category: parts[4] || 'Други'
          });
        }
      });

      if (imported.length === 0) {
        Modal.close();
        Toast.warning('Няма валидни процедури в файла');
        return;
      }

      // Merge with existing
      imported.forEach(newProc => {
        const existing = this.procedures.findIndex(p => p.code === newProc.code);
        if (existing >= 0) {
          this.procedures[existing] = newProc;
        } else {
          this.procedures.push(newProc);
        }
      });

      // Save
      if (navigator.onLine) {
        await API.updateProcedures(this.procedures);
      } else {
        await OfflineQueue.add('update_procedures', this.procedures);
      }

      await CacheManager.set('procedures', this.procedures, 24 * 60 * 60 * 1000);
      this.renderProceduresTable();

      Modal.close();
      Toast.success(`Импортирани ${imported.length} процедури`);

    } catch (error) {
      Modal.close();
      Toast.error('Грешка при импортиране');
      Utils.error('Import failed:', error);
    }
  },

  /**
   * Logout
   */
  async logout() {
    const confirmed = await Modal.confirm({
      title: 'Изход',
      message: 'Сигурни ли сте, че искате да излезете?',
      confirmText: 'Изход'
    });

    if (confirmed) {
      await Auth.logout();
      Router.navigate('/admin/login');
    }
  },

  /**
   * Clear cache
   */
  async clearCache() {
    const confirmed = await Modal.confirm({
      title: 'Изчистване на кеша',
      message: 'Това ще изчисти всички кеширани данни. Продължавате ли?',
      confirmText: 'Изчисти'
    });

    if (confirmed) {
      await CacheManager.clear();
      Toast.success('Кешът е изчистен');
    }
  },

  /**
   * Check for unsaved changes before leaving
   * @returns {boolean} Can leave
   */
  canLeave() {
    if (!this.isDirty) return true;

    return confirm('Имате незапазени промени. Сигурни ли сте, че искате да напуснете?');
  },

  /**
   * Cleanup
   */
  destroy() {
    this.settings = {};
    this.procedures = [];
    this.isDirty = false;
  }
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdminSettings;
}

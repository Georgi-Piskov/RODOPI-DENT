/**
 * Admin Finance Component
 * Financial tracking and reporting for admin panel
 */

const AdminFinance = {
  transactions: [],
  procedures: [],
  currentPeriod: 'month',
  selectedMonth: new Date(),
  stats: null,

  /**
   * Initialize finance page
   */
  async init() {
    Utils.log('AdminFinance: Initializing');

    // Setup period selector
    this.setupPeriodSelector();

    // Setup action buttons
    this.setupActions();

    // Load procedures list
    await this.loadProcedures();

    // Load current period data
    await this.loadTransactions();

    // Calculate and display stats
    this.updateStats();
  },

  /**
   * Setup period selector
   */
  setupPeriodSelector() {
    const periodBtns = document.querySelectorAll('[data-period]');
    periodBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.setPeriod(btn.dataset.period);
      });
    });

    // Month navigation
    const prevMonth = document.getElementById('finance-prev-month');
    const nextMonth = document.getElementById('finance-next-month');

    prevMonth?.addEventListener('click', () => this.navigateMonth(-1));
    nextMonth?.addEventListener('click', () => this.navigateMonth(1));

    // Initialize display
    this.updatePeriodDisplay();
  },

  /**
   * Set period filter
   * @param {string} period - Period type (day/week/month/year)
   */
  setPeriod(period) {
    this.currentPeriod = period;

    // Update button states
    document.querySelectorAll('[data-period]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.period === period);
    });

    // Reload transactions
    this.loadTransactions();
  },

  /**
   * Navigate month
   * @param {number} delta - Month delta (-1 or 1)
   */
  navigateMonth(delta) {
    this.selectedMonth.setMonth(this.selectedMonth.getMonth() + delta);
    this.updatePeriodDisplay();
    this.loadTransactions();
  },

  /**
   * Update period display
   */
  updatePeriodDisplay() {
    const display = document.getElementById('finance-period-display');
    if (display) {
      const month = CONFIG.I18N.MONTHS[this.selectedMonth.getMonth()];
      const year = this.selectedMonth.getFullYear();
      display.textContent = `${month} ${year}`;
    }
  },

  /**
   * Setup action buttons
   */
  setupActions() {
    // Add transaction button
    const addBtn = document.getElementById('add-transaction-btn');
    addBtn?.addEventListener('click', () => this.showAddTransactionModal());

    // Export button
    const exportBtn = document.getElementById('export-finance-btn');
    exportBtn?.addEventListener('click', () => this.exportData());

    // Refresh button
    const refreshBtn = document.getElementById('refresh-finance-btn');
    refreshBtn?.addEventListener('click', async () => {
      await CacheManager.clear();
      await this.loadTransactions();
      Toast.success('Обновено');
    });
  },

  /**
   * Load procedures list
   */
  async loadProcedures() {
    try {
      const cached = await CacheManager.get('procedures');
      if (cached) {
        this.procedures = cached;
        return;
      }

      if (navigator.onLine) {
        const response = await API.getProcedures();
        if (response.success) {
          this.procedures = response.procedures || [];
          await CacheManager.set('procedures', this.procedures, 24 * 60 * 60 * 1000);
        }
      }
    } catch (error) {
      Utils.error('Failed to load procedures:', error);
    }
  },

  /**
   * Load transactions for current period
   */
  async loadTransactions() {
    const container = document.getElementById('transactions-list');
    if (!container) return;

    // Show loading
    container.innerHTML = `
      <div class="loading">
        <div class="loading__spinner"></div>
        <p class="loading__text">Зареждане...</p>
      </div>
    `;

    try {
      const { startDate, endDate } = this.getPeriodDates();

      // Try cache first
      const cacheKey = `transactions_${startDate}_${endDate}`;
      let transactions = await CacheManager.get(cacheKey);

      if (!transactions && navigator.onLine) {
        const response = await API.getTransactions({ startDate, endDate });
        if (response.success) {
          transactions = response.transactions || [];
          await CacheManager.set(cacheKey, transactions, 10 * 60 * 1000);
        }
      }

      this.transactions = transactions || [];
      this.renderTransactions();
      this.updateStats();

    } catch (error) {
      Utils.error('Failed to load transactions:', error);
      container.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__text">Грешка при зареждане</p>
          <button class="btn btn--outline" onclick="AdminFinance.loadTransactions()">
            Опитай отново
          </button>
        </div>
      `;
    }
  },

  /**
   * Get period date range
   * @returns {Object} Start and end dates
   */
  getPeriodDates() {
    const now = new Date(this.selectedMonth);
    let startDate, endDate;

    switch (this.currentPeriod) {
      case 'day':
        startDate = Utils.formatDate(now, 'iso');
        endDate = startDate;
        break;

      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        startDate = Utils.formatDate(weekStart, 'iso');
        endDate = Utils.formatDate(weekEnd, 'iso');
        break;

      case 'month':
        startDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate = Utils.formatDate(lastDay, 'iso');
        break;

      case 'year':
        startDate = `${now.getFullYear()}-01-01`;
        endDate = `${now.getFullYear()}-12-31`;
        break;

      default:
        startDate = Utils.formatDate(new Date(now.getFullYear(), now.getMonth(), 1), 'iso');
        endDate = Utils.formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'iso');
    }

    return { startDate, endDate };
  },

  /**
   * Render transactions list
   */
  renderTransactions() {
    const container = document.getElementById('transactions-list');
    if (!container) return;

    if (this.transactions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">💰</div>
          <p class="empty-state__text">Няма транзакции за избрания период</p>
          <button class="btn btn--primary" onclick="AdminFinance.showAddTransactionModal()">
            + Добави транзакция
          </button>
        </div>
      `;
      return;
    }

    // Group by date
    const grouped = this.transactions.reduce((acc, t) => {
      const date = t.date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(t);
      return acc;
    }, {});

    // Sort dates descending
    const sortedDates = Object.keys(grouped).sort().reverse();

    let html = '<div class="transactions">';

    sortedDates.forEach(date => {
      const dayTransactions = grouped[date];
      const dayTotal = dayTransactions.reduce((sum, t) => {
        return sum + (t.type === 'income' ? t.amount : -t.amount);
      }, 0);

      html += `
        <div class="transactions__group">
          <div class="transactions__group-header">
            <span class="transactions__group-date">${Utils.formatDate(date, 'long')}</span>
            <span class="transactions__group-total ${dayTotal >= 0 ? 'text-success' : 'text-danger'}">
              ${dayTotal >= 0 ? '+' : ''}${dayTotal.toFixed(2)} EUR
            </span>
          </div>
          <div class="transactions__group-items">
            ${dayTransactions.map(t => this.renderTransaction(t)).join('')}
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;

    // Attach listeners
    this.attachTransactionListeners();
  },

  /**
   * Render a single transaction
   * @param {Object} t - Transaction data
   * @returns {string} HTML string
   */
  renderTransaction(t) {
    const isIncome = t.type === 'income';
    const procedure = this.procedures.find(p => p.code === t.procedureCode);
    const procedureName = procedure ? procedure.description : t.procedureCode || 'Друго';

    return `
      <div class="transaction-item" data-id="${t.id}">
        <div class="transaction-item__icon ${isIncome ? 'transaction-item__icon--income' : 'transaction-item__icon--expense'}">
          ${isIncome ? '↓' : '↑'}
        </div>
        <div class="transaction-item__content">
          <div class="transaction-item__title">${Utils.escapeHtml(procedureName)}</div>
          ${t.patientName ? `<div class="transaction-item__subtitle">${Utils.escapeHtml(t.patientName)}</div>` : ''}
          ${t.notes ? `<div class="transaction-item__notes">${Utils.escapeHtml(t.notes)}</div>` : ''}
        </div>
        <div class="transaction-item__amount ${isIncome ? 'text-success' : 'text-danger'}">
          ${isIncome ? '+' : '-'}${t.amount.toFixed(2)} EUR
        </div>
        <div class="transaction-item__actions">
          <button class="btn btn--small btn--outline" data-action="edit" title="Редактирай">✎</button>
          <button class="btn btn--small btn--outline" data-action="delete" title="Изтрий">🗑</button>
        </div>
      </div>
    `;
  },

  /**
   * Attach event listeners to transactions
   */
  attachTransactionListeners() {
    const items = document.querySelectorAll('.transaction-item');
    
    items.forEach(item => {
      const id = item.dataset.id;
      const transaction = this.transactions.find(t => t.id === id);

      item.querySelector('[data-action="edit"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showEditTransactionModal(transaction);
      });

      item.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteTransaction(transaction);
      });
    });
  },

  /**
   * Update statistics display
   */
  updateStats() {
    const totalIncome = this.transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = this.transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpense;
    const transactionCount = this.transactions.length;

    // NHIF income
    const nhifIncome = this.transactions
      .filter(t => t.type === 'income' && t.procedureCode && t.procedureCode.startsWith('D'))
      .reduce((sum, t) => sum + t.amount, 0);

    // Update UI
    document.getElementById('stat-total-income')?.textContent = `${totalIncome.toFixed(2)} EUR`;
    document.getElementById('stat-total-expense')?.textContent = `${totalExpense.toFixed(2)} EUR`;
    document.getElementById('stat-balance')?.textContent = `${balance.toFixed(2)} EUR`;
    document.getElementById('stat-transaction-count')?.textContent = transactionCount;
    document.getElementById('stat-nhif-income')?.textContent = `${nhifIncome.toFixed(2)} EUR`;

    // Update balance color
    const balanceEl = document.getElementById('stat-balance');
    if (balanceEl) {
      balanceEl.className = balance >= 0 ? 'stat-value text-success' : 'stat-value text-danger';
    }

    this.stats = { totalIncome, totalExpense, balance, transactionCount, nhifIncome };
  },

  /**
   * Show add transaction modal
   */
  showAddTransactionModal() {
    const procedureOptions = this.procedures.map(p => 
      `<option value="${p.code}" data-price="${p.price}">${p.code} - ${p.description} (${p.price} EUR)</option>`
    ).join('');

    Modal.show({
      title: 'Нова транзакция',
      size: 'large',
      body: `
        <form id="transaction-form">
          <div class="form-group">
            <label class="form-label">Тип</label>
            <div class="form-radio-group">
              <label class="form-radio">
                <input type="radio" name="type" value="income" checked>
                <span>Приход</span>
              </label>
              <label class="form-radio">
                <input type="radio" name="type" value="expense">
                <span>Разход</span>
              </label>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Дата</label>
              <input type="date" name="date" class="form-input" value="${Utils.formatDate(new Date(), 'iso')}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Сума (EUR) *</label>
              <input type="number" name="amount" class="form-input" step="0.01" min="0.01" required>
            </div>
          </div>
          <div class="form-group" id="procedure-group">
            <label class="form-label">Процедура (НЗОК)</label>
            <select name="procedureCode" class="form-select" id="transaction-procedure">
              <option value="">-- Без процедура --</option>
              ${procedureOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Пациент</label>
            <input type="text" name="patientName" class="form-input" placeholder="Име на пациент">
          </div>
          <div class="form-group">
            <label class="form-label">Бележки</label>
            <textarea name="notes" class="form-textarea" rows="2"></textarea>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn--outline" data-action="cancel">Отказ</button>
        <button class="btn btn--primary" data-action="save">Запази</button>
      `,
      onShow: (modal) => {
        // Procedure selection updates amount
        const procedureSelect = modal.querySelector('#transaction-procedure');
        const amountInput = modal.querySelector('input[name="amount"]');
        
        procedureSelect?.addEventListener('change', () => {
          const selected = procedureSelect.options[procedureSelect.selectedIndex];
          const price = selected?.dataset.price;
          if (price) amountInput.value = price;
        });

        // Type change hides/shows procedure
        const typeInputs = modal.querySelectorAll('input[name="type"]');
        const procedureGroup = modal.querySelector('#procedure-group');
        
        typeInputs.forEach(input => {
          input.addEventListener('change', () => {
            if (input.value === 'expense') {
              procedureGroup.style.display = 'none';
              procedureSelect.value = '';
            } else {
              procedureGroup.style.display = '';
            }
          });
        });

        // Buttons
        modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
          Modal.close();
        });

        modal.querySelector('[data-action="save"]')?.addEventListener('click', async () => {
          const form = modal.querySelector('#transaction-form');
          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }

          const formData = new FormData(form);
          await this.createTransaction({
            type: formData.get('type'),
            date: formData.get('date'),
            amount: parseFloat(formData.get('amount')),
            procedureCode: formData.get('procedureCode'),
            patientName: formData.get('patientName'),
            notes: formData.get('notes')
          });
        });
      }
    });
  },

  /**
   * Show edit transaction modal
   * @param {Object} transaction - Transaction data
   */
  showEditTransactionModal(transaction) {
    if (!transaction) return;

    const procedureOptions = this.procedures.map(p => 
      `<option value="${p.code}" ${p.code === transaction.procedureCode ? 'selected' : ''}>
        ${p.code} - ${p.description} (${p.price} EUR)
      </option>`
    ).join('');

    Modal.show({
      title: 'Редактиране на транзакция',
      size: 'large',
      body: `
        <form id="transaction-form">
          <div class="form-group">
            <label class="form-label">Тип</label>
            <div class="form-radio-group">
              <label class="form-radio">
                <input type="radio" name="type" value="income" ${transaction.type === 'income' ? 'checked' : ''}>
                <span>Приход</span>
              </label>
              <label class="form-radio">
                <input type="radio" name="type" value="expense" ${transaction.type === 'expense' ? 'checked' : ''}>
                <span>Разход</span>
              </label>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Дата</label>
              <input type="date" name="date" class="form-input" value="${transaction.date}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Сума (EUR) *</label>
              <input type="number" name="amount" class="form-input" step="0.01" min="0.01" 
                     value="${transaction.amount}" required>
            </div>
          </div>
          <div class="form-group" id="procedure-group" ${transaction.type === 'expense' ? 'style="display:none"' : ''}>
            <label class="form-label">Процедура (НЗОК)</label>
            <select name="procedureCode" class="form-select">
              <option value="">-- Без процедура --</option>
              ${procedureOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Пациент</label>
            <input type="text" name="patientName" class="form-input" value="${Utils.escapeHtml(transaction.patientName || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Бележки</label>
            <textarea name="notes" class="form-textarea" rows="2">${Utils.escapeHtml(transaction.notes || '')}</textarea>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn--outline" data-action="cancel">Отказ</button>
        <button class="btn btn--primary" data-action="save">Запази</button>
      `,
      onShow: (modal) => {
        // Type change
        const typeInputs = modal.querySelectorAll('input[name="type"]');
        const procedureGroup = modal.querySelector('#procedure-group');
        
        typeInputs.forEach(input => {
          input.addEventListener('change', () => {
            procedureGroup.style.display = input.value === 'expense' ? 'none' : '';
          });
        });

        // Buttons
        modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
          Modal.close();
        });

        modal.querySelector('[data-action="save"]')?.addEventListener('click', async () => {
          const form = modal.querySelector('#transaction-form');
          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }

          const formData = new FormData(form);
          await this.updateTransaction(transaction.id, {
            type: formData.get('type'),
            date: formData.get('date'),
            amount: parseFloat(formData.get('amount')),
            procedureCode: formData.get('procedureCode'),
            patientName: formData.get('patientName'),
            notes: formData.get('notes')
          });
        });
      }
    });
  },

  /**
   * Create new transaction
   * @param {Object} data - Transaction data
   */
  async createTransaction(data) {
    try {
      Modal.loading('Запазване...');

      if (navigator.onLine) {
        await API.createTransaction(data);
      } else {
        await OfflineQueue.add('create_transaction', data);
      }

      Toast.success('Транзакцията е добавена');
      Modal.close();
      await this.loadTransactions();

    } catch (error) {
      Modal.close();
      Toast.error('Грешка при запазване');
      Utils.error('Create transaction failed:', error);
    }
  },

  /**
   * Update transaction
   * @param {string} id - Transaction ID
   * @param {Object} data - Updated data
   */
  async updateTransaction(id, data) {
    try {
      Modal.loading('Запазване...');

      if (navigator.onLine) {
        await API.updateTransaction(id, data);
      } else {
        await OfflineQueue.add('update_transaction', { id, ...data });
      }

      Toast.success('Транзакцията е обновена');
      Modal.close();
      await this.loadTransactions();

    } catch (error) {
      Modal.close();
      Toast.error('Грешка при запазване');
      Utils.error('Update transaction failed:', error);
    }
  },

  /**
   * Delete transaction
   * @param {Object} transaction - Transaction data
   */
  async deleteTransaction(transaction) {
    const confirmed = await Modal.confirm({
      title: 'Изтриване на транзакция',
      message: `Сигурни ли сте, че искате да изтриете тази транзакция?`,
      confirmText: 'Изтрий',
      danger: true
    });

    if (!confirmed) return;

    try {
      if (navigator.onLine) {
        await API.deleteTransaction(transaction.id);
      } else {
        await OfflineQueue.add('delete_transaction', { id: transaction.id });
      }

      Toast.success('Транзакцията е изтрита');
      await this.loadTransactions();

    } catch (error) {
      Toast.error('Грешка при изтриване');
      Utils.error('Delete transaction failed:', error);
    }
  },

  /**
   * Export data to CSV
   */
  exportData() {
    if (this.transactions.length === 0) {
      Toast.warning('Няма данни за експорт');
      return;
    }

    const { startDate, endDate } = this.getPeriodDates();
    
    // CSV header
    let csv = 'Дата,Тип,Процедура,Пациент,Сума (EUR),Бележки\n';

    // CSV rows
    this.transactions.forEach(t => {
      const procedure = this.procedures.find(p => p.code === t.procedureCode);
      const procedureName = procedure ? `${t.procedureCode} - ${procedure.description}` : (t.procedureCode || '');
      
      csv += [
        t.date,
        t.type === 'income' ? 'Приход' : 'Разход',
        `"${procedureName}"`,
        `"${t.patientName || ''}"`,
        t.amount.toFixed(2),
        `"${(t.notes || '').replace(/"/g, '""')}"`
      ].join(',') + '\n';
    });

    // Add totals
    csv += '\n';
    csv += `Общо приходи:,,,${this.stats.totalIncome.toFixed(2)} EUR\n`;
    csv += `Общо разходи:,,,${this.stats.totalExpense.toFixed(2)} EUR\n`;
    csv += `Баланс:,,,${this.stats.balance.toFixed(2)} EUR\n`;
    csv += `НЗОК приходи:,,,${this.stats.nhifIncome.toFixed(2)} EUR\n`;

    // Download
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rodopi-dent-finance-${startDate}-${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    Toast.success('Файлът е изтеглен');
  },

  /**
   * Cleanup
   */
  destroy() {
    this.transactions = [];
    this.stats = null;
  }
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdminFinance;
}

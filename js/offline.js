/**
 * Offline Module
 * Handles offline functionality, IndexedDB queue, and background sync
 */

const OfflineQueue = {
  DB_NAME: 'rodopi_offline_db',
  DB_VERSION: 1,
  STORE_NAME: 'offline_queue',
  db: null,

  /**
   * Initialize IndexedDB
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = () => {
        Utils.error('IndexedDB error:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        Utils.log('IndexedDB initialized');
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object store for offline queue
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true
          });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('endpoint', 'endpoint', { unique: false });
        }
        
        // Create store for cached data
        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
          cacheStore.createIndex('expiry', 'expiry', { unique: false });
        }
      };
    });
  },

  /**
   * Add item to offline queue
   * @param {Object} item - Item to queue
   */
  async add(item) {
    if (!this.db) {
      await this.init();
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const request = store.add({
        ...item,
        id: Utils.generateId(),
        timestamp: Date.now(),
        retries: 0
      });
      
      request.onsuccess = () => {
        Utils.log('Added to offline queue:', item.endpoint);
        this.updateQueueIndicator();
        resolve(request.result);
      };
      
      request.onerror = () => {
        Utils.error('Failed to add to queue:', request.error);
        reject(request.error);
      };
    });
  },

  /**
   * Get all queued items
   * @returns {Promise<Array>} Queued items
   */
  async getAll() {
    if (!this.db) {
      await this.init();
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  },

  /**
   * Remove item from queue
   * @param {string} id - Item ID
   */
  async remove(id) {
    if (!this.db) {
      await this.init();
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(id);
      
      request.onsuccess = () => {
        this.updateQueueIndicator();
        resolve();
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  },

  /**
   * Clear all queued items
   */
  async clear() {
    if (!this.db) {
      await this.init();
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => {
        this.updateQueueIndicator();
        resolve();
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  },

  /**
   * Get queue count
   * @returns {Promise<number>} Number of queued items
   */
  async getCount() {
    if (!this.db) {
      await this.init();
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.count();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  },

  /**
   * Process all queued items
   */
  async processQueue() {
    if (!navigator.onLine) {
      Utils.log('Still offline, skipping queue processing');
      return;
    }
    
    const items = await this.getAll();
    
    if (items.length === 0) {
      Utils.log('Queue is empty');
      return;
    }
    
    Utils.log(`Processing ${items.length} queued items`);
    Toast.info(`Синхронизиране на ${items.length} промени...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const item of items) {
      try {
        // Make the API request
        const response = await fetch(CONFIG.API.BASE_URL + item.endpoint, item.options);
        
        if (response.ok) {
          await this.remove(item.id);
          successCount++;
        } else {
          // Increment retry count
          if (item.retries < 3) {
            await this.updateRetryCount(item.id, item.retries + 1);
          } else {
            // Max retries reached, remove from queue
            await this.remove(item.id);
            errorCount++;
          }
        }
      } catch (error) {
        Utils.error('Error processing queue item:', error);
        errorCount++;
      }
    }
    
    // Show result
    if (successCount > 0) {
      Toast.success(`${successCount} промени синхронизирани успешно`);
    }
    
    if (errorCount > 0) {
      Toast.warning(`${errorCount} промени не можаха да бъдат синхронизирани`);
    }
    
    this.updateQueueIndicator();
  },

  /**
   * Update retry count for an item
   * @param {string} id - Item ID
   * @param {number} retries - New retry count
   */
  async updateRetryCount(id, retries) {
    if (!this.db) {
      await this.init();
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.retries = retries;
          const updateRequest = store.put(item);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  },

  /**
   * Update queue indicator in UI
   */
  async updateQueueIndicator() {
    const count = await this.getCount();
    const syncBtn = document.getElementById('admin-sync-btn');
    
    if (syncBtn) {
      if (count > 0) {
        syncBtn.innerHTML = `<span class="btn__icon">🔄</span> Синхронизирай (${count})`;
        syncBtn.classList.add('btn--warning');
      } else {
        syncBtn.innerHTML = `<span class="btn__icon">🔄</span> Синхронизирай`;
        syncBtn.classList.remove('btn--warning');
      }
    }
  }
};

/**
 * Cache Manager for offline data
 */
const CacheManager = {
  /**
   * Get cached data
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached data or null
   */
  async get(key) {
    if (!OfflineQueue.db) {
      await OfflineQueue.init();
    }
    
    return new Promise((resolve, reject) => {
      const transaction = OfflineQueue.db.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        
        // Check expiry
        if (result && result.expiry > Date.now()) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  },

  /**
   * Set cached data
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  async set(key, data, ttl = CONFIG.CACHE.APPOINTMENTS_TTL) {
    if (!OfflineQueue.db) {
      await OfflineQueue.init();
    }
    
    return new Promise((resolve, reject) => {
      const transaction = OfflineQueue.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      
      const request = store.put({
        key,
        data,
        expiry: Date.now() + ttl,
        timestamp: Date.now()
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Remove cached data
   * @param {string} key - Cache key
   */
  async remove(key) {
    if (!OfflineQueue.db) {
      await OfflineQueue.init();
    }
    
    return new Promise((resolve, reject) => {
      const transaction = OfflineQueue.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Clear all cached data
   */
  async clear() {
    if (!OfflineQueue.db) {
      await OfflineQueue.init();
    }
    
    return new Promise((resolve, reject) => {
      const transaction = OfflineQueue.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Clean up expired cache entries
   */
  async cleanup() {
    if (!OfflineQueue.db) {
      await OfflineQueue.init();
    }
    
    return new Promise((resolve, reject) => {
      const transaction = OfflineQueue.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const index = store.index('expiry');
      const now = Date.now();
      
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
};

/**
 * Offline Status Handler
 */
const OfflineStatus = {
  /**
   * Initialize offline status handling
   */
  init() {
    // Update UI on status change
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Set initial state
    if (!navigator.onLine) {
      this.handleOffline();
    }
    
    // Listen for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'PROCESS_OFFLINE_QUEUE') {
          OfflineQueue.processQueue();
        }
      });
    }
  },

  /**
   * Handle coming online
   */
  handleOnline() {
    Utils.log('App is online');
    
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
      indicator.hidden = true;
    }
    
    Toast.success('Връзката е възстановена');
    
    // Process offline queue
    OfflineQueue.processQueue();
  },

  /**
   * Handle going offline
   */
  handleOffline() {
    Utils.log('App is offline');
    
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
      indicator.hidden = false;
    }
    
    Toast.warning('Работите офлайн');
  },

  /**
   * Check current online status
   * @returns {boolean}
   */
  isOnline() {
    return navigator.onLine;
  },

  /**
   * Register background sync
   */
  async registerBackgroundSync() {
    if ('serviceWorker' in navigator && 'sync' in window.registration) {
      try {
        await navigator.serviceWorker.ready;
        await registration.sync.register('rodopi-sync');
        Utils.log('Background sync registered');
      } catch (error) {
        Utils.error('Background sync registration failed:', error);
      }
    }
  }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  OfflineQueue.init();
  OfflineStatus.init();
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OfflineQueue, CacheManager, OfflineStatus };
}

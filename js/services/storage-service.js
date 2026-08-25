/**
 * storage-service.js
 * Manages localStorage persistence for API keys, user preferences, and multi-tier cache.
 * Yokohama Municipal Bus Transit Guide & Real-Time Operation Web App
 */

import { CONFIG, STORAGE_KEYS, DEFAULT_CONSUMER_KEY, DEFAULT_TRANSFER_BUFFER_MINUTES, DEFAULT_POLLING_INTERVAL_SEC } from '../config.js';

export class StorageService {
  constructor(storage = null) {
    this._memoryFallback = new Map();
    this._storage = storage;
  }

  _getStorage() {
    if (this._storage) return this._storage;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
      if (typeof localStorage !== 'undefined') {
        return localStorage;
      }
    } catch {
      // ignore
    }
    return null;
  }

  _getItem(key) {
    const storage = this._getStorage();
    try {
      if (storage) {
        const val = storage.getItem(key);
        if (val !== null && val !== undefined) {
          return val;
        }
      }
    } catch {
      // Fallback to memory
    }
    return this._memoryFallback.has(key) ? this._memoryFallback.get(key) : null;
  }

  _setItem(key, value) {
    const storage = this._getStorage();
    try {
      if (storage) {
        storage.setItem(key, String(value));
        this._memoryFallback.delete(key);
        return true;
      }
    } catch (e) {
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
        // Quota exceeded: clean old cache items and retry once
        this.clearCache();
        try {
          const retryStorage = this._getStorage();
          if (retryStorage) {
            retryStorage.setItem(key, String(value));
            this._memoryFallback.delete(key);
            return true;
          }
        } catch {
          // Still failed, fall back to memory
        }
      }
    }
    this._memoryFallback.set(key, String(value));
    return false;
  }

  _removeItem(key) {
    try {
      if (this._storage) {
        this._storage.removeItem(key);
      }
    } catch {
      // Ignore
    }
    this._memoryFallback.delete(key);
  }

  // --- API Key Management ---

  hasApiKey() {
    const key = this.getApiKey();
    return Boolean(key && key.length > 0);
  }

  getApiKey() {
    const key = this._getItem(STORAGE_KEYS.API_KEY) || this._getItem('odpt_api_key');
    if (key && typeof key === 'string' && key.trim().length > 0) {
      return key.trim();
    }
    return DEFAULT_CONSUMER_KEY;
  }

  setApiKey(key) {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      this._removeItem(STORAGE_KEYS.API_KEY);
      this._removeItem('odpt_api_key');
      return DEFAULT_CONSUMER_KEY;
    }
    const sanitizedKey = key.trim();
    this._setItem(STORAGE_KEYS.API_KEY, sanitizedKey);
    return sanitizedKey;
  }

  resetApiKey() {
    this._removeItem(STORAGE_KEYS.API_KEY);
    this._removeItem('odpt_api_key');
    return DEFAULT_CONSUMER_KEY;
  }

  // --- Transfer Buffer (Minutes) ---

  getTransferBuffer() {
    const raw = this._getItem(STORAGE_KEYS.TRANSFER_BUFFER) || this._getItem('transfer_buffer_minutes');
    if (raw !== null && raw !== undefined) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed)) {
        return Math.max(0, Math.min(30, parsed));
      }
    }
    return DEFAULT_TRANSFER_BUFFER_MINUTES;
  }

  setTransferBuffer(minutes) {
    let parsed = typeof minutes === 'number' ? minutes : parseInt(minutes, 10);
    if (isNaN(parsed)) {
      parsed = DEFAULT_TRANSFER_BUFFER_MINUTES;
    }
    const clamped = Math.max(0, Math.min(30, parsed));
    this._setItem(STORAGE_KEYS.TRANSFER_BUFFER, String(clamped));
    return clamped;
  }

  // --- Theme ('light' | 'dark' | 'system') ---

  getTheme() {
    const saved = this._getItem(STORAGE_KEYS.THEME) || this._getItem('app_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
    return 'system';
  }

  setTheme(theme) {
    const validThemes = ['light', 'dark', 'system'];
    const selected = validThemes.includes(theme) ? theme : 'system';
    this._setItem(STORAGE_KEYS.THEME, selected);
    return selected;
  }

  // --- Auto-Refresh Interval (Seconds) ---

  getAutoRefreshInterval() {
    const raw = this._getItem(STORAGE_KEYS.AUTO_REFRESH) || this._getItem('auto_poll_enabled');
    if (raw !== null && raw !== undefined) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed)) {
        return Math.max(0, Math.min(120, parsed));
      }
    }
    return DEFAULT_POLLING_INTERVAL_SEC;
  }

  setAutoRefreshInterval(seconds) {
    let parsed = typeof seconds === 'number' ? seconds : parseInt(seconds, 10);
    if (isNaN(parsed)) {
      parsed = DEFAULT_POLLING_INTERVAL_SEC;
    }
    const clamped = Math.max(0, Math.min(120, parsed));
    this._setItem(STORAGE_KEYS.AUTO_REFRESH, String(clamped));
    return clamped;
  }

  // --- Multi-Tier Cache with TTL ---

  getCached(key) {
    return this.getCachedData(key);
  }

  getCachedData(key) {
    const prefixedKey = key.startsWith(STORAGE_KEYS.CACHE_PREFIX) ? key : `${STORAGE_KEYS.CACHE_PREFIX}${key}`;
    const raw = this._getItem(prefixedKey);
    if (!raw) return null;

    try {
      const envelope = JSON.parse(raw);
      if (!envelope || typeof envelope !== 'object') {
        this._removeItem(prefixedKey);
        return null;
      }
      const now = Date.now();
      if (envelope.expiresAt && envelope.expiresAt < now) {
        // Expired
        this._removeItem(prefixedKey);
        return null;
      }
      return envelope.data !== undefined ? envelope.data : null;
    } catch {
      // Corrupted JSON
      this._removeItem(prefixedKey);
      return null;
    }
  }

  setCached(key, data, ttlSeconds = 86400) {
    return this.setCachedData(key, data, ttlSeconds);
  }

  setCachedData(key, data, ttlSeconds = 86400) {
    if (ttlSeconds <= 0) return; // Do not cache realtime/0-TTL items
    const prefixedKey = key.startsWith(STORAGE_KEYS.CACHE_PREFIX) ? key : `${STORAGE_KEYS.CACHE_PREFIX}${key}`;
    const now = Date.now();
    const envelope = {
      key: prefixedKey,
      cachedAt: now,
      expiresAt: now + ttlSeconds * 1000,
      data
    };
    try {
      this._setItem(prefixedKey, JSON.stringify(envelope));
    } catch {
      // If serialization fails, ignore safely
    }
  }

  clearCache() {
    try {
      if (this._storage) {
        const keysToRemove = [];
        for (let i = 0; i < this._storage.length; i++) {
          const k = this._storage.key(i);
          if (k && (k.startsWith(STORAGE_KEYS.CACHE_PREFIX) || k.startsWith('cache_') || k.startsWith('transporter_cache_'))) {
            keysToRemove.push(k);
          }
        }
        for (const k of keysToRemove) {
          this._storage.removeItem(k);
        }
      }
    } catch {
      // Ignore
    }

    for (const k of Array.from(this._memoryFallback.keys())) {
      if (k.startsWith(STORAGE_KEYS.CACHE_PREFIX) || k.startsWith('cache_') || k.startsWith('transporter_cache_')) {
        this._memoryFallback.delete(k);
      }
    }
  }
}

export const storageService = new StorageService();
export default storageService;

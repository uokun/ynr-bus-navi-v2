/**
 * state.js
 * Central reactive application state management for Yokohama City Bus Navigator.
 * Supports subscribe/notify pattern for reactive UI updates.
 * Yokohama Municipal Bus Transit Guide & Real-Time Operation Web App
 */

import { DEFAULT_CONSUMER_KEY, DEFAULT_TRANSFER_BUFFER_MINUTES, DEFAULT_POLLING_INTERVAL_SEC } from './config.js';
import { storageService } from './services/storage-service.js';
import { calendarService } from './services/calendar-service.js';

export class AppState {
  constructor(initialState = {}) {
    this._listeners = new Set();
    this._state = {
      direction: 'outbound', // 'outbound' (洋光台北口 -> 古泉) | 'inbound' (古泉 -> 洋光台北口)
      currentTab: 'transfer', // 'transfer' | 'stop-yokodai' | 'stop-kamiooka' | 'stop-koizumi' | 'timetable-all'
      activeFilter: 'all', // 'all' | '111' | '133' | '64'
      bufferMinutes: storageService.getTransferBuffer() ?? DEFAULT_TRANSFER_BUFFER_MINUTES,
      apiKey: storageService.getApiKey() || DEFAULT_CONSUMER_KEY,
      theme: storageService.getTheme() || 'system',
      autoRefreshInterval: storageService.getAutoRefreshInterval() || DEFAULT_POLLING_INTERVAL_SEC,
      calendarType: calendarService.getCalendarType(new Date()),
      busstopPoles: [],
      timetables: {
        line111Outbound: [],
        line133Outbound: [],
        line133OutboundKoizumi: [],
        line64Outbound: [],
        line133Inbound: [],
        line111Inbound: [],
        line111InboundYokodai: []
      },
      realtimeBuses: [],
      busInformation: [],
      transferResult: {
        recommended: null,
        alternatives: [],
        status: 'initial'
      },
      lastUpdated: null,
      isPolling: true,
      countdownSeconds: DEFAULT_POLLING_INTERVAL_SEC,
      isOffline: (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') ? !navigator.onLine : false,
      isLoading: false,
      ...initialState
    };
  }

  /**
   * Returns a copy of the current state.
   * @returns {Object}
   */
  getState() {
    return { ...this._state };
  }

  /**
   * Updates partial state and notifies all subscribed listeners.
   * @param {Object} partialState
   */
  setState(partialState) {
    if (!partialState || typeof partialState !== 'object') return;

    const changedKeys = [];
    for (const [key, value] of Object.entries(partialState)) {
      if (this._state[key] !== value) {
        this._state[key] = value;
        changedKeys.push(key);
      }
    }

    if (changedKeys.length > 0) {
      this.notify(changedKeys);
    }
  }

  /**
   * Alias for setState
   */
  update(partialState) {
    this.setState(partialState);
  }

  /**
   * Subscribes a listener to state changes.
   * @param {Function} listener
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Notifies all listeners of state changes.
   * @param {Array<string>} [changedKeys=[]]
   */
  notify(changedKeys = []) {
    const stateCopy = this.getState();
    for (const listener of this._listeners) {
      try {
        listener(stateCopy, changedKeys);
      } catch (err) {
        console.error('[AppState] Error in state listener:', err);
      }
    }
  }

  /**
   * Resets state to default values.
   */
  reset() {
    this.setState({
      direction: 'outbound',
      currentTab: 'transfer',
      activeFilter: 'all',
      bufferMinutes: storageService.getTransferBuffer() ?? DEFAULT_TRANSFER_BUFFER_MINUTES,
      apiKey: storageService.getApiKey() || DEFAULT_CONSUMER_KEY,
      theme: storageService.getTheme() || 'system',
      autoRefreshInterval: storageService.getAutoRefreshInterval() || DEFAULT_POLLING_INTERVAL_SEC,
      calendarType: calendarService.getCalendarType(new Date()),
      busstopPoles: [],
      timetables: {
        line111Outbound: [],
        line133Outbound: [],
        line133OutboundKoizumi: [],
        line64Outbound: [],
        line133Inbound: [],
        line111Inbound: [],
        line111InboundYokodai: []
      },
      realtimeBuses: [],
      busInformation: [],
      transferResult: {
        recommended: null,
        alternatives: [],
        status: 'initial'
      },
      lastUpdated: null,
      isPolling: true,
      countdownSeconds: DEFAULT_POLLING_INTERVAL_SEC,
      isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
      isLoading: false
    });
  }
}

export const state = new AppState();
export default state;

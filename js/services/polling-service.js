/**
 * polling-service.js
 * Automatic background polling timer with countdown management and Page Visibility API controls.
 * Yokohama Municipal Bus Transit Guide & Real-Time Operation Web App
 */

import { DEFAULT_POLLING_INTERVAL_SEC } from '../config.js';
import { updateCountdownIndicator } from '../ui/render-status.js';

export class PollingService {
  /**
   * @param {Object|number|Function} [options={}]
   * @param {number} [options.intervalSec=30]
   * @param {Function} [options.onTick]
   * @param {Function} [options.onRefresh]
   * @param {Object} [options.state]
   * @param {Function} [onRefreshCallback=null]
   */
  constructor(options = {}, onRefreshCallback = null) {
    let opts = options;
    if (typeof options === 'number') {
      const sec = options >= 1000 ? Math.round(options / 1000) : options;
      opts = {
        intervalSec: sec,
        onRefresh: onRefreshCallback
      };
    } else if (typeof options === 'function') {
      opts = {
        onRefresh: options
      };
    }

    this.intervalSec = typeof opts.intervalSec === 'number' ? opts.intervalSec : DEFAULT_POLLING_INTERVAL_SEC;
    this.onTick = opts.onTick || ((sec, isPaused) => updateCountdownIndicator(sec, isPaused));
    this.onRefresh = opts.onRefresh || onRefreshCallback || (() => {});
    this.state = opts.state || null;

    this.countdownSeconds = this.intervalSec;
    this.timerId = null;
    this.isPaused = false;
    this.isRunning = false;
    this.lastManualRefreshTime = 0;
    this.debounceMs = 2000;

    this._boundVisibilityHandler = this._handleVisibilityChange.bind(this);
  }

  /**
   * Starts the 1-second interval loop.
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.countdownSeconds = this.intervalSec;

    // Attach Page Visibility listener
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._boundVisibilityHandler);
      document.addEventListener('visibilitychange', this._boundVisibilityHandler);
    }

    if (this.intervalSec <= 0) {
      this.isPaused = true;
      this._notifyTick();
      return;
    }

    this._scheduleNextTick();
  }

  /**
   * Stops and tears down the timer.
   */
  stop() {
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._boundVisibilityHandler);
    }
  }

  /**
   * Pauses the countdown (e.g. when tab is hidden or auto-poll is disabled).
   */
  pause() {
    this.isPaused = true;
    if (this.state) {
      this.state.setState({ isPolling: false });
    }
    this._notifyTick();
  }

  /**
   * Resumes the countdown from where it left off or resets.
   */
  resume() {
    if (!this.isRunning) {
      this.start();
      return;
    }
    if (this.intervalSec <= 0) return;

    this.isPaused = false;
    if (this.state) {
      this.state.setState({ isPolling: true });
    }
    this._notifyTick();
  }

  /**
   * Updates the polling interval in seconds.
   * @param {number} sec
   */
  setIntervalSec(sec) {
    const parsed = typeof sec === 'number' ? sec : parseInt(sec, 10);
    this.intervalSec = isNaN(parsed) ? DEFAULT_POLLING_INTERVAL_SEC : Math.max(0, Math.min(120, parsed));
    this.countdownSeconds = this.intervalSec;

    if (this.intervalSec === 0) {
      this.pause();
    } else if (this.isPaused && this.isRunning) {
      this.resume();
    }

    this._notifyTick();
  }

  setInterval(sec) {
    this.setIntervalSec(sec);
  }

  updateInterval(sec) {
    this.setIntervalSec(sec);
  }

  /**
   * Resets the countdown timer back to the maximum interval.
   */
  resetCountdown() {
    this.countdownSeconds = this.intervalSec;
    this._notifyTick();
  }

  /**
   * Triggers a manual refresh with debouncing to avoid API hammering.
   * @returns {boolean} True if refresh triggered, false if debounced.
   */
  manualRefresh() {
    const now = Date.now();
    if (now - this.lastManualRefreshTime < this.debounceMs) {
      return false; // Debounced
    }

    this.lastManualRefreshTime = now;
    this.resetCountdown();

    try {
      this.onRefresh(true);
    } catch (err) {
      console.error('[PollingService] Error during manual refresh:', err);
    }

    return true;
  }

  /**
   * Internal tick runner.
   * @private
   */
  _scheduleNextTick() {
    if (!this.isRunning) return;

    this.timerId = setTimeout(() => {
      this._onTimerTick();
      if (this.isRunning) {
        this._scheduleNextTick();
      }
    }, 1000);
  }

  /**
   * Called on every 1-second interval.
   * @private
   */
  _onTimerTick() {
    if (this.isPaused || this.intervalSec <= 0) {
      this._notifyTick();
      return;
    }

    this.countdownSeconds -= 1;

    if (this.countdownSeconds <= 0) {
      this.countdownSeconds = this.intervalSec;
      this._notifyTick();

      try {
        this.onRefresh(false);
      } catch (err) {
        console.error('[PollingService] Error during auto-refresh callback:', err);
      }
    } else {
      this._notifyTick();
    }
  }

  /**
   * Notifies tick listeners and updates state.
   * @private
   */
  _notifyTick() {
    if (this.state) {
      this.state.setState({
        countdownSeconds: this.countdownSeconds,
        isPolling: !this.isPaused && this.intervalSec > 0
      });
    }

    if (typeof this.onTick === 'function') {
      try {
        this.onTick(this.countdownSeconds, this.isPaused || this.intervalSec <= 0);
      } catch {
        // Safe execution
      }
    }
  }

  /**
   * Handles Page Visibility API state changes.
   * @private
   */
  _handleVisibilityChange() {
    if (typeof document === 'undefined') return;

    if (document.visibilityState === 'hidden') {
      this.pause();
    } else if (document.visibilityState === 'visible') {
      this.resume();
      // Perform immediate sync when user returns to foreground
      this.manualRefresh();
    }
  }
}

export const pollingService = new PollingService();
export default pollingService;

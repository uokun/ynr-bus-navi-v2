/**
 * render-modal.js
 * 
 * 設定モーダル & 全時間帯時刻表モーダルのUI管理
 */

import { escapeHtml, formatTime, getRouteBadgeHtml, showToast } from './ui-helpers.js';
import { storageService as defaultStorageService } from '../services/storage-service.js';
import { odptClient } from '../api/odpt-client.js';
import { calendarService } from '../services/calendar-service.js';
import { STOP_PLATFORMS, STOP_DISPLAY_NAMES } from './render-stop-view.js';
import { state as globalState } from '../state.js';

export class ModalManager {
  constructor(options = {}) {
    this.options = options;
    this.storage = options.storageService || defaultStorageService;
    this.state = options.state || (typeof window !== 'undefined' && window.app?.state) || globalState;
    this.onSettingsSaved = options.onSettingsSaved || null;
    this.els = {};
    this.currentTimetableStop = 'yokodai';
    this.currentTimetablePole = '1';
    this.currentTimetableCal = 'Weekday';
  }

  init() {
    if (typeof document === 'undefined') return;
    this.bindDom();
    this.bindEvents();
  }

  queryAllSafe(selectors) {
    if (typeof document === 'undefined') return [];
    const list = [];
    const parts = selectors.split(',').map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.startsWith('#')) {
        const el = document.getElementById(part.slice(1));
        if (el && !list.includes(el)) list.push(el);
      } else {
        try {
          const found = document.querySelectorAll(part);
          if (found) {
            for (let i = 0; i < found.length; i++) {
              if (!list.includes(found[i])) list.push(found[i]);
            }
          }
        } catch {}
      }
    }
    return list;
  }

  getElSafe(...ids) {
    if (typeof document === 'undefined') return null;
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    return null;
  }

  bindDom() {
    this.els = {
      settingsModal: this.getElSafe('modal-settings', 'settings-modal'),
      settingsBackdrop: this.getElSafe('settings-modal-backdrop'),
      timetableModal: this.getElSafe('modal-timetable', 'timetable-modal'),
      timetableBackdrop: this.getElSafe('timetable-modal-backdrop'),
      
      btnOpenSettings: this.queryAllSafe('#btn-settings, #settings-btn, #header-settings-btn'),
      btnCloseSettings: this.queryAllSafe('#btn-close-settings, #settings-modal-close, #btn-cancel-settings'),
      btnSaveSettings: this.queryAllSafe('#btn-save-settings, #save-settings-btn, #btn-modal-save'),
      
      btnOpenTimetable: this.queryAllSafe('#timetable-btn, #tab-timetable-all, .btn-open-timetable, .btn-tt-open'),
      btnCloseTimetable: this.queryAllSafe('#btn-close-timetable, #timetable-modal-close'),
      
      inputBuffer: this.getElSafe('input-transfer-buffer', 'buffer-input', 'modal-input-buffer'),
      bufferDisplay: this.getElSafe('setting-buffer-display'),
      bufferPresetBtns: this.queryAllSafe('.setting-buffer-preset'),
      inputApiKey: this.getElSafe('input-api-key', 'api-key-input'),
      btnResetApiKey: this.getElSafe('btn-reset-api-key'),
      selectTheme: this.getElSafe('setting-theme-select'),
      selectPolling: this.getElSafe('setting-refresh-interval'),
      btnClearCache: this.getElSafe('btn-clear-cache'),
      
      // Timetable elements
      ttStopSelect: this.getElSafe('timetable-stop-select'),
      ttPoleSelect: this.getElSafe('timetable-pole-select'),
      ttCalBtns: this.queryAllSafe('.tt-cal-btn'),
      btnCalWeekday: this.getElSafe('btn-cal-weekday'),
      btnCalSaturday: this.getElSafe('btn-cal-saturday'),
      btnCalHoliday: this.getElSafe('btn-cal-holiday'),
      ttGridContainer: this.getElSafe('timetable-grid-container'),
      ttTbody: this.getElSafe('timetable-tbody')
    };
  }

  bindEvents() {
    // Open Settings
    this.els.btnOpenSettings?.forEach(btn => {
      btn.addEventListener('click', () => this.openSettings());
    });

    // Close Settings
    this.els.btnCloseSettings?.forEach(btn => {
      btn.addEventListener('click', () => this.closeSettings());
    });
    this.els.settingsBackdrop?.addEventListener('click', () => this.closeSettings());
    this.els.settingsModal?.addEventListener('click', (e) => {
      if (e.target === this.els.settingsModal) this.closeSettings();
    });

    // Open Timetable
    this.els.btnOpenTimetable?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const stopKey = e.currentTarget.dataset.stop || 'yokodai';
        this.openTimetable(stopKey);
      });
    });

    // Close Timetable
    this.els.btnCloseTimetable?.forEach(btn => {
      btn.addEventListener('click', () => this.closeTimetable());
    });
    this.els.timetableBackdrop?.addEventListener('click', () => this.closeTimetable());
    this.els.timetableModal?.addEventListener('click', (e) => {
      if (e.target === this.els.timetableModal) this.closeTimetable();
    });

    // Buffer Slider (if elements exist)
    const bufferInputs = this.queryAllSafe('#input-transfer-buffer, #buffer-input, #modal-input-buffer');
    bufferInputs.forEach(input => {
      input.addEventListener('input', (e) => {
        const val = e.target.value;
        const displays = this.queryAllSafe('#setting-buffer-display, #buffer-display-val');
        displays.forEach(d => d.textContent = `${val}分`);
        bufferInputs.forEach(inp => { if (inp !== input) inp.value = val; });
        this.updatePresetActive(parseInt(val, 10));
      });
    });

    // Buffer Preset Buttons (if elements exist)
    this.els.bufferPresetBtns?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const val = parseInt(e.target.dataset.buffer, 10);
        bufferInputs.forEach(inp => inp.value = val);
        const displays = this.queryAllSafe('#setting-buffer-display, #buffer-display-val');
        displays.forEach(d => d.textContent = `${val}分`);
        this.updatePresetActive(val);
      });
    });

    // Reset API key
    this.els.btnResetApiKey?.addEventListener('click', () => {
      const defKey = this.storage.resetApiKey ? this.storage.resetApiKey() : '';
      if (this.els.inputApiKey) this.els.inputApiKey.value = '';
      showToast('APIキーを消去しました', 'info');
    });

    // Clear Cache
    this.els.btnClearCache?.addEventListener('click', () => {
      if (this.storage.clearCache) this.storage.clearCache();
      showToast('キャッシュを消去しました', 'success');
    });

    // Save Settings
    this.els.btnSaveSettings?.forEach(btn => {
      btn.addEventListener('click', () => {
        this.saveSettings();
        this.closeSettings();
        showToast('設定を保存しました', 'success');
        if (typeof this.onSettingsSaved === 'function') {
          this.onSettingsSaved();
        }
        if (typeof window !== 'undefined' && window.app && typeof window.app.refreshData === 'function') {
          window.app.refreshData();
        }
      });
    });

    // Timetable Selectors
    this.els.ttStopSelect?.addEventListener('change', (e) => {
      this.currentTimetableStop = e.target.value;
      this.updateTimetablePoleOptions();
      this.populateSyncTimetable();
      this.renderTimetableGrid();
    });

    this.els.ttPoleSelect?.addEventListener('change', (e) => {
      this.currentTimetablePole = e.target.value;
      this.populateSyncTimetable();
      this.renderTimetableGrid();
    });

    this.els.ttCalBtns?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.els.ttCalBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentTimetableCal = e.currentTarget.getAttribute?.('data-cal') || e.currentTarget.dataset?.cal || 'Weekday';
        this.populateSyncTimetable();
        this.renderTimetableGrid();
      });
    });

    this.els.btnCalWeekday?.addEventListener('click', (e) => {
      this.els.ttCalBtns?.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      this.currentTimetableCal = 'Weekday';
      this.populateSyncTimetable();
      this.renderTimetableGrid();
    });
    this.els.btnCalSaturday?.addEventListener('click', (e) => {
      this.els.ttCalBtns?.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      this.currentTimetableCal = 'Saturday';
      this.populateSyncTimetable();
      this.renderTimetableGrid();
    });
    this.els.btnCalHoliday?.addEventListener('click', (e) => {
      this.els.ttCalBtns?.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      this.currentTimetableCal = 'Holiday';
      this.populateSyncTimetable();
      this.renderTimetableGrid();
    });
  }

  updatePresetActive(val) {
    this.els.bufferPresetBtns?.forEach(btn => {
      if (parseInt(btn.dataset.buffer, 10) === val) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  openSettings() {
    this.loadSettings();
    const modal = document.getElementById('settings-modal') || document.getElementById('modal-settings');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('active');
    } else if (typeof window !== 'undefined' && window.app && typeof window.app.switchTab === 'function') {
      window.app.switchTab('view-settings');
    }
  }

  closeSettings() {
    const modal = document.getElementById('settings-modal') || document.getElementById('modal-settings');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('active');
    }
  }

  saveSettings() {
    const bufferEl = document.getElementById('buffer-input') || document.getElementById('input-transfer-buffer');
    if (bufferEl && this.storage.setTransferBuffer) {
      const val = parseInt(bufferEl.value, 10) || 5;
      this.storage.setTransferBuffer(val);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('transfer_buffer_minutes', String(val));
      }
      if (this.state) {
        this.state.setState({ bufferMinutes: val });
      }
      const displays = this.queryAllSafe('#setting-buffer-display, #buffer-display-val');
      displays.forEach(d => d.textContent = `${val}分`);
      const tag = document.getElementById('transfer-buffer-tag');
      if (tag) tag.textContent = `バッファ ${val}分 確保`;
    }

    const apiKeyEl = document.getElementById('api-key-input') || document.getElementById('input-api-key');
    if (apiKeyEl && this.storage.setApiKey) {
      const key = apiKeyEl.value.trim();
      this.storage.setApiKey(key);
    }

    if (this.els.selectPolling && this.storage.setAutoRefreshInterval) {
      const interval = parseInt(this.els.selectPolling.value, 10);
      this.storage.setAutoRefreshInterval(interval);
      if (typeof window !== 'undefined' && window.app && window.app.polling) {
        window.app.polling.setInterval(interval);
      }
    }

    if (this.els.selectTheme && this.storage.setTheme) {
      const theme = this.els.selectTheme.value;
      this.storage.setTheme(theme);
      if (this.state) {
        this.state.setState({ theme });
      }
    }
  }

  loadSettings() {
    const buffer = this.storage.getTransferBuffer ? this.storage.getTransferBuffer() : 5;
    if (this.els.inputBuffer) this.els.inputBuffer.value = buffer;
    if (this.els.bufferDisplay) this.els.bufferDisplay.textContent = `${buffer}分`;
    this.updatePresetActive(buffer);

    if (this.els.inputApiKey && this.storage.getApiKey) {
      this.els.inputApiKey.value = this.storage.getApiKey() || '';
    }

    if (this.els.selectTheme && this.storage.getTheme) {
      this.els.selectTheme.value = this.storage.getTheme();
    }

    if (this.els.selectPolling && this.storage.getAutoRefreshInterval) {
      this.els.selectPolling.value = String(this.storage.getAutoRefreshInterval());
    }
  }

  applyTheme(theme) {
    if (typeof document === 'undefined') return;
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  // --- Timetable Modal ---

  openTimetable(stopKey = 'yokodai') {
    this.currentTimetableStop = stopKey || 'yokodai';
    if (this.els.ttStopSelect) this.els.ttStopSelect.value = this.currentTimetableStop;
    
    // Set default pole
    const platforms = STOP_PLATFORMS[this.currentTimetableStop] || [];
    this.currentTimetablePole = platforms[0]?.pole || '1';

    this.updateTimetablePoleOptions();

    // Set default calendar to current day type
    const todayCal = calendarService.getCalendarType(new Date());
    this.currentTimetableCal = todayCal;
    this.els.ttCalBtns?.forEach(btn => {
      if (btn.dataset.cal === todayCal) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const modal = document.getElementById('timetable-modal') || document.getElementById('modal-timetable');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('active');
    }

    this.populateSyncTimetable();
    this.renderTimetableGrid();
  }

  closeTimetable() {
    const modal = document.getElementById('timetable-modal') || document.getElementById('modal-timetable');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('active');
    }
  }

  populateSyncTimetable() {
    const tbodyEl = document.getElementById('timetable-tbody');
    if (!tbodyEl) return;

    const cal = this.currentTimetableCal || 'Weekday';
    const platforms = STOP_PLATFORMS[this.currentTimetableStop] || [];
    const matched = platforms.find(p => String(p.pole) === String(this.currentTimetablePole)) || platforms[0];
    const poleId = matched?.poleId || '';

    let ttList = [];
    if (this.currentTimetableData && Array.isArray(this.currentTimetableData)) {
      ttList = this.currentTimetableData;
    }

    if (!ttList || ttList.length === 0) {
      tbodyEl.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:24px; color:var(--text-muted);">時刻表データを読み込めませんでした（APIキーを設定してください）</td></tr>';
      return;
    }

    let syncRows = '';
    for (let h = 6; h <= 23; h++) {
      const items = ttList.filter(t => parseInt(t.departureTime.split(':')[0], 10) === h);
      const mins = items.map(t => `${t.departureTime.split(':')[1] || '00'}${t.line ? ` (${t.line.replace('系統','')})` : ''}`);
      syncRows += `<tr><td>${String(h).padStart(2, '0')}</td><td>${mins.join(' ') || '-'}</td></tr>`;
    }
    tbodyEl.innerHTML = syncRows;
  }

  updateTimetablePoleOptions() {
    if (!this.els.ttPoleSelect) return;
    const platforms = STOP_PLATFORMS[this.currentTimetableStop] || [];
    this.els.ttPoleSelect.innerHTML = platforms.map(p => `
      <option value="${p.pole}" ${String(p.pole) === String(this.currentTimetablePole) ? 'selected' : ''}>
        ${escapeHtml(p.label)}
      </option>
    `).join('');
  }

  async renderTimetableGrid() {
    try {
      const platforms = STOP_PLATFORMS[this.currentTimetableStop] || [];
      const matched = platforms.find(p => String(p.pole) === String(this.currentTimetablePole)) || platforms[0];
      const poleId = matched?.poleId || '7800.1';

      let tt = await odptClient.fetchBusstopPoleTimetables(poleId, this.currentTimetableCal);

      if (!tt || tt.length === 0) {
        if (this.els.ttTbody) {
          this.els.ttTbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:24px; color:var(--status-urgent);">時刻表データを読み込めませんでした</td></tr>';
        }
        return;
      }

      // Group by Hour (5 to 24)
      const hourMap = {};
      for (let h = 5; h <= 24; h++) {
        hourMap[h] = [];
      }

      tt.forEach(item => {
        if (!item.departureTime) return;
        const [hStr, mStr] = item.departureTime.split(':');
        const h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        if (!isNaN(h) && hourMap[h]) {
          hourMap[h].push({
            minute: m,
            minStr: mStr,
            line: item.line,
            dest: item.destination,
            raw: item
          });
        }
      });

      Object.keys(hourMap).forEach(h => {
        hourMap[h].sort((a, b) => a.minute - b.minute);
      });

      let gridRowsHtml = '';
      let tbodyRowsHtml = '';

      for (let h = 5; h <= 24; h++) {
        const departures = hourMap[h];
        if (departures.length === 0 && (h < 6 || h > 23)) continue;

        const depBadges = departures.map(d => `
          <span class="tt-minute-chip" title="${escapeHtml(d.line)} ${escapeHtml(d.dest)}">
            <span class="tt-min-num">${escapeHtml(d.minStr)}</span>
            <span class="tt-min-dest">${escapeHtml(d.dest ? d.dest.replace(/駅前|行/g, '') : '')}</span>
          </span>
        `).join('');

        gridRowsHtml += `
          <div class="tt-grid-row">
            <div class="tt-hour-col">${String(h).padStart(2, '0')}</div>
            <div class="tt-minutes-col">
              ${depBadges || '<span class="tt-no-service">-</span>'}
            </div>
          </div>
        `;

        tbodyRowsHtml += `
          <tr>
            <td>${String(h).padStart(2, '0')}</td>
            <td>${departures.map(d => `${d.minStr}${d.line ? ` (${d.line.replace('系統','')})` : ''}`).join(' ') || '-'}</td>
          </tr>
        `;
      }

      if (this.els.ttGridContainer) {
        this.els.ttGridContainer.innerHTML = `
          <div class="tt-grid-table">
            ${gridRowsHtml}
          </div>
          <table style="display:none;" class="semantic-tt-table">
            <tbody id="timetable-tbody">
              ${tbodyRowsHtml}
            </tbody>
          </table>
        `;
      }

      const tbodyEl = document.getElementById('timetable-tbody');
      if (tbodyEl && tbodyRowsHtml) {
        tbodyEl.innerHTML = tbodyRowsHtml;
      }

    } catch (err) {
      console.error('[ModalManager] renderTimetableGrid error:', err);
    }
  }
}

export const modalManager = new ModalManager();
export function initModals(options = {}) {
  const manager = new ModalManager(options);
  manager.init();
  return manager;
}
export default modalManager;

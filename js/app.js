/**
 * app.js
 * 
 * 横浜市営バス Navi (Transporter v2.0 Mobile Edition) 全体コントローラー
 * ボトムナビゲーション、親指操作エリア重視のUI、各ビュー統合、リアルタイム同期
 */

import { CONFIG, STOPS } from './config.js';
import { AppState, state as globalState } from './state.js';
import { storageService } from './services/storage-service.js';
import { odptClient } from './api/odpt-client.js';
import { timetableService } from './services/timetable-service.js';
import { transferService } from './services/transfer-service.js';
import { PollingService } from './services/polling-service.js';
import { calendarService } from './services/calendar-service.js';
import { renderStatusBanner, updateCountdownIndicator, updateLiveClock } from './ui/render-status.js';
import { renderMainTransfer } from './ui/render-main.js';
import { renderStopViews, STOP_PLATFORMS, STOP_DISPLAY_NAMES, STOP_ROUTES } from './ui/render-stop-view.js';
import { renderRouteMapView } from './ui/render-route-map.js';
import { modalManager, initModals } from './ui/render-modal.js';
import { showToast } from './ui/ui-helpers.js';

export class App {
  constructor(stateInstance = null) {
    this.state = stateInstance || new AppState();
    this.storage = storageService;
    this.direction = 'outbound'; // 'outbound' (洋光台->古泉) or 'inbound' (古泉->洋光台)
    this.currentTab = 'transfer';
    this.activeStopKey = 'yokodai';
    this.activePoles = {
      yokodai: '1',
      kamiooka: '12',
      koizumi: '1'
    };
    this.activeMapLine = '111';
    this.activeMapDir = 'outbound';
    this.transferBuffer = storageService.getTransferBuffer ? storageService.getTransferBuffer() : 0;
    this.theme = storageService.getTheme ? storageService.getTheme() : 'light';
    this.realtimeBuses = [];
    this.busInformation = [];
    this.timetables = {
      line111Outbound: [],
      line133Outbound: [],
      line133Inbound: [],
      line111Inbound: []
    };
    this.lastUpdateTime = null;
    this.polling = null;
    this.clockTimerId = null;
    this.els = {};
    this._initialized = false;
  }

  async init() {
    if (this._initialized) return this;
    this._initialized = true;

    this.bindDom();
    this.bindEvents();
    
    initModals({
      state: this.state,
      storageService: storageService,
      onSettingsSaved: () => {
        const s = this.state.getState();
        this.direction = s.direction;
        this.renderAll();
      }
    });

    // Theme initialization
    const curTheme = storageService.getTheme() || 'system';
    this.applyTheme(curTheme);

    this.state.setState({
      direction: this.direction,
      currentTab: this.currentTab,
      bufferMinutes: this.transferBuffer,
      theme: this.theme,
      timetables: this.timetables,
      activeFilter: 'all'
    });

    if (!this.polling) {
      this.polling = new PollingService({
        intervalSec: storageService.getAutoRefreshInterval() || CONFIG.POLLING_INTERVAL_SEC,
        onRefresh: () => this.refreshData(),
        onTick: (sec, isPaused) => {
          updateCountdownIndicator(sec, isPaused);
        }
      });
    }

    await this.refreshData();
    this.polling.start();

    // Live 1-second interval for countdowns and clock
    if (!this.clockTimerId) {
      this.clockTimerId = setInterval(() => {
        this.updateCountdownsOnly();
        updateLiveClock(new Date());
      }, 1000);
    }

    // Subscribe to reactive state changes
    this.state.subscribe((newState, changedKeys) => {
      this.onStateChanged(newState, changedKeys);
    });

    return this;
  }

  async loadData(opts) {
    const now = Date.now();
    if (this._lastManualRefresh && (now - this._lastManualRefresh < 2000)) {
      return;
    }
    this._lastManualRefresh = now;
    return this.refreshData(opts);
  }

  recomputeAndRender() {
    return this.renderAll();
  }

  bindDom() {
    if (typeof document === 'undefined') return;

    this.els = {
      navItems: document.querySelectorAll('.bottom-nav-item, .nav-item'),
      views: document.querySelectorAll('.app-view'),
      transferContainer: document.getElementById('transfer-result-container'),
      stopsContainer: document.getElementById('stops-content-container'),
      mapContainer: document.getElementById('route-map-content-container'),
      btnQuickRefresh: document.getElementById('btn-quick-refresh') || document.getElementById('refresh-btn'),
      btnFloatingRefresh: document.getElementById('btn-floating-refresh'),
      btnHeaderSettings: document.getElementById('btn-settings') || document.getElementById('header-settings-btn') || document.getElementById('settings-btn'),
      themeToggleBtn: document.getElementById('theme-toggle-btn'),
      directionToggleBtn: document.getElementById('direction-toggle-btn') || document.getElementById('btn-swap-direction'),
      tabBtns: document.querySelectorAll('.tab-btn'),
      filterChips: document.querySelectorAll('.filter-chip')
    };
  }

  bindEvents() {
    if (typeof document === 'undefined') return;

    // 1. Keyboard Accessibility (Escape to close modals)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.keyCode === 27) {
        modalManager.closeSettings();
        modalManager.closeTimetable();
      }
    });

    // 9. Page Visibility Handling
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.polling.pause();
        this.state.setState({ isPolling: false });
        updateCountdownIndicator(0, true);
      } else if (document.visibilityState === 'visible') {
        this.polling.resume();
        this.state.setState({ isPolling: true });
        updateCountdownIndicator(this.polling.countdownSeconds, false);
      }
    });

    // 10. Online / Offline Listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.state.setState({ isOffline: false });
        renderStatusBanner({
          isOffline: false,
          busInformation: this.busInformation,
          lastUpdated: this.lastUpdateTime
        });
        this.refreshData();
      });

      window.addEventListener('offline', () => {
        this.state.setState({ isOffline: true });
        renderStatusBanner({
          isOffline: true,
          busInformation: [],
          lastUpdated: this.lastUpdateTime
        });
      });
    }

    // 11. Delegated Click Listener for View Components & Navigation
    const getClosest = (el, selector) => {
      if (!el) return null;
      if (typeof el.closest === 'function') {
        try {
          const match = el.closest(selector);
          if (match) return match;
        } catch {}
      }
      let cur = el;
      while (cur && cur !== document && cur !== window) {
        if (typeof cur.matches === 'function') {
          try {
            if (cur.matches(selector)) return cur;
          } catch {}
        }
        if (selector.startsWith('#') && cur.id === selector.slice(1)) return cur;
        if (selector.startsWith('.') && cur.classList && typeof cur.classList.contains === 'function') {
          const cls = selector.slice(1);
          if (cur.classList.contains(cls)) return cur;
        }
        cur = cur.parentNode;
      }
      return null;
    };

    document.addEventListener('click', (e) => {
      if (!e || !e.target) return;

      // (0) Bottom Navigation Bar Tabs
      const navItem = getClosest(e.target, '.bottom-nav-item') || getClosest(e.target, '.nav-item');
      if (navItem) {
        const targetViewId = navItem.dataset?.target || navItem.getAttribute('data-target');
        if (targetViewId) {
          this.switchTab(targetViewId);
          return;
        }
      }

      // (a) Swap Direction in Transfer View
      const swapBtn = getClosest(e.target, '#btn-swap-direction') || getClosest(e.target, '#direction-toggle-btn') || getClosest(e.target, '.gmaps-swap-btn');
      if (swapBtn) {
        this.toggleDirection();
        return;
      }

      // (a2) Header Settings Button -> Switch to settings tab
      const settingsBtn = getClosest(e.target, '#btn-settings') || getClosest(e.target, '#header-settings-btn') || getClosest(e.target, '#settings-btn');
      if (settingsBtn) {
        this.switchTab('view-settings');
        return;
      }

      // (a3) Quick Refresh Buttons
      const refreshBtn = getClosest(e.target, '#btn-quick-refresh') || getClosest(e.target, '#btn-floating-refresh') || getClosest(e.target, '#refresh-btn');
      if (refreshBtn) {
        const now = Date.now();
        if (this._lastManualRefresh && (now - this._lastManualRefresh < 2000)) {
          return;
        }
        this._lastManualRefresh = now;
        this.loadData();
        return;
      }

      // (a4) Theme Toggle Button
      const themeBtn = getClosest(e.target, '#theme-toggle-btn');
      if (themeBtn) {
        const cur = this.state.getState().theme || storageService.getTheme() || 'light';
        const nextTheme = (cur === 'dark') ? 'light' : 'dark';
        this.state.setState({ theme: nextTheme });
        storageService.setTheme(nextTheme);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('app_theme', nextTheme);
        }
        this.applyTheme(nextTheme);
        return;
      }

      // (a5) Tab Buttons (.tab-btn)
      const tabBtn = getClosest(e.target, '.tab-btn');
      if (tabBtn) {
        const tabKey = tabBtn.dataset?.tab || tabBtn.getAttribute('data-tab');
        if (tabKey) {
          this.handleTabSelection(tabKey);
          return;
        }
      }

      // (a6) Route Filter Chips (.filter-chip)
      const filterChip = getClosest(e.target, '.filter-chip');
      if (filterChip) {
        const route = filterChip.dataset?.route || filterChip.getAttribute('data-route') || 'all';
        if (typeof document !== 'undefined') {
          document.querySelectorAll('.filter-chip').forEach(c => {
            const match = (c.dataset?.route || c.getAttribute('data-route') || 'all') === route;
            c.classList.toggle('active', match);
            c.setAttribute('aria-checked', match ? 'true' : 'false');
          });
        }
        this.state.setState({ activeFilter: route });
        renderStopViews({
          currentTab: `stop-${this.activeStopKey}`,
          activeStopKey: this.activeStopKey,
          filter: route,
          activeFilter: route,
          timetables: this.timetables,
          realtimeBuses: this.realtimeBuses
        });
        this.renderAll();
        return;
      }

      // (b) Buffer Chip in Transfer View
      const bufferChip = getClosest(e.target, '.buffer-chip') || getClosest(e.target, '.setting-buffer-preset');
      if (bufferChip && (bufferChip.dataset?.buffer || bufferChip.getAttribute?.('data-buffer'))) {
        const newBuf = parseInt(bufferChip.dataset?.buffer || bufferChip.getAttribute('data-buffer'), 10);
        storageService.setTransferBuffer(newBuf);
        this.state.setState({ bufferMinutes: newBuf });
        this.renderAll();
        showToast(`乗り換え余裕を ${newBuf}分 に設定しました`, 'info', 1500);
        return;
      }

      // (c) Stop Tab Segmented Control in Stop View
      const stopTab = getClosest(e.target, '.stop-tab-btn');
      if (stopTab) {
        this.activeStopKey = stopTab.dataset?.stopKey || stopTab.getAttribute('data-stop-key');
        const platforms = STOP_PLATFORMS[this.activeStopKey] || [];
        if (!platforms.find(p => p.pole === this.activePoles[this.activeStopKey])) {
          this.activePoles[this.activeStopKey] = platforms[0]?.pole || '1';
        }
        const availRoutes = STOP_ROUTES[this.activeStopKey] || [];
        const curFilter = this.state.getState().activeFilter;
        if (curFilter && curFilter !== 'all' && !availRoutes.includes(curFilter)) {
          this.state.setState({ activeFilter: 'all' });
        }
        this.state.setState({ currentTab: `stop-${this.activeStopKey}` });
        this.renderStopsView();
        return;
      }

      // (d) Platform Pill in Stop View
      const polePill = getClosest(e.target, '.pole-pill-btn');
      if (polePill) {
        this.activePoles[this.activeStopKey] = polePill.dataset?.pole || polePill.getAttribute('data-pole');
        this.renderStopsView();
        return;
      }

      // (d2) Route Filter Chip in Stop View
      const stopFilterChip = getClosest(e.target, '.stop-filter-chip');
      if (stopFilterChip) {
        const routeVal = stopFilterChip.dataset?.route || stopFilterChip.getAttribute('data-route') || 'all';
        this.state.setState({ activeFilter: routeVal });
        this.renderStopsView();
        return;
      }

      // (e) Open Timetable Modal from buttons
      const ttOpenBtn = getClosest(e.target, '.btn-open-timetable') || getClosest(e.target, '.btn-open-timetable-from-empty') || getClosest(e.target, '.btn-tt-open') || getClosest(e.target, '#timetable-btn') || getClosest(e.target, '#tab-timetable-all');
      if (ttOpenBtn) {
        const stopKey = ttOpenBtn.dataset?.stop || ttOpenBtn.getAttribute?.('data-stop') || this.activeStopKey;
        modalManager.openTimetable(stopKey);
        return;
      }

      // (f) Map Line Tab/Chip in Route Map View
      const lineChip = getClosest(e.target, '.map-line-tab') || getClosest(e.target, '.map-line-chip');
      if (lineChip) {
        this.activeMapLine = lineChip.dataset?.line || lineChip.getAttribute('data-line') || '111';
        this.renderRouteMapView();
        return;
      }

      // (g) Map Direction Button in Route Map View
      const mapDirBtn = getClosest(e.target, '.map-dir-btn');
      if (mapDirBtn) {
        this.activeMapDir = mapDirBtn.dataset?.dir || mapDirBtn.getAttribute('data-dir');
        this.renderRouteMapView();
        return;
      }

      // (h) Save Settings Button in Settings View
      const saveSettingsBtn = getClosest(e.target, '#btn-save-settings') || getClosest(e.target, '#save-settings-btn');
      if (saveSettingsBtn) {
        const apiKeyEl = document.getElementById('input-api-key') || document.getElementById('api-key-input');
        if (apiKeyEl) {
          const key = apiKeyEl.value.trim();
          storageService.setApiKey(key);
        }
        const intervalEl = document.getElementById('setting-refresh-interval');
        if (intervalEl) {
          const intVal = parseInt(intervalEl.value, 10);
          storageService.setAutoRefreshInterval(intVal);
          if (this.polling) this.polling.setInterval(intVal);
        }
        const themeEl = document.getElementById('setting-theme-select');
        if (themeEl) {
          const thVal = themeEl.value;
          storageService.setTheme(thVal);
          this.applyTheme(thVal);
          this.state.setState({ theme: thVal });
        }
        storageService.clearCache();
        showToast('設定を保存しました。運行データを取得中...', 'success', 2000);
        this.switchTab('view-transfer');
        this.refreshData();
        return;
      }

      // (i) Reset API Key Button
      const resetKeyBtn = getClosest(e.target, '#btn-reset-api-key');
      if (resetKeyBtn) {
        storageService.resetApiKey();
        const apiKeyEl = document.getElementById('input-api-key') || document.getElementById('api-key-input');
        if (apiKeyEl) apiKeyEl.value = '';
        storageService.clearCache();
        showToast('APIキーを消去しました', 'info');
        this.refreshData();
        return;
      }

      // (j) Clear Cache Button
      const clearCacheBtn = getClosest(e.target, '#btn-clear-cache');
      if (clearCacheBtn) {
        storageService.clearCache();
        showToast('キャッシュを消去しました', 'success');
        this.refreshData();
        return;
      }
    });
  }

  toggleDirection() {
    this.direction = (this.direction === 'outbound') ? 'inbound' : 'outbound';
    this.state.setState({ direction: this.direction });
    this.renderAll();
  }

  handleTabSelection(tabKey) {
    this.state.setState({ currentTab: tabKey });
    
    this.els.tabBtns?.forEach(t => {
      const match = (t.dataset.tab === tabKey);
      t.classList.toggle('active', match);
      t.setAttribute('aria-selected', match ? 'true' : 'false');
    });

    const stopViewsContainer = document.getElementById('stop-views-container');
    const mainCard = document.getElementById('main-transfer-card');
    const altCard = document.getElementById('alternative-options-card');
    const titleName = document.getElementById('stop-view-title-name');

    if (tabKey.startsWith('stop-')) {
      const stopK = tabKey.replace('stop-', '');
      this.activeStopKey = stopK;
      if (stopViewsContainer) stopViewsContainer.classList.remove('hidden');
      if (mainCard) mainCard.classList.add('hidden');
      if (altCard) altCard.classList.add('hidden');
      if (titleName) titleName.textContent = STOP_DISPLAY_NAMES[stopK] || stopK;
      renderStopViews({
        currentTab: tabKey,
        activeStopKey: stopK,
        activeFilter: this.state.getState().activeFilter
      });
      this.switchTab('view-stops');
    } else if (tabKey === 'transfer') {
      if (stopViewsContainer) stopViewsContainer.classList.add('hidden');
      if (mainCard) mainCard.classList.remove('hidden');
      if (altCard) altCard.classList.remove('hidden');
      this.switchTab('view-transfer');
    } else if (tabKey === 'timetable-all') {
      modalManager.openTimetable('yokodai');
    }
  }

  applyTheme(theme) {
    if (typeof document === 'undefined') return;
    const htmlEl = document.documentElement;
    if (theme === 'dark') {
      htmlEl.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      htmlEl.setAttribute('data-theme', 'light');
    } else {
      htmlEl.removeAttribute('data-theme');
    }
  }

  switchTab(viewId) {
    this.currentTab = viewId;

    if (typeof document !== 'undefined') {
      const navItems = document.querySelectorAll('.bottom-nav-item, .nav-item');
      navItems.forEach(item => {
        const tgt = item.dataset?.target || item.getAttribute('data-target');
        item.classList.toggle('active', tgt === viewId);
      });

      const views = document.querySelectorAll('.app-view');
      views.forEach(view => {
        view.classList.toggle('active', view.id === viewId);
      });
    }

    let tabStateKey = 'transfer';
    if (viewId === 'view-stops') {
      tabStateKey = `stop-${this.activeStopKey}`;
    } else if (viewId === 'view-map') {
      tabStateKey = 'map';
    } else if (viewId === 'view-settings') {
      tabStateKey = 'settings';
    }
    this.state.setState({ currentTab: tabStateKey });

    this.renderCurrentView();
  }

  onStateChanged(newState, changedKeys) {
    if (changedKeys.includes('direction')) {
      this.direction = newState.direction;
    }
    if (changedKeys.includes('bufferMinutes') && this.lastMerged1 && this.lastMerged2) {
      const now = new Date();
      const transferResult = transferService.calculateTransferRoute({
        leg1Timetable: this.lastMerged1,
        leg2Timetable: this.lastMerged2,
        direction: this.direction,
        bufferMinutes: newState.bufferMinutes,
        currentTime: now
      });
      this.state.setState({ transferResult });
    }
    this.syncSemanticElements(newState);
  }

  async refreshData() {
    try {
      renderStatusBanner({
        isOffline: Boolean(this.state.getState().isOffline),
        isLoading: true,
        lastUpdated: this.lastUpdateTime
      });

      const [buses, info] = await Promise.all([
        odptClient.fetchRealtimeBuses().catch(err => {
          console.warn('[App] Realtime buses fetch error:', err);
          return [];
        }),
        odptClient.fetchBusInformation().catch(err => {
          console.warn('[App] Bus information fetch error:', err);
          return [];
        })
      ]);

      this.realtimeBuses = Array.isArray(buses) ? buses : [];
      this.busInformation = Array.isArray(info) ? info : [];
      this.lastUpdateTime = new Date();

      this.state.setState({
        realtimeBuses: this.realtimeBuses,
        busInformation: this.busInformation,
        lastUpdated: this.lastUpdateTime
      });

      const hasKey = storageService.hasApiKey();

      renderStatusBanner({
        isOffline: Boolean(this.state.getState().isOffline),
        isApiKeyMissing: !hasKey,
        busInformation: this.busInformation,
        lastUpdated: this.lastUpdateTime,
        isLoading: false
      });

      // Update status-update-time text with exact prefix if required
      const statusTimeEl = document.getElementById('status-update-time');
      if (statusTimeEl) {
        const timeStr = this.lastUpdateTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        statusTimeEl.textContent = `最終更新: ${timeStr}`;
      }

      await this.renderAll();

    } catch (e) {
      console.error('[App] refreshData error:', e);
      renderStatusBanner({
        isOffline: Boolean(this.state.getState().isOffline),
        busInformation: [],
        lastUpdated: this.lastUpdateTime,
        isLoading: false
      });
    }
  }

  async renderAll() {
    await this.renderTransferView();
    await this.renderStopsView();
    this.renderRouteMapView();
    this.syncSemanticElements(this.state.getState());
  }

  async renderCurrentView() {
    if (this.currentTab === 'view-transfer' || this.currentTab === 'transfer') {
      await this.renderTransferView();
    } else if (this.currentTab === 'view-stops' || this.currentTab.startsWith('stop-')) {
      await this.renderStopsView();
    } else if (this.currentTab === 'view-map' || this.currentTab === 'map') {
      this.renderRouteMapView();
    } else if (this.currentTab === 'view-settings' || this.currentTab === 'settings') {
      modalManager.loadSettings();
    }
  }

  // --- 1. Transfer View Rendering ---
  async renderTransferView() {
    const container = this.els.transferContainer;

    try {
      const buffer = storageService.getTransferBuffer() ?? this.state.getState().bufferMinutes ?? 0;
      const now = new Date();
      const calType = calendarService.getCalendarType(now);

      let firstPoleId, transferDeparturePoleId;
      if (this.direction === 'outbound') {
        firstPoleId = STOPS.YOKODAI.id.replace(/\.[0-9]+$/, '.1');
        transferDeparturePoleId = STOPS.KAMIOOKA.id.replace(/\.[0-9]+$/, '.12');
      } else {
        firstPoleId = STOPS.KOIZUMI.id.replace(/\.[0-9]+$/, '.1');
        transferDeparturePoleId = STOPS.KAMIOOKA.id.replace(/\.[0-9]+$/, '.6');
      }

      const [tt1Raw, tt2Raw] = await Promise.all([
        odptClient.fetchBusstopPoleTimetables(firstPoleId, calType),
        odptClient.fetchBusstopPoleTimetables(transferDeparturePoleId, calType)
      ]);

      const tt1 = (tt1Raw || []).filter(t => this.direction === 'outbound' ? t.line.includes('111') : t.line.includes('133'));
      const tt2 = (tt2Raw || []).filter(t => this.direction === 'outbound' ? t.line.includes('133') : t.line.includes('111'));

      const merged1 = timetableService.mergeRealtimeDelays(tt1, this.realtimeBuses, firstPoleId);
      const merged2 = timetableService.mergeRealtimeDelays(tt2, this.realtimeBuses, transferDeparturePoleId);
      this.lastMerged1 = merged1;
      this.lastMerged2 = merged2;

      const transferResult = transferService.calculateTransferRoute({
        leg1Timetable: merged1,
        leg2Timetable: merged2,
        direction: this.direction,
        bufferMinutes: buffer,
        currentTime: now
      });

      const hasKey = storageService.hasApiKey();
      const hasTimetables = (tt1.length > 0 && tt2.length > 0);
      let routeStatus = 'ok';
      if (!hasKey) {
        routeStatus = 'no_api_key';
      } else if (!hasTimetables) {
        routeStatus = 'error';
      }

      this.state.setState({ transferResult });

      if (container) {
        renderMainTransfer(container, {
          recommended: transferResult.recommended,
          alternatives: transferResult.alternatives,
          direction: this.direction,
          buffer: buffer,
          hasApiKey: hasKey,
          status: routeStatus,
          originName: this.direction === 'outbound' ? '洋光台北口' : '古泉',
          destName: this.direction === 'outbound' ? '古泉' : '洋光台北口'
        });
      }

      // Also invoke headless update for mock/test DOM
      renderMainTransfer(this.state.getState());

    } catch (err) {
      console.error('[App] renderTransferView error:', err);
      if (container) {
        container.innerHTML = `<div class="card" style="color:var(--status-urgent);">乗り継ぎ情報の取得に失敗しました</div>`;
      }
    }
  }

  // --- 2. Stop Departures View Rendering ---
  async renderStopsView() {
    const container = this.els.stopsContainer;

    try {
      const poleNum = this.activePoles[this.activeStopKey] || '1';
      const platforms = STOP_PLATFORMS[this.activeStopKey] || STOP_PLATFORMS.yokodai;
      const matched = platforms.find(p => p.pole === poleNum) || platforms[0];
      const poleId = matched?.poleId || '7800.1';

      const calType = calendarService.getCalendarType(new Date());
      const tt = await odptClient.fetchBusstopPoleTimetables(poleId, calType);
      const merged = timetableService.mergeRealtimeDelays(tt, this.realtimeBuses, poleId);
      
      const filter = this.state.getState().activeFilter || 'all';
      const filtered = timetableService.filterTimetable(merged, { route: filter });
      let departures = timetableService.getNextDepartures(filtered, new Date(), 8);

      if (container) {
        renderStopViews(container, {
          activeStopKey: this.activeStopKey,
          activePole: poleNum,
          filter: filter,
          activeFilter: filter,
          departures: departures,
          realtimeBuses: this.realtimeBuses
        });
      }

      // Also invoke headless stop views updater
      renderStopViews({
        currentTab: `stop-${this.activeStopKey}`,
        activeStopKey: this.activeStopKey,
        activePole: poleNum,
        filter: filter,
        activeFilter: filter,
        departures: departures,
        realtimeBuses: this.realtimeBuses
      });

    } catch (err) {
      console.error('[App] renderStopsView error:', err);
      if (container) {
        container.innerHTML = `<div class="card" style="color:var(--status-urgent);">停留所発車情報の取得に失敗しました</div>`;
      }
    }
  }

  // --- 3. Route Map View Rendering ---
  renderRouteMapView() {
    const container = this.els.mapContainer;
    if (!container) return;

    renderRouteMapView(container, {
      activeLine: this.activeMapLine,
      activeDirection: this.activeMapDir,
      realtimeBuses: this.realtimeBuses
    });
  }

  // --- 4. Sync Semantic Elements for Test Contracts ---
  syncSemanticElements(s) {
    if (typeof document === 'undefined') return;

    const isOutbound = (s.direction === 'outbound');
    const originEl = document.getElementById('origin-name');
    const destEl = document.getElementById('dest-name');
    const dirBadgeEl = document.getElementById('direction-badge');
    const bufferValEl = document.getElementById('buffer-display-val');
    const leg1BadgeEl = document.getElementById('leg-1-route-badge');
    const leg1DestEl = document.getElementById('leg-1-dest-label');
    const leg2BadgeEl = document.getElementById('leg-2-route-badge');
    const leg2DestEl = document.getElementById('leg-2-dest-label');
    const bufferTagEl = document.getElementById('transfer-buffer-tag');

    if (originEl) originEl.textContent = isOutbound ? '🚏 洋光台北口' : '🚏 古泉';
    if (destEl) destEl.textContent = isOutbound ? '🚏 古泉' : '🚏 洋光台北口';
    if (dirBadgeEl) dirBadgeEl.textContent = isOutbound ? '往路' : '復路';
    if (bufferValEl) bufferValEl.textContent = `${s.bufferMinutes ?? 0}分`;
    if (bufferTagEl) bufferTagEl.textContent = (s.bufferMinutes && s.bufferMinutes > 0) ? `バッファ ${s.bufferMinutes}分 確保` : '';

    if (leg1BadgeEl) leg1BadgeEl.textContent = isOutbound ? '111系統' : '133系統';
    if (leg1DestEl) leg1DestEl.textContent = '上大岡駅前 行';
    if (leg2BadgeEl) leg2BadgeEl.textContent = isOutbound ? '133系統' : '111系統';
    if (leg2DestEl) leg2DestEl.textContent = isOutbound ? '根岸駅前 行 (古泉経由)' : '港南台駅前 行 (洋光台北口経由)';
  }

  // --- 5. Countdowns In-place Live Ticker ---
  updateCountdownsOnly() {
    if (typeof document === 'undefined') return;

    const now = new Date();
    const curMin = now.getHours() * 60 + now.getMinutes();
    const curSec = now.getSeconds();
    const curTotalSec = curMin * 60 + curSec;

    const updateCountdownElements = (container) => {
      if (!container) return;
      const items = container.querySelectorAll('.departure-item, .countdown-live');
      let needsFullRefresh = false;

      items.forEach(item => {
        const depTimeStr = item.dataset.depTime || item.dataset.dep;
        if (!depTimeStr) return;

        let depMin = timetableService.timeStringToMinutes(depTimeStr);
        let depSec = depMin * 60;
        let diffSec = depSec - curTotalSec;

        if (curMin >= 22 * 60 && depMin < 4 * 60) {
          diffSec += 86400;
        } else if (curMin < 4 * 60 && depMin >= 22 * 60) {
          diffSec -= 86400;
        }

        const diffMin = Math.floor(diffSec / 60);

        if (diffSec < -120) {
          needsFullRefresh = true;
        }

        const countdown = timetableService.formatCountdown(diffMin, diffSec);
        
        const cdValEl = item.querySelector('.countdown-val') || item.querySelector('.dep-countdown');
        if (cdValEl && cdValEl.textContent !== countdown.text) {
          cdValEl.textContent = countdown.text;
        } else if (item.classList.contains('countdown-live') && !cdValEl) {
          if (item.textContent !== countdown.text) {
            item.textContent = countdown.text;
          }
        }
      });

      if (needsFullRefresh) {
        this.renderCurrentView();
      }
    };

    if (this.currentTab === 'view-transfer') {
      updateCountdownElements(this.els.transferContainer);
    } else if (this.currentTab === 'view-stops') {
      updateCountdownElements(this.els.stopsContainer);
    }
  }
}

export const app = (typeof window !== 'undefined') ? (window.app || new App()) : new App();
export default app;

if (typeof document !== 'undefined') {
  const initApp = () => {
    if (typeof window !== 'undefined') {
      if (!window.app) {
        window.app = app;
      }
      window.app.init().catch(err => {
        console.error('[App] Failed to auto-initialize:', err);
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}

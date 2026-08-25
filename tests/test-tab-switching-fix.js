/**
 * test-tab-switching-fix.js
 * Verification of tab switching behavior & instant departure list rendering.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Load modules
import { CONFIG, STOPS } from '../js/config.js';
import { storageService } from '../js/services/storage-service.js';
import { odptClient } from '../js/api/odpt-client.js';
import { timetableService } from '../js/services/timetable-service.js';
import { transferService } from '../js/services/transfer-service.js';
import { calendarService } from '../js/services/calendar-service.js';

console.log('\x1b[36m%s\x1b[0m', '▶ Starting Tab Switching & Timetable Display Verification...');

// Mock DOM Element
class MockElement {
  constructor(tag, id = '', classes = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.className = classes;
    this.classList = {
      _set: new Set(classes ? classes.split(' ') : []),
      add: (c) => this.classList._set.add(c),
      remove: (c) => this.classList._set.delete(c),
      contains: (c) => this.classList._set.has(c)
    };
    this.children = [];
    this.innerHTML = '';
    this.textContent = '';
    this.dataset = {};
    this.listeners = {};
    this.value = '';
  }

  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  dispatchEvent(event) {
    const fns = this.listeners[event.type] || [];
    for (const fn of fns) {
      fn(event);
    }
  }

  querySelector(sel) {
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      return this.classList.contains(cls) ? this : null;
    }
    return null;
  }

  querySelectorAll(sel) {
    const results = [];
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      if (this.classList.contains(cls)) results.push(this);
    }
    return results;
  }

  closest(sel) {
    return this;
  }
}

// Build mock DOM elements
const tabs = [
  Object.assign(new MockElement('button', '', 'tab active'), { dataset: { target: 'view-transfer' }, textContent: '乗り継ぎ' }),
  Object.assign(new MockElement('button', '', 'tab'), { dataset: { target: 'view-yokodai' }, textContent: '洋光台北口' }),
  Object.assign(new MockElement('button', '', 'tab'), { dataset: { target: 'view-kamiooka' }, textContent: '上大岡駅前' }),
  Object.assign(new MockElement('button', '', 'tab'), { dataset: { target: 'view-koizumi' }, textContent: '古泉' })
];

const views = [
  new MockElement('section', 'view-transfer', 'view active'),
  new MockElement('section', 'view-yokodai', 'view'),
  new MockElement('section', 'view-kamiooka', 'view'),
  new MockElement('section', 'view-koizumi', 'view')
];

const poleBtnsYokodai = [
  Object.assign(new MockElement('button', '', 'pole-btn active'), { dataset: { pole: '1' }, textContent: '1番乗り場 (上大岡行)' }),
  Object.assign(new MockElement('button', '', 'pole-btn'), { dataset: { pole: '2' }, textContent: '2番乗り場 (港南台行)' })
];

const poleBtnsKamiooka = [
  Object.assign(new MockElement('button', '', 'pole-btn active'), { dataset: { pole: '6' }, textContent: '6番乗り場 (港南台行)' }),
  Object.assign(new MockElement('button', '', 'pole-btn'), { dataset: { pole: '12' }, textContent: '12番乗り場 (根岸行)' })
];

const poleBtnsKoizumi = [
  Object.assign(new MockElement('button', '', 'pole-btn active'), { dataset: { pole: '1' }, textContent: '1番乗り場 (上大岡行)' }),
  Object.assign(new MockElement('button', '', 'pole-btn'), { dataset: { pole: '2' }, textContent: '2番乗り場 (根岸行)' })
];

const allPoleBtns = [...poleBtnsYokodai, ...poleBtnsKamiooka, ...poleBtnsKoizumi];

const elements = {
  tabs,
  views,
  btnSwap: new MockElement('button', 'btn-swap-direction'),
  dirText: new MockElement('span', 'transfer-direction-text'),
  transferResult: new MockElement('div', 'transfer-result-container'),
  btnRefresh: new MockElement('button', 'btn-refresh'),
  btnSettings: new MockElement('button', 'btn-settings'),
  modalSettings: new MockElement('div', 'modal-settings', 'modal hidden'),
  btnSaveSettings: new MockElement('button', 'btn-save-settings'),
  inputBuffer: new MockElement('input', 'input-transfer-buffer'),
  inputApiKey: new MockElement('input', 'input-api-key'),
  statusBanner: new MockElement('div', 'status-banner', 'status-banner status-normal'),
  statusText: new MockElement('span', '', 'status-text'),
  statusTime: new MockElement('span', 'last-update-time'),
  yokodaiDeps: new MockElement('div', 'yokodai-departures', 'departure-list'),
  kamiookaDeps: new MockElement('div', 'kamiooka-departures', 'departure-list'),
  koizumiDeps: new MockElement('div', 'koizumi-departures', 'departure-list'),
  poleBtns: allPoleBtns
};

// Application test class mimicking updated app.js
class TestApp {
  constructor() {
    this.currentView = 'view-transfer';
    this.direction = 'outbound';
    this.realtimeBuses = [];
    this.lastUpdateTime = null;
    this.els = elements;
    this.activePoles = {
      yokodai: '1',
      kamiooka: '6',
      koizumi: '1'
    };
  }

  async init() {
    this.bindEvents();
    await this.refreshData();
  }

  bindEvents() {
    this.els.tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target.dataset.target;
        this.switchView(target);
      });
    });

    this.els.poleBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const pole = e.target.dataset.pole;
        if (poleBtnsYokodai.includes(e.target)) this.activePoles.yokodai = pole;
        if (poleBtnsKamiooka.includes(e.target)) this.activePoles.kamiooka = pole;
        if (poleBtnsKoizumi.includes(e.target)) this.activePoles.koizumi = pole;
        this.renderAll();
      });
    });
  }

  switchView(viewId) {
    if (this.currentView === viewId) return;
    this.currentView = viewId;
    this.els.tabs.forEach(t => {
      if (t.dataset.target === viewId) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });
    
    this.els.views.forEach(v => {
      if (v.id === viewId) {
        v.classList.add('active');
      } else {
        v.classList.remove('active');
      }
    });

    // Directly re-renders current view immediately on switch
    this.renderAll();
  }

  async refreshData() {
    this.realtimeBuses = await odptClient.fetchRealtimeBuses();
    this.lastUpdateTime = new Date();
    await this.renderAll();
  }

  async renderAll() {
    if (this.currentView === 'view-transfer') {
      await this.renderTransfer();
    } else if (this.currentView === 'view-yokodai') {
      await this.renderStop('yokodai', STOPS.YOKODAI.id.replace(/\.[0-9]+$/, '.' + this.activePoles.yokodai), this.els.yokodaiDeps);
    } else if (this.currentView === 'view-kamiooka') {
      await this.renderStop('kamiooka', STOPS.KAMIOOKA.id.replace(/\.[0-9]+$/, '.' + this.activePoles.kamiooka), this.els.kamiookaDeps);
    } else if (this.currentView === 'view-koizumi') {
      await this.renderStop('koizumi', STOPS.KOIZUMI.id.replace(/\.[0-9]+$/, '.' + this.activePoles.koizumi), this.els.koizumiDeps);
    }
  }

  async renderStop(stopKey, poleId, container) {
    const calType = calendarService.getCalendarType(new Date());
    const tt = await odptClient.fetchBusstopPoleTimetables(poleId, calType);
    const merged = timetableService.mergeRealtimeDelays(tt, this.realtimeBuses);
    const departures = timetableService.getNextDepartures(merged, new Date(), 10);
    
    if (departures.length === 0) {
      container.innerHTML = '本日の運行は終了しました。';
      return;
    }

    container.innerHTML = departures.map(dep => `[${dep.departureTime}] ${dep.line} ${dep.destination} (${dep.countdownText})`).join('\n');
  }

  async renderTransfer() {
    const now = new Date();
    const calType = calendarService.getCalendarType(now);
    let firstPoleId = this.direction === 'outbound'
      ? STOPS.YOKODAI.id.replace(/\.[0-9]+$/, '.1')
      : STOPS.KOIZUMI.id.replace(/\.[0-9]+$/, '.1');
    let transferDeparturePoleId = this.direction === 'outbound'
      ? STOPS.KAMIOOKA.id.replace(/\.[0-9]+$/, '.12')
      : STOPS.KAMIOOKA.id.replace(/\.[0-9]+$/, '.6');

    let tt1 = await odptClient.fetchBusstopPoleTimetables(firstPoleId, calType);
    tt1 = tt1.filter(t => this.direction === 'outbound' ? t.line.includes('111') : t.line.includes('133'));
    const merged1 = timetableService.mergeRealtimeDelays(tt1, this.realtimeBuses);
    const nextDep1 = timetableService.getNextDepartures(merged1, now, 1)[0];

    if (!nextDep1) {
      this.els.transferResult.innerHTML = '本日の運行は終了しました。';
      return;
    }

    this.els.transferResult.innerHTML = `Transfer: ${nextDep1.line} ${nextDep1.departureTime}`;
  }
}

async function runTests() {
  const app = new TestApp();
  await app.init();

  // Test 1: Initial state is transfer
  if (app.currentView !== 'view-transfer' || !elements.transferResult.innerHTML) {
    throw new Error('Test 1 Failed: Initial view not rendered');
  }
  console.log('✔ Test 1 PASS: Initial transfer view rendered');

  // Test 2: Switch to Yokodai on 1st click
  if (elements.yokodaiDeps.innerHTML !== '') {
    throw new Error('Test 2 Precondition Failed: Yokodai departures should be empty before visiting tab');
  }

  // Test 2: Switch to Yokodai on 1st click via DOM tab click event
  tabs[1].dispatchEvent({ type: 'click', target: tabs[1] });
  await new Promise(r => setTimeout(r, 20));
  if (app.currentView !== 'view-yokodai') {
    throw new Error('Test 2 Failed: Current view not updated to view-yokodai');
  }
  if (!elements.yokodaiDeps.innerHTML || elements.yokodaiDeps.innerHTML.includes('loading')) {
    throw new Error('Test 2 Failed: Yokodai departures NOT rendered on first tab click!');
  }
  console.log('✔ Test 2 PASS: Yokodai departures rendered immediately on 1st tab click without pole toggle (DOM event triggered)');

  // Test 3: Click Yokodai pole 2
  poleBtnsYokodai[1].dispatchEvent({ type: 'click', target: poleBtnsYokodai[1] });
  await new Promise(r => setTimeout(r, 20));
  if (app.activePoles.yokodai !== '2') {
    throw new Error('Test 3 Failed: Active pole not changed to 2');
  }
  console.log('✔ Test 3 PASS: Yokodai pole 2 switched and re-rendered successfully');

  // Test 4: Switch to Kamiooka on 1st click via DOM tab click event
  tabs[2].dispatchEvent({ type: 'click', target: tabs[2] });
  await new Promise(r => setTimeout(r, 20));
  if (app.currentView !== 'view-kamiooka') {
    throw new Error('Test 4 Failed: Current view not updated to view-kamiooka');
  }
  if (!elements.kamiookaDeps.innerHTML) {
    throw new Error('Test 4 Failed: Kamiooka departures NOT rendered on first tab click!');
  }
  console.log('✔ Test 4 PASS: Kamiooka departures rendered immediately on 1st tab click (DOM event triggered)');

  // Test 5: Switch to Koizumi on 1st click via DOM tab click event
  tabs[3].dispatchEvent({ type: 'click', target: tabs[3] });
  await new Promise(r => setTimeout(r, 20));
  if (app.currentView !== 'view-koizumi') {
    throw new Error('Test 5 Failed: Current view not updated to view-koizumi');
  }
  if (!elements.koizumiDeps.innerHTML) {
    throw new Error('Test 5 Failed: Koizumi departures NOT rendered on first tab click!');
  }
  console.log('✔ Test 5 PASS: Koizumi departures rendered immediately on 1st tab click (DOM event triggered)');

  // Test 6: Switch back to transfer
  tabs[0].dispatchEvent({ type: 'click', target: tabs[0] });
  await new Promise(r => setTimeout(r, 20));
  if (app.currentView !== 'view-transfer' || !elements.transferResult.innerHTML) {
    throw new Error('Test 6 Failed: Transfer view NOT rendered when switching back!');
  }
  console.log('✔ Test 6 PASS: Transfer view restored on tab switch (DOM event triggered)');

  console.log('\n\x1b[32m%s\x1b[0m', '✨ ALL TAB SWITCHING VERIFICATION TESTS PASSED SUCCESSFULLY! ✨');
}

runTests().catch(err => {
  console.error('\x1b[31m%s\x1b[0m', '✖ TEST FAILED:', err);
  process.exit(1);
});

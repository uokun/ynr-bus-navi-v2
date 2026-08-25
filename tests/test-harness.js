/**
 * test-harness.js
 * Comprehensive Test Harness & In-Memory DOM/Browser Environment for E2E Test Suite
 * Yokohama Municipal Bus Transit Guide & Real-Time Operation Web App
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT_DIR = path.resolve(__dirname, '..');

// ==========================================
// 1. ANSI Color Helpers
// ==========================================
export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

// ==========================================
// 2. Strict Assertion Library
// ==========================================
export class AssertionError extends Error {
  constructor(message, actual, expected) {
    super(message);
    this.name = 'AssertionError';
    this.actual = actual;
    this.expected = expected;
  }
}

export const assert = {
  equal(actual, expected, msg = '') {
    if (actual !== expected) {
      throw new AssertionError(
        `${msg} | Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`,
        actual,
        expected
      );
    }
  },

  deepEqual(actual, expected, msg = '') {
    const actStr = JSON.stringify(actual);
    const expStr = JSON.stringify(expected);
    if (actStr !== expStr) {
      throw new AssertionError(
        `${msg} | Deep equality mismatch:\nExpected: ${expStr}\nActual:   ${actStr}`,
        actual,
        expected
      );
    }
  },

  true(value, msg = 'Expected value to be true') {
    if (value !== true) {
      throw new AssertionError(`${msg} | Actual: ${value}`, value, true);
    }
  },

  false(value, msg = 'Expected value to be false') {
    if (value !== false) {
      throw new AssertionError(`${msg} | Actual: ${value}`, value, false);
    }
  },

  ok(value, msg = 'Expected truthy value') {
    if (!value) {
      throw new AssertionError(`${msg} | Actual: ${value}`, value, true);
    }
  },

  includes(actual, search, msg = '') {
    if (typeof actual === 'string') {
      if (!actual.includes(search)) {
        throw new AssertionError(
          `${msg} | String does not contain "${search}". Value: "${actual}"`,
          actual,
          search
        );
      }
    } else if (Array.isArray(actual)) {
      if (!actual.includes(search)) {
        throw new AssertionError(
          `${msg} | Array does not include element. Array: ${JSON.stringify(actual)}`,
          actual,
          search
        );
      }
    } else {
      throw new AssertionError(`${msg} | Target is neither string nor array`, actual, search);
    }
  },

  match(str, regex, msg = '') {
    if (!regex.test(str)) {
      throw new AssertionError(
        `${msg} | String "${str}" does not match regex ${regex}`,
        str,
        regex
      );
    }
  },

  throws(fn, errorCheck, msg = '') {
    let threw = false;
    let thrownError = null;
    try {
      fn();
    } catch (err) {
      threw = true;
      thrownError = err;
    }
    if (!threw) {
      throw new AssertionError(`${msg} | Expected function to throw an error, but it did not`);
    }
    if (typeof errorCheck === 'function') {
      if (!(thrownError instanceof errorCheck)) {
        throw new AssertionError(
          `${msg} | Expected error instance of ${errorCheck.name}, got ${thrownError?.constructor?.name}`
        );
      }
    } else if (errorCheck instanceof RegExp) {
      if (!errorCheck.test(thrownError.message)) {
        throw new AssertionError(
          `${msg} | Error message "${thrownError.message}" does not match regex ${errorCheck}`
        );
      }
    }
  },

  async rejects(asyncFn, errorCheck, msg = '') {
    let threw = false;
    let thrownError = null;
    try {
      await asyncFn();
    } catch (err) {
      threw = true;
      thrownError = err;
    }
    if (!threw) {
      throw new AssertionError(`${msg} | Expected async function to reject, but it resolved`);
    }
    if (typeof errorCheck === 'function') {
      if (!(thrownError instanceof errorCheck)) {
        throw new AssertionError(
          `${msg} | Expected rejection of ${errorCheck.name}, got ${thrownError?.constructor?.name}`
        );
      }
    } else if (errorCheck instanceof RegExp) {
      if (!errorCheck.test(thrownError.message)) {
        throw new AssertionError(
          `${msg} | Rejection message "${thrownError.message}" does not match regex ${errorCheck}`
        );
      }
    }
  },

  between(num, min, max, msg = '') {
    if (num < min || num > max) {
      throw new AssertionError(
        `${msg} | Number ${num} is out of bounds [${min}, ${max}]`,
        num,
        `[${min}, ${max}]`
      );
    }
  },

  greaterOrEqual(actual, threshold, msg = '') {
    if (actual < threshold) {
      throw new AssertionError(
        `${msg} | Value ${actual} is less than minimum ${threshold}`,
        actual,
        threshold
      );
    }
  }
};

// ==========================================
// 3. In-Memory DOM & Browser Simulation
// ==========================================
export class SimpleDOMNode {
  constructor(tagName = 'div', isText = false, textContent = '') {
    this.tagName = isText ? '#text' : tagName.toUpperCase();
    this.nodeType = isText ? 3 : 1;
    this._textContent = textContent;
    this.attributes = new Map();
    this.classList = new DOMTokenList(this);
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.dataset = {};
    this.style = {};
    this.value = '';
    this.checked = false;
    this.disabled = false;
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  set id(val) {
    this.setAttribute('id', val);
  }

  get className() {
    return this.getAttribute('class') || '';
  }

  set className(val) {
    this.setAttribute('class', val);
  }

  get textContent() {
    if (this.nodeType === 3) return this._textContent;
    return this.children.map(c => c.textContent).join('');
  }

  set textContent(val) {
    if (this.nodeType === 3) {
      this._textContent = String(val);
    } else {
      this.children = [new SimpleDOMNode('#text', true, String(val))];
      this.children[0].parentNode = this;
    }
  }

  get innerHTML() {
    return this.children.map(c => c.outerHTML || c.textContent).join('');
  }

  set innerHTML(htmlStr) {
    this.children = parseHTMLFragments(String(htmlStr), this);
  }

  get outerHTML() {
    if (this.nodeType === 3) return this._textContent;
    const tag = this.tagName.toLowerCase();
    const attrs = [];
    for (const [k, v] of this.attributes.entries()) {
      attrs.push(`${k}="${v}"`);
    }
    const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
    return `<${tag}${attrStr}>${this.innerHTML}</${tag}>`;
  }

  setAttribute(name, value) {
    const sName = name.toLowerCase();
    const sVal = String(value);
    this.attributes.set(sName, sVal);
    if (sName === 'class') {
      this.classList._syncFromString(sVal);
    } else if (sName.startsWith('data-')) {
      const prop = sName.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[prop] = sVal;
    } else if (sName === 'value') {
      this.value = sVal;
    } else if (sName === 'disabled') {
      this.disabled = true;
    }
  }

  getAttribute(name) {
    const sName = name.toLowerCase();
    if (this.attributes.has(sName)) return this.attributes.get(sName);
    return null;
  }

  hasAttribute(name) {
    return this.attributes.has(name.toLowerCase());
  }

  removeAttribute(name) {
    const sName = name.toLowerCase();
    this.attributes.delete(sName);
    if (sName === 'class') this.classList._syncFromString('');
    if (sName.startsWith('data-')) {
      const prop = sName.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      delete this.dataset[prop];
    }
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
      return child;
    }
    throw new Error('Child not found');
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(listener);
  }

  removeEventListener(type, listener) {
    if (!this.listeners.has(type)) return;
    const list = this.listeners.get(type);
    const idx = list.indexOf(listener);
    if (idx !== -1) list.splice(idx, 1);
  }

  dispatchEvent(event) {
    if (!event.target) {
      event.target = this;
    }
    event.currentTarget = this;
    const list = this.listeners.get(event.type) || [];
    for (const fn of list) {
      fn.call(this, event);
    }
    if (event.bubbles && this.parentNode) {
      this.parentNode.dispatchEvent(event);
    }
    return !event.defaultPrevented;
  }

  querySelector(selector) {
    return querySelectorInternal(this, selector);
  }

  querySelectorAll(selector) {
    const results = [];
    querySelectorAllInternal(this, selector, results);
    return results;
  }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }

  click() {
    this.dispatchEvent(new SimpleEvent('click', { bubbles: true }));
  }
}

class DOMTokenList {
  constructor(node) {
    this.node = node;
    this.tokens = new Set();
  }

  _syncFromString(classStr) {
    this.tokens.clear();
    const parts = (classStr || '').trim().split(/\s+/).filter(Boolean);
    for (const p of parts) this.tokens.add(p);
  }

  _syncToNode() {
    this.node.attributes.set('class', Array.from(this.tokens).join(' '));
  }

  add(...tokens) {
    for (const t of tokens) this.tokens.add(t);
    this._syncToNode();
  }

  remove(...tokens) {
    for (const t of tokens) this.tokens.delete(t);
    this._syncToNode();
  }

  toggle(token, force) {
    let result;
    if (typeof force === 'boolean') {
      if (force) this.tokens.add(token);
      else this.tokens.delete(token);
      result = force;
    } else {
      if (this.tokens.has(token)) {
        this.tokens.delete(token);
        result = false;
      } else {
        this.tokens.add(token);
        result = true;
      }
    }
    this._syncToNode();
    return result;
  }

  contains(token) {
    return this.tokens.has(token);
  }

  toString() {
    return Array.from(this.tokens).join(' ');
  }
}

export class SimpleEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = options.bubbles ?? false;
    this.cancelable = options.cancelable ?? false;
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    Object.assign(this, options);
  }

  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }

  stopPropagation() {}
}

export class SimpleCustomEvent extends SimpleEvent {
  constructor(type, options = {}) {
    super(type, options);
    this.detail = options.detail ?? null;
  }
}

// Selector matching helper
function matchesSelector(node, selector) {
  if (node.nodeType !== 1) return false;
  selector = selector.trim();

  // Multi selector (.cls1.cls2) or space separator handled in querySelector
  // ID selector #id
  if (selector.startsWith('#')) {
    const id = selector.slice(1);
    return node.getAttribute('id') === id;
  }

  // Class selector .class
  if (selector.startsWith('.')) {
    const cls = selector.slice(1);
    return node.classList.contains(cls);
  }

  // Attribute selector [attr] or [attr="val"]
  if (selector.startsWith('[') && selector.endsWith(']')) {
    const inner = selector.slice(1, -1);
    if (inner.includes('=')) {
      const [k, v] = inner.split('=').map(s => s.trim().replace(/^["']|["']$/g, ''));
      return node.getAttribute(k) === v;
    }
    return node.hasAttribute(inner);
  }

  // Tag selector
  if (/^[a-zA-Z0-9_-]+$/.test(selector)) {
    return node.tagName.toLowerCase() === selector.toLowerCase();
  }

  return false;
}

function querySelectorInternal(node, selector) {
  const parts = selector.trim().split(/\s+/);
  if (parts.length > 1) {
    const [first, ...rest] = parts;
    const nextSelector = rest.join(' ');
    const candidates = [];
    querySelectorAllInternal(node, first, candidates);
    for (const cand of candidates) {
      const found = querySelectorInternal(cand, nextSelector);
      if (found) return found;
    }
    return null;
  }

  for (const child of node.children) {
    if (child.nodeType === 1) {
      if (matchesSelector(child, selector)) return child;
      const found = querySelectorInternal(child, selector);
      if (found) return found;
    }
  }
  return null;
}

function querySelectorAllInternal(node, selector, results) {
  const parts = selector.trim().split(/\s+/);
  if (parts.length > 1) {
    const [first, ...rest] = parts;
    const nextSelector = rest.join(' ');
    const candidates = [];
    querySelectorAllInternal(node, first, candidates);
    for (const cand of candidates) {
      querySelectorAllInternal(cand, nextSelector, results);
    }
    return;
  }

  for (const child of node.children) {
    if (child.nodeType === 1) {
      if (matchesSelector(child, selector)) results.push(child);
      querySelectorAllInternal(child, selector, results);
    }
  }
}

// Stack-based Robust HTML Fragment Parser
const VOID_TAGS = new Set(['input', 'img', 'br', 'hr', 'link', 'meta', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);

function parseHTMLFragments(htmlStr, parentNode = null) {
  const rootNodes = [];
  const stack = [];

  const tokenRegex = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9-]+)>|<([a-zA-Z0-9-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let match;

  while ((match = tokenRegex.exec(htmlStr)) !== null) {
    if (match[0].startsWith('<!--')) {
      // Comment node - ignore
      continue;
    } else if (match[1]) {
      // Closing tag </tag>
      const closeTag = match[1].toUpperCase();
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tagName === closeTag) {
          stack.length = i; // Pop up to matching open tag
          break;
        }
      }
    } else if (match[2]) {
      // Opening tag <tag attrs /?>
      const tagName = match[2];
      const attrStr = match[3] || '';
      const isSelfClosing = match[4] === '/' || VOID_TAGS.has(tagName.toLowerCase());

      const elem = new SimpleDOMNode(tagName);
      parseAttributes(elem, attrStr);

      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        elem.parentNode = parent;
        parent.children.push(elem);
      } else {
        elem.parentNode = parentNode;
        rootNodes.push(elem);
      }

      if (!isSelfClosing) {
        stack.push(elem);
      }
    } else if (match[5]) {
      // Text node
      const text = match[5];
      const textNode = new SimpleDOMNode('#text', true, text);
      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        textNode.parentNode = parent;
        parent.children.push(textNode);
      } else {
        textNode.parentNode = parentNode;
        rootNodes.push(textNode);
      }
    }
  }

  return rootNodes;
}

function parseAttributes(element, attrStr) {
  if (!attrStr) return;
  const attrRegex = /([a-zA-Z0-9_:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = attrRegex.exec(attrStr)) !== null) {
    const name = match[1];
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    element.setAttribute(name, val);
  }
}

// LocalStorage Simulation
export class MockLocalStorage {
  constructor() {
    this.store = new Map();
    this.shouldThrowQuotaError = false;
  }

  getItem(key) {
    return this.store.has(String(key)) ? this.store.get(String(key)) : null;
  }

  setItem(key, value) {
    if (this.shouldThrowQuotaError) {
      const err = new Error('QuotaExceededError: DOM Exception 22');
      err.name = 'QuotaExceededError';
      throw err;
    }
    this.store.set(String(key), String(value));
  }

  removeItem(key) {
    this.store.delete(String(key));
  }

  clear() {
    this.store.clear();
  }

  get length() {
    return this.store.size;
  }

  key(index) {
    const keys = Array.from(this.store.keys());
    return keys[index] || null;
  }
}

// Browser Environment Factory
export function createBrowserEnv() {
  const document = new SimpleDOMNode('document');
  document.createElement = (tag) => new SimpleDOMNode(tag);
  document.createTextNode = (txt) => new SimpleDOMNode('#text', true, txt);
  document.visibilityState = 'visible';
  document.title = '横浜市営バス 運行ナビ';

  const html = document.appendChild(new SimpleDOMNode('html'));
  const head = html.appendChild(new SimpleDOMNode('head'));
  const body = html.appendChild(new SimpleDOMNode('body'));

  document.documentElement = html;
  document.head = head;
  document.body = body;
  document.documentElement = html;

  const localStorage = new MockLocalStorage();
  const sessionStorage = new MockLocalStorage();

  const fetchSpies = [];
  const fetchMockHandlers = new Map();

  const mockFetch = async (url, options = {}) => {
    fetchSpies.push({ url, options, timestamp: Date.now() });
    const urlStr = String(url);

    // Check custom handlers
    for (const [pattern, handler] of fetchMockHandlers.entries()) {
      if (typeof pattern === 'string' && urlStr.includes(pattern)) {
        return handler(urlStr, options);
      } else if (pattern instanceof RegExp && pattern.test(urlStr)) {
        return handler(urlStr, options);
      }
    }

    // Default mock response for ODPT
    if (urlStr.includes('odpt:BusTimetable') || urlStr.includes('odpt:BusstopPoleTimetable')) {
      const is133 = urlStr.includes('133') || urlStr.includes('1810') || urlStr.includes('.12');
      const sampleTimes = is133 
        ? ['06:22', '07:50', '08:20', '09:00', '12:00', '18:00', '21:00']
        : ['06:15', '07:30', '07:45', '08:15', '09:00', '12:00', '18:00', '21:00'];
      
      const stopPoles = is133 
        ? ['odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.12', 'odpt.BusstopPole:YokohamaMunicipal.Koizumi.1810.1']
        : ['odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1', 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6'];

      const mockTimetables = [];
      for (const time of sampleTimes) {
        for (const sp of stopPoles) {
          mockTimetables.push({
            'odpt:busstopPole': sp,
            'odpt:departureTime': time,
            'odpt:destinationSign': is133 ? (sp.includes('1810') ? '上大岡駅前 行' : '根岸駅前 行') : '上大岡駅前 行',
            'odpt:isMidnight': false
          });
        }
      }

      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => [
          {
            '@type': 'odpt:BusTimetable',
            'dc:title': is133 ? '133系統' : '111系統',
            'odpt:calendar': 'odpt.Calendar:Weekday',
            'odpt:busroute': is133 ? '133系統' : '111系統',
            'odpt:busTimetableObject': mockTimetables
          }
        ]
      };
    }

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => []
    };
  };

  const window = {
    document,
    localStorage,
    sessionStorage,
    fetch: mockFetch,
    location: { href: 'http://localhost:8080/' },
    navigator: {
      onLine: true,
      serviceWorker: {
        register: async () => ({ scope: '/' }),
        controller: null
      }
    },
    addEventListener: document.addEventListener.bind(document),
    removeEventListener: document.removeEventListener.bind(document),
    dispatchEvent: document.dispatchEvent.bind(document),
    CustomEvent: SimpleCustomEvent,
    Event: SimpleEvent,
  };

  return {
    window,
    document,
    localStorage,
    sessionStorage,
    fetchSpies,
    fetchMockHandlers,
    setMockFetch(pattern, handler) {
      fetchMockHandlers.set(pattern, handler);
    }
  };
}

// ==========================================
// 4. Authoritative Specification Oracles
// ==========================================

export const REFERENCE_CONFIG = {
  API_BASE: 'https://api.odpt.org/api/v4/',
  DEFAULT_CONSUMER_KEY: '',
  DEFAULT_BUFFER_MINUTES: 0,
  POLLING_INTERVAL_SEC: 30,
  STORAGE_KEYS: {
    API_KEY: 'odpt_api_key',
    BUFFER: 'transfer_buffer_minutes',
    THEME: 'app_theme',
    AUTO_POLL: 'auto_poll_enabled',
    CACHE_TIMETABLE: 'cache_timetable_',
    CACHE_STOPS: 'cache_stops',
  },
  OPERATOR_ID: 'odpt.Operator:YokohamaMunicipal',
  STOPS: {
    YOKODAI: 'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi',
    KAMIOOKA: 'odpt.BusstopPole:YokohamaMunicipal.KamiookaEkimae',
    KOIZUMI: 'odpt.BusstopPole:YokohamaMunicipal.Koizumi',
  },
  ROUTES: {
    ROUTE_111: '111系統',
    ROUTE_133: '133系統',
    ROUTE_64: '64系統',
  }
};

/**
 * Japanese National Holiday Oracle
 */
export function isJapaneseHolidayOracle(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const dayOfWeek = date.getDay(); // 0 = Sun

  // Year-End / New Year Special Schedule (Dec 29 - Jan 3)
  if ((m === 12 && d >= 29) || (m === 1 && d <= 3)) {
    return true;
  }

  // Fixed National Holidays
  const fixedHolidays = [
    { m: 1, d: 1 },   // 元日
    { m: 2, d: 11 },  // 建国記念の日
    { m: 2, d: 23 },  // 天皇誕生日
    { m: 4, d: 29 },  // 昭和の日
    { m: 5, d: 3 },   // 憲法記念日
    { m: 5, d: 4 },   // みどりの日
    { m: 5, d: 5 },   // こどもの日
    { m: 8, d: 11 },  // 山の日
    { m: 11, d: 3 },  // 文化の日
    { m: 11, d: 23 }, // 勤労感謝の日
  ];

  for (const h of fixedHolidays) {
    if (m === h.m && d === h.d) return true;
  }

  // Happy Monday (2nd or 3rd Monday)
  // 成人の日: Jan 2nd Monday
  if (m === 1 && dayOfWeek === 1 && d >= 8 && d <= 14) return true;
  // 海の日: Jul 3rd Monday
  if (m === 7 && dayOfWeek === 1 && d >= 15 && d <= 21) return true;
  // 敬老の日: Sep 3rd Monday
  if (m === 9 && dayOfWeek === 1 && d >= 15 && d <= 21) return true;
  // スポーツの日: Oct 2nd Monday
  if (m === 10 && dayOfWeek === 1 && d >= 8 && d <= 14) return true;

  // Vernal / Autumnal Equinox approx formula
  const vernalDay = Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
  if (m === 3 && d === vernalDay) return true;

  const autumnalDay = Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
  if (m === 9 && d === autumnalDay) return true;

  // Substitute Holiday check (振替休日)
  // If yesterday was a national holiday and yesterday was Sunday
  const yesterday = new Date(y, m - 1, d - 1);
  if (yesterday.getDay() === 0 && isJapaneseHolidayOracle(yesterday)) {
    return true;
  }
  // If May 3 or 4 was Sunday, May 6 can be substitute holiday
  if (m === 5 && d === 6 && (new Date(y, 4, 3).getDay() === 0 || new Date(y, 4, 4).getDay() === 0)) {
    return true;
  }

  return false;
}

export function getCalendarTypeOracle(date) {
  if (isJapaneseHolidayOracle(date)) return 'Holiday';
  const day = date.getDay();
  if (day === 0) return 'Holiday'; // Sunday
  if (day === 6) return 'Saturday'; // Saturday
  return 'Weekday';
}

/**
 * Transfer Calculation Oracle
 */
export function calculateTransferOracle({
  leg1Timetable = [],
  leg2Timetable = [],
  direction = 'outbound',
  bufferMinutes = 5,
  realtimeDelays = {},
  currentTime = new Date()
}) {
  // Normalize buffer
  let buffer = typeof bufferMinutes === 'number' && !isNaN(bufferMinutes) ? Math.max(0, bufferMinutes) : 5;

  // Helper to parse time string "HH:MM" into minutes
  const toMinutes = (timeStr) => {
    const [hh, mm] = timeStr.split(':').map(Number);
    return hh * 60 + mm;
  };
  const fromMinutes = (totalMin) => {
    const hh = Math.floor(totalMin / 60) % 24;
    const mm = totalMin % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  const curMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  // Leg 1 travel time: Yokodai -> Kamiooka = 15m, Koizumi -> Kamiooka = 12m
  const leg1TravelTime = direction === 'outbound' ? 15 : 12;
  const leg2TravelTime = direction === 'outbound' ? 12 : 15;

  const validOptions = [];

  for (const b1 of leg1Timetable) {
    if (b1.isCancelled) continue;
    const dep1Min = toMinutes(b1.departureTime);
    const delay1 = realtimeDelays[b1.busId || b1.line] || b1.delayMinutes || 0;
    const actualDep1 = dep1Min + delay1;

    // Must be future departure or departing now
    if (actualDep1 < curMinutes) continue;

    const arr1Min = actualDep1 + leg1TravelTime;
    const minConnectingTime = arr1Min + buffer;

    // Find suitable Leg 2 departures
    for (const b2 of leg2Timetable) {
      if (b2.isCancelled) continue;
      const dep2Min = toMinutes(b2.departureTime);
      const delay2 = realtimeDelays[b2.busId || b2.line] || b2.delayMinutes || 0;
      const actualDep2 = dep2Min + delay2;

      if (actualDep2 >= minConnectingTime) {
        const waitMinutes = actualDep2 - arr1Min;
        const arr2Min = actualDep2 + leg2TravelTime;

        validOptions.push({
          leg1: {
            ...b1,
            actualDepartureTime: fromMinutes(actualDep1),
            estimatedArrivalTime: fromMinutes(arr1Min),
            delayMinutes: delay1
          },
          leg2: {
            ...b2,
            actualDepartureTime: fromMinutes(actualDep2),
            estimatedArrivalTime: fromMinutes(arr2Min),
            delayMinutes: delay2
          },
          transferWaitMinutes: waitMinutes,
          bufferMinutes: buffer,
          totalDurationMinutes: arr2Min - actualDep1
        });
        break; // Found the best match for this b1
      }
    }
  }

  if (validOptions.length === 0) {
    return {
      recommended: null,
      alternatives: [],
      status: 'no_buses_available'
    };
  }

  return {
    recommended: validOptions[0],
    alternatives: validOptions.slice(1, 4),
    status: 'ok'
  };
}

/**
 * Static Mock Timetable Generator
 */
export function getMockTimetables() {
  // Line 111 (Yokodai -> Kamiooka) Weekday
  const line111Outbound = [
    '06:15', '06:35', '06:50', '07:05', '07:18', '07:30', '07:42', '07:55',
    '08:10', '08:25', '08:40', '09:00', '09:20', '09:40', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:20', '15:40', '16:00', '16:20', '16:40', '17:00', '17:15',
    '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:20',
    '19:40', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30'
  ].map((t, idx) => ({
    busId: `111-out-${idx}`,
    line: '111系統',
    destination: '上大岡駅前',
    departureTime: t
  }));

  // Line 133 (Kamiooka -> Koizumi -> Negishi) Weekday
  const line133Outbound = [
    '06:30', '06:55', '07:15', '07:35', '07:50', '08:05', '08:20', '08:40',
    '09:05', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:25',
    '16:50', '17:10', '17:30', '17:50', '18:10', '18:30', '18:50', '19:10',
    '19:30', '20:00', '20:30', '21:00', '21:30', '22:15'
  ].map((t, idx) => ({
    busId: `133-out-${idx}`,
    line: '133系統',
    destination: '根岸駅前',
    departureTime: t
  }));

  // Line 64 (Kamiooka -> Koizumi -> Isogo/Konandai)
  const line64Outbound = [
    '07:00', '07:40', '08:30', '09:15', '10:15', '11:15', '12:15', '13:15',
    '14:15', '15:15', '16:15', '17:15', '18:15', '19:15', '20:15', '21:15'
  ].map((t, idx) => ({
    busId: `64-out-${idx}`,
    line: '64系統',
    destination: '磯子駅前',
    departureTime: t
  }));

  // Inbound: Koizumi -> Kamiooka (Line 133)
  const line133Inbound = [
    '06:20', '06:45', '07:05', '07:25', '07:45', '08:05', '08:25', '08:50',
    '09:15', '09:45', '10:15', '10:45', '11:15', '11:45', '12:15', '12:45',
    '13:15', '13:45', '14:15', '14:45', '15:15', '15:45', '16:15', '16:40',
    '17:00', '17:20', '17:40', '18:00', '18:20', '18:40', '19:00', '19:25',
    '19:50', '20:20', '20:50', '21:20', '22:00'
  ].map((t, idx) => ({
    busId: `133-in-${idx}`,
    line: '133系統',
    destination: '上大岡駅前',
    departureTime: t
  }));

  // Inbound: Kamiooka -> Yokodai (Line 111)
  const line111Inbound = [
    '06:40', '07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30',
    '08:45', '09:05', '09:25', '09:45', '10:15', '10:45', '11:15', '11:45',
    '12:15', '12:45', '13:15', '13:45', '14:15', '14:45', '15:15', '15:40',
    '16:00', '16:20', '16:40', '17:00', '17:15', '17:30', '17:45', '18:00',
    '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:50', '20:10',
    '20:35', '21:05', '21:35', '22:05', '22:40'
  ].map((t, idx) => ({
    busId: `111-in-${idx}`,
    line: '111系統',
    destination: '港南台駅前',
    departureTime: t
  }));

  return {
    line111Outbound,
    line133Outbound,
    line64Outbound,
    line133Inbound,
    line111Inbound,
  };
}

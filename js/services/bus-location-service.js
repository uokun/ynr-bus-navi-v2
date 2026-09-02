/**
 * bus-location-service.js
 * 
 * 横浜市営バス リアルタイム在線位置（バスロケーション）および「何個前」停留所計算エンジン
 * ODPT API (odpt:Bus) の運行位置 (fromBusstopPole, toBusstopPole, delay) と
 * 目的停留所 (targetPoleId) から、相対停留所数・運行状態・JR風ステップタイムラインノード列を算出する。
 */

import { CONFIG, STOPS, ROUTES } from '../config.js';

// =========================================================================
// 1. 停留所ポールID・停留所名マッピング辞書 & 正規化マスター
// =========================================================================

/**
 * ODPTポールID / 短縮識別子 / プレフィックスから停留所名へのマッピングテーブル
 */
export const POLE_NAME_MAPPINGS = {
  // 洋光台北口
  '7800.1': '洋光台北口',
  '7800.2': '洋光台北口',
  'YokodaiKitaguchi': '洋光台北口',
  'Yokodai-Kitaguchi': '洋光台北口',

  // 上大岡駅前
  '1046.1': '上大岡駅前',
  '1046.5': '上大岡駅前',
  '1046.6': '上大岡駅前',
  '1046.7': '上大岡駅前',
  '1046.11': '上大岡駅前',
  '1046.12': '上大岡駅前',
  '1046.13': '上大岡駅前',
  '2001.1': '上大岡駅前',
  '2001.5': '上大岡駅前',
  '2001.6': '上大岡駅前',
  '2001.7': '上大岡駅前',
  '2001.11': '上大岡駅前',
  '2001.12': '上大岡駅前',
  '2001.13': '上大岡駅前',
  'KamiookaStation': '上大岡駅前',
  'Kamiooka': '上大岡駅前',
  'Kamiooka-Ekimae': '上大岡駅前',

  // 古泉
  '1810.1': '古泉',
  '1810.2': '古泉',
  '3100.1': '古泉',
  '3100.2': '古泉',
  'Koizumi': '古泉',

  // 111系統・64系統 沿線停留所
  '1823.3': '港南台駅前',
  '1823.5': '港南台駅前',
  'KonandaiStation': '港南台駅前',
  'KonandaiEkimae': '港南台駅前',
  'Konandai': '港南台駅前',

  '7822.1': '横浜女子短大前',
  '7822.2': '横浜女子短大前',
  'YokohamaWomenJuniorCollege': '横浜女子短大前',
  'YokohamaJoshiTandaimae': '横浜女子短大前',

  '609.1': '榎戸',
  '609.2': '榎戸',
  'Enokido': '榎戸',

  '1824.1': '港南環境センター前',
  '1824.2': '港南環境センター前',
  'KonanEnvironmentalCenter': '港南環境センター前',
  'KonankankyoCentermae': '港南環境センター前',

  '406.1': '臼杵',
  '406.2': '臼杵',
  'Usuki': '臼杵',

  '1825.1': '港南台第一小学校前',
  '1825.2': '港南台第一小学校前',
  'KonandaiDaiichiElementarySchool': '港南台第一小学校前',
  'KonandaiDaiichiShogakkomae': '港南台第一小学校前',

  '1848.1': '港南台第一中学校前',
  '1848.2': '港南台第一中学校前',
  'KonandaiDaiichiJuniorHighSchool': '港南台第一中学校前',
  'KonandaiDaiichiChugakkomae': '港南台第一中学校前',

  '5000.1': 'バイパス下',
  '5000.2': 'バイパス下',
  'BypassShita': 'バイパス下',

  '7803.1': '洋光台五丁目',
  '7803.2': '洋光台五丁目',
  'YokodaiGochome': '洋光台五丁目',

  '7806.2': '洋光台駅前',
  '7806.3': '洋光台駅前',
  'YokodaiStation': '洋光台駅前',
  'YokodaiEkimae': '洋光台駅前',

  '4223.1': '西公園前',
  '4223.2': '西公園前',
  'NishiPark': '西公園前',
  'Nishikoenmae': '西公園前',

  '7802.1': '洋光台二丁目',
  '7802.2': '洋光台二丁目',
  'YokodaiNichome': '洋光台二丁目',

  '5256.1': '日野中央公園入口',
  '5256.2': '日野中央公園入口',
  'HinoChuoKoenIriguchi': '日野中央公園入口',
  'Hinochuokoeniriguchi': '日野中央公園入口',

  '5208.1': '日野公園墓地入口',
  '5208.2': '日野公園墓地入口',
  'HinoKoenBochiIriguchi': '日野公園墓地入口',
  'Hinokoenbochiiriguchi': '日野公園墓地入口',

  '2302.1': '新吉原橋',
  '2302.2': '新吉原橋',
  'ShinYoshiharabashi': '新吉原橋',
  'Shinyoshiharabashi': '新吉原橋',

  '7816.1': '吉原',
  '7816.2': '吉原',
  'Yoshihara': '吉原',

  '1827.1': '港南区総合庁舎前',
  '1827.2': '港南区総合庁舎前',
  '1827.3': '港南区総合庁舎前',
  'KonanWardOffice': '港南区総合庁舎前',
  'KonankuSogoChoshamae': '港南区総合庁舎前',

  '2021.1': '笹下港南中央通',
  '2021.2': '笹下港南中央通',
  'SasageKonanchuodori': '笹下港南中央通',
  'SasageKonanChuoDori': '笹下港南中央通',

  '2604.1': '関の下',
  '2604.2': '関の下',
  'Sekinoshita': '関の下',

  // 133系統・64系統 沿線停留所
  '2004.1': '最戸橋',
  '2004.2': '最戸橋',
  'Saidobashi': '最戸橋',

  '1843.1': '越戸橋',
  '1843.2': '越戸橋',
  'Koshidobashi': '越戸橋',

  '6401.1': '向田橋',
  '6401.2': '向田橋',
  'Mukaidabashi': '向田橋',

  '850.1': '大岡交番前',
  '850.2': '大岡交番前',
  'OokaKobanmae': '大岡交番前',

  '6017.1': '万福寺前',
  '6017.2': '万福寺前',
  'Mampukuji': '万福寺前',
  'Manfukujimae': '万福寺前',

  '1047.1': '上笹堀',
  '1047.2': '上笹堀',
  'Kamisasabori': '上笹堀',

  '2020.1': '笹堀',
  '2020.2': '笹堀',
  'Sasabori': '笹堀',

  '7848.1': '横浜岡村郵便局前',
  '7848.2': '横浜岡村郵便局前',
  'YokohamaOkamuraPostOffice': '横浜岡村郵便局前',
  'YokohamaOkamuraYubinkyokumae': '横浜岡村郵便局前',

  '3609.1': '天神前',
  '3609.2': '天神前',
  'Tenjinmae': '天神前',

  '827.1': '岡村町',
  '827.2': '岡村町',
  'Okamuracho': '岡村町',

  '4023.1': '仲之町',
  '4023.2': '仲之町',
  'Nakanocho': '仲之町',

  '3049.1': '滝頭地域ケアプラザ前',
  '3049.2': '滝頭地域ケアプラザ前',
  'TakigashiraCommunityCarePlaza': '滝頭地域ケアプラザ前',

  '2288.1': '市電保存館前',
  '2288.3': '市電保存館前',
  'TramMuseum': '市電保存館前',
  'ShidenHozonkanmae': '市電保存館前',

  '3034.1': '滝頭',
  '3034.2': '滝頭',
  'Takigashira': '滝頭',

  '2010.1': '坂下公園前',
  '2010.2': '坂下公園前',
  'SakashitaPark': '坂下公園前',
  'Sakashitakoenmae': '坂下公園前',

  '2242.1': '下町',
  '2242.2': '下町',
  'Shitamachi': '下町',

  '5401.1': 'プールセンター前',
  '5401.2': 'プールセンター前',
  'PoolCenter': 'プールセンター前',
  'PoolCentermae': 'プールセンター前',

  '4600.4': '根岸駅前',
  'NegishiStation': '根岸駅前',
  'NegishiEkimae': '根岸駅前',

  '5203.1': '日野',
  '5203.2': '日野',
  'Hino': '日野',

  '5204.1': '日野小学校前',
  '5204.2': '日野小学校前',
  'HinoElementarySchool': '日野小学校前',

  '2209.1': '清水橋',
  '2209.2': '清水橋',
  'Shimizubashi': '清水橋',

  '218.5': '磯子駅前',
  'IsogoStation': '磯子駅前',
  'IsogoEkimae': '磯子駅前'
};

// =========================================================================
// 2. ヘルパー関数: ポール正規化 & 停留所名解決
// =========================================================================

/**
 * ODPTポールIDやURI、短縮IDを正規化し、停留所名または基本識別名を特定する
 * @param {string} poleId
 * @returns {string} 停留所名 (解決できない場合は入力文字列)
 */
export function getStopNameFromPole(poleId) {
  if (!poleId || typeof poleId !== 'string') return '';
  
  // 1. 既に完全な停留所名である場合
  if (POLE_NAME_MAPPINGS[poleId]) {
    return POLE_NAME_MAPPINGS[poleId];
  }

  // 2. ODPT URIの末尾からポールコード (例: 7800.1 や YokodaiKitaguchi) を抽出
  // 例: "odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1" -> "7800.1" or "YokodaiKitaguchi"
  const cleanId = poleId.trim();
  const parts = cleanId.split('.');
  
  // 末尾2要素が数字コードの場合 (例: 7800.1)
  if (parts.length >= 2) {
    const lastTwo = parts.slice(-2).join('.');
    if (POLE_NAME_MAPPINGS[lastTwo]) {
      return POLE_NAME_MAPPINGS[lastTwo];
    }
  }

  // 末尾1要素
  const lastOne = parts[parts.length - 1];
  if (POLE_NAME_MAPPINGS[lastOne]) {
    return POLE_NAME_MAPPINGS[lastOne];
  }

  // 英語停留所名部分 (例: YokodaiKitaguchi)
  for (const part of parts) {
    if (POLE_NAME_MAPPINGS[part]) {
      return POLE_NAME_MAPPINGS[part];
    }
  }

  // STOPSオブジェクトとの突合
  if (STOPS) {
    for (const key of Object.keys(STOPS)) {
      const stop = STOPS[key];
      if (stop.id === cleanId || stop.sameAs === cleanId || stop.idArrival === cleanId || stop.idInbound === cleanId) {
        return stop.name;
      }
      if (cleanId.includes(stop.name)) {
        return stop.name;
      }
    }
  }

  // 数字コードプレフィックスからの解決
  if (/^[0-9]+(\.[0-9]+)?$/.test(cleanId)) {
    if (cleanId.startsWith('7800') || cleanId.startsWith('7806') || cleanId.startsWith('7802')) return '洋光台北口';
    if (cleanId.startsWith('2001') || cleanId.startsWith('1046')) return '上大岡駅前';
    if (cleanId.startsWith('3100') || cleanId.startsWith('1810')) return '古泉';
  }

  return cleanId;
}

/**
 * ポールIDを標準的な形式に正規化する
 * @param {string} poleId
 * @returns {string}
 */
export function normalizePoleId(poleId) {
  if (!poleId || typeof poleId !== 'string') return '';
  return poleId.trim();
}

/**
 * 系統パターンIDまたは系統名・ポールID・行先から運行停留所順序配列を高精度に取得する
 * @param {string} routePatternIdOrLine
 * @param {'outbound'|'inbound'|null} [direction=null]
 * @param {string|null} [targetPoleOrName=null]
 * @param {string|null} [destination=null]
 * @returns {Array<string>} 停留所名の順序配列
 */
export function getStopsForRoute(routePatternIdOrLine, direction = null, targetPoleOrName = null, destination = null) {
  const str = String(routePatternIdOrLine || '');
  const poleStr = String(targetPoleOrName || '');
  const destStr = String(destination || '');

  // 1. 133系統 (根岸駅前 〜 古泉 〜 上大岡駅前)
  if (str.includes('133') || poleStr.includes('1810') || destStr.includes('根岸') || (destStr.includes('上大岡') && (poleStr.includes('1810') || str.includes('133')))) {
    let isUpboundToKamiooka = false;
    if (str.includes('13300') || (str.includes('inbound') && !str.includes('13303')) || (direction === 'inbound' && !str.includes('13303') && !str.includes('13301'))) {
      isUpboundToKamiooka = true;
    } else if (str.includes('13303') || str.includes('13301') || (str.includes('outbound') && !str.includes('13300')) || (direction === 'outbound' && !str.includes('13300'))) {
      isUpboundToKamiooka = false;
    } else if (destStr.includes('上大岡')) {
      isUpboundToKamiooka = true;
    } else if (destStr.includes('根岸')) {
      isUpboundToKamiooka = false;
    } else if (poleStr.includes('1810.1') && !poleStr.includes('1810.2')) {
      isUpboundToKamiooka = true;
    }

    if (isUpboundToKamiooka) {
      return ROUTES?.ROUTE_133?.stopsInbound || [
        '根岸駅前', 'プールセンター前', '下町', '坂下公園前', '滝頭',
        '市電保存館前', '滝頭地域ケアプラザ前', '仲之町', '古泉', '岡村町',
        '天神前', '横浜岡村郵便局前', '上笹堀', '万福寺前', '向田橋',
        '越戸橋', '最戸橋', '上大岡駅前'
      ];
    } else {
      return ROUTES?.ROUTE_133?.stopsOutbound || [
        '上大岡駅前', '最戸橋', '越戸橋', '向田橋', '大岡交番前', '万福寺前',
        '上笹堀', '横浜岡村郵便局前', '天神前', '岡村町', '古泉', '仲之町',
        '滝頭地域ケアプラザ前', '市電保存館前', '滝頭', '坂下公園前', '下町',
        'プールセンター前', '根岸駅前'
      ];
    }
  }

  // 2. 64系統 (磯子駅前 〜 上笹堀 〜 上大岡駅前 〜 港南台駅前)
  if (str.includes('64') || str.includes('064') || destStr.includes('磯子')) {
    const isInbound =
      str.includes('06406') ||
      str.includes('06407') ||
      direction === 'inbound' ||
      destStr.includes('港南台');

    if (isInbound) {
      return ROUTES?.ROUTE_64?.stopsInbound || [
        '磯子駅前', '笹堀', '上笹堀', '万福寺前', '向田橋', '越戸橋',
        '最戸橋', '上大岡駅前', '関の下', '笹下港南中央通', '港南区総合庁舎前',
        '吉原', '新吉原橋', '日野公園墓地入口', '日野中央公園入口', '日野',
        '清水橋', '港南台駅前'
      ];
    } else {
      return ROUTES?.ROUTE_64?.stopsOutbound || [
        '港南台駅前', '清水橋', '日野', '日野中央公園入口', '日野公園墓地入口',
        '新吉原橋', '吉原', '港南区総合庁舎前', '笹下港南中央通', '関の下',
        '上大岡駅前', '最戸橋', '越戸橋', '向田橋', '大岡交番前', '万福寺前',
        '上笹堀', '笹堀', '磯子駅前'
      ];
    }
  }

  // 3. 111系統 (港南台駅前 〜 洋光台北口 〜 上大岡駅前)
  if (str.includes('111') || poleStr.includes('7800') || destStr.includes('港南台') || destStr.includes('上大岡') || poleStr.includes('1046')) {
    let isDownboundToKonandai = false;
    if (str.includes('11101') || (str.includes('inbound') && !str.includes('11100')) || (direction === 'inbound' && !str.includes('11100'))) {
      isDownboundToKonandai = true;
    } else if (str.includes('11100') || (str.includes('outbound') && !str.includes('11101')) || (direction === 'outbound' && !str.includes('11101'))) {
      isDownboundToKonandai = false;
    } else if (destStr.includes('港南台')) {
      isDownboundToKonandai = true;
    } else if (destStr.includes('上大岡')) {
      isDownboundToKonandai = false;
    } else if (poleStr.includes('7800.2') || poleStr.includes('1046.6')) {
      isDownboundToKonandai = true;
    }

    if (isDownboundToKonandai) {
      return ROUTES?.ROUTE_111?.stopsInbound || [
        '上大岡駅前', '関の下', '笹下港南中央通', '港南区総合庁舎前', '吉原',
        '新吉原橋', '日野公園墓地入口', '日野中央公園入口', '洋光台北口',
        '洋光台二丁目', '西公園前', '洋光台駅前', '洋光台五丁目', 'バイパス下',
        '港南台第一中学校前', '港南台第一小学校前', '臼杵', '港南環境センター前',
        '榎戸', '横浜女子短大前', '港南台駅前'
      ];
    } else {
      return ROUTES?.ROUTE_111?.stopsOutbound || [
        '港南台駅前', '横浜女子短大前', '榎戸', '港南環境センター前', '臼杵',
        '港南台第一小学校前', '港南台第一中学校前', 'バイパス下', '洋光台五丁目',
        '洋光台駅前', '西公園前', '洋光台二丁目', '洋光台北口', '日野中央公園入口',
        '日野公園墓地入口', '新吉原橋', '吉原', '港南区総合庁舎前', '笹下港南中央通',
        '関の下', '上大岡駅前'
      ];
    }
  }

  // デフォルトフォールバック
  return ROUTES?.ROUTE_111?.stopsOutbound || [];
}

/**
 * 停留所リスト内から指定されたポールIDまたは停留所名に合致するインデックスを検索する
 * @param {Array<string>} stopsList 停留所名順序リスト
 * @param {string} poleOrName ポールIDまたは停留所名
 * @returns {number} 見つかったインデックス (未検出は -1)
 */
export function findStopIndex(stopsList, poleOrName) {
  if (!Array.isArray(stopsList) || !poleOrName) return -1;

  const resolvedName = getStopNameFromPole(poleOrName);

  // 1. 完全一致検索
  let idx = stopsList.indexOf(resolvedName);
  if (idx !== -1) return idx;

  // 2. 部分一致検索 (例: "上大岡駅前" と "上大岡")
  idx = stopsList.findIndex(s => s.includes(resolvedName) || resolvedName.includes(s));
  if (idx !== -1) return idx;

  // 3. 原文のまま突合
  idx = stopsList.findIndex(s => poleOrName.includes(s) || s.includes(poleOrName));
  return idx;
}

/**
 * 遅延秒数を表示用日本語テキストにフォーマットする
 * @param {number} delaySeconds
 * @returns {{ delayMinutes: number, delayText: string }}
 */
export function formatDelayText(delaySeconds = 0) {
  const sec = (typeof delaySeconds === 'number' && Number.isFinite(delaySeconds)) ? delaySeconds : 0;
  const delayMinutes = Math.round(sec / 60);

  let delayText = '定刻';
  if (delayMinutes > 0) {
    delayText = `+${delayMinutes}分遅れ`;
  } else if (delayMinutes < 0) {
    delayText = `${delayMinutes}分早着`;
  }

  return { delayMinutes, delayText };
}

/**
 * 在線ステータスと相対停留所数から表示用日本語ラベルを生成する
 * @param {string} status 'at_stop' | 'approaching' | 'en_route' | 'passed' | 'scheduled'
 * @param {number|null} stopsAway
 * @param {string} fromStopName
 * @param {string} toStopName
 * @returns {string}
 */
export function formatStatusText(status, stopsAway, fromStopName = '', toStopName = '') {
  switch (status) {
    case 'at_stop':
      return '当バス停に到着/停車中';
    case 'approaching':
      if (fromStopName) {
        return `まもなく到着 (${fromStopName}を出発)`;
      }
      return 'まもなく到着';
    case 'en_route':
      if (typeof stopsAway === 'number' && stopsAway >= 1) {
        if (fromStopName && toStopName) {
          return `${stopsAway}個前 (${fromStopName}〜${toStopName}間) を走行中`;
        } else if (fromStopName) {
          return `${stopsAway}個前 (${fromStopName}付近) を走行中`;
        }
        return `${stopsAway}個前を走行中`;
      }
      if (fromStopName && toStopName) {
        return `${fromStopName}〜${toStopName}間 走行中`;
      }
      if (fromStopName) {
        return `${fromStopName}付近 走行中`;
      }
      return '走行中';
    case 'passed':
      return '通過済';
    case 'scheduled':
    default:
      return '運行前/予定';
  }
}

/**
 * 現在走行位置の具体的・直感的なサマリー文を生成する
 * @param {string} status 
 * @param {number|null} stopsAway 
 * @param {string} fromStopName 
 * @param {string} toStopName 
 * @param {string} targetStopName 
 * @param {number} delayMinutes 
 * @returns {{ headline: string, subline: string, shortBadge: string }}
 */
export function formatLocationSummary(status, stopsAway, fromStopName = '', toStopName = '', targetStopName = '', delayMinutes = 0) {
  const delayStr = delayMinutes > 0 ? ` (+${delayMinutes}分遅延)` : ' (定刻)';

  if (status === 'at_stop') {
    return {
      headline: `当バス停【${targetStopName || '現在地'}】に停車中`,
      subline: `現在ご乗車いただけます。まもなく発車します${delayStr}`,
      shortBadge: `停車中${delayStr}`
    };
  }

  if (status === 'approaching') {
    const fromText = fromStopName ? `【${fromStopName}】を発車 ➔ ` : '';
    return {
      headline: `${fromText}まもなく【${targetStopName || '当バス停'}】に到着`,
      subline: `直前の区間を走行しています${delayStr}`,
      shortBadge: `まもなく到着${delayStr}`
    };
  }

  if (status === 'en_route') {
    if (fromStopName && toStopName) {
      return {
        headline: `【${fromStopName}】発車 ➔ 【${toStopName}】へ走行中`,
        subline: `${targetStopName ? `【${targetStopName}】まで あと${stopsAway}停留所` : `あと${stopsAway}停留所`}${delayStr}`,
        shortBadge: `${fromStopName}➔${toStopName}`
      };
    } else if (fromStopName) {
      return {
        headline: `【${fromStopName}】付近を運行中`,
        subline: `${targetStopName ? `【${targetStopName}】まで あと${stopsAway}停留所` : `あと${stopsAway}停留所`}${delayStr}`,
        shortBadge: `${fromStopName}付近`
      };
    } else {
      return {
        headline: `${stopsAway}個前の停留所付近を運行中`,
        subline: `${targetStopName || '当バス停'}へ向けて走行中${delayStr}`,
        shortBadge: `${stopsAway}個前走行中`
      };
    }
  }

  if (status === 'passed') {
    return {
      headline: `当バス停【${targetStopName || '現在地'}】を通過済み`,
      subline: `次の運行便をご確認ください`,
      shortBadge: `通過済み`
    };
  }

  // scheduled (運行前・予定)
  return {
    headline: `運行予定便（始発より定刻運行中）`,
    subline: `所定の時刻表通りに到着する見込みです`,
    shortBadge: `運行予定`
  };
}

// =========================================================================
// 3. バス在線位置・ステップタイムライン計算コアクラス
// =========================================================================

export class BusLocationService {
  constructor(config = CONFIG) {
    this.config = config;
  }

  /**
   * ポールIDまたは識別子から停留所名を取得する
   * @param {string} poleId
   * @returns {string}
   */
  getStopName(poleId) {
    return getStopNameFromPole(poleId);
  }

  /**
   * 系統パターンと方向に対応する停留所リストを取得する
   * @param {string} routePatternId
   * @param {'outbound'|'inbound'|null} [direction=null]
   * @returns {Array<string>}
   */
  getRouteStops(routePatternId, direction = null) {
    return getStopsForRoute(routePatternId, direction);
  }

  /**
   * 運行中バス (`odpt:Bus`) の現在位置と目的停留所から、詳細な在線位置ステータスおよびJR風ステップタイムラインを算出する
   * 
   * @param {Object|null} bus ODPT API odpt:Bus オブジェクトまたはモックオブジェクト
   * @param {string} targetPoleId 目的の停留所ポールIDまたは停留所名
   * @param {string} [routePatternId=null] 運行経路パターンID (省略時はbusから自動判別)
   * @param {Object} [options={}] オプション設定 (maxTimelineNodes: 表示ノード数, direction: 運行方向)
   * @returns {{
   *   stopsAway: number|null,
   *   status: 'at_stop'|'approaching'|'en_route'|'passed'|'scheduled',
   *   statusText: string,
   *   fromStopName: string,
   *   toStopName: string,
   *   delayMinutes: number,
   *   delaySeconds: number,
   *   delayText: string,
   *   timelineNodes: Array<{
   *     name: string,
   *     poleId: string|null,
   *     isTarget: boolean,
   *     state: 'passed'|'current'|'approaching'|'upcoming'|'target',
   *     relText: string,
   *     stopsAway: number
   *   }>,
   *   busSegmentIndex: number,
   *   busMarkerPercent: number
   * }}
   */
  getBusLocationStatus(bus, targetPoleId, routePatternId = null, options = {}) {
    const maxNodes = options.maxTimelineNodes || 4;
    const direction = options.direction || null;

    // 目的停留所名
    const targetStopName = getStopNameFromPole(targetPoleId);
    const dest = options.destination || bus?.['odpt:destinationBusstopPole'] || bus?.['odpt:terminalBusstopPole'] || '';

    // 1. バスデータが存在しない、または位置情報がない場合 (運行前/予定)
    if (!bus || (!bus['odpt:fromBusstopPole'] && !bus['odpt:toBusstopPole'] && !bus.fromStop && !bus.toStop)) {
      const rawDelay = bus?.['odpt:delay'] ?? bus?.delaySeconds ?? 0;
      const safeDelay = (typeof rawDelay === 'number' && Number.isFinite(rawDelay)) ? rawDelay : 0;
      const delayInfo = formatDelayText(safeDelay);
      const locSummary = formatLocationSummary('scheduled', null, '', '', targetStopName, delayInfo.delayMinutes);
      return {
        stopsAway: null,
        status: 'scheduled',
        statusText: '運行前/予定',
        locationSummary: locSummary,
        fromStopName: '',
        toStopName: '',
        delayMinutes: delayInfo.delayMinutes,
        delaySeconds: safeDelay,
        delayText: delayInfo.delayText,
        timelineNodes: this._createDefaultTimelineNodes(targetStopName, routePatternId, direction, maxNodes, targetPoleId, dest),
        busSegmentIndex: -1,
        busMarkerPercent: 0
      };
    }

    // 2. バス情報の抽出
    const rawFromPole = bus['odpt:fromBusstopPole'] || bus.fromStop || bus.fromPole || '';
    const rawToPole = bus['odpt:toBusstopPole'] || bus.toStop || bus.toPole || '';
    
    // 具体的なパターンコード（11100, 13303等）を汎用系統名（111系統等）より優先
    let pattern = bus['odpt:busroutePattern'] || bus.routePattern || routePatternId || bus['odpt:busroute'] || '';
    if (typeof routePatternId === 'string' && (routePatternId.includes('1110') || routePatternId.includes('1330') || routePatternId.includes('0640'))) {
      pattern = routePatternId;
    }

    const fromStopName = getStopNameFromPole(rawFromPole);
    const toStopName = getStopNameFromPole(rawToPole);

    const rawDelay = (typeof bus['odpt:delay'] === 'number') ? bus['odpt:delay'] : (bus.delaySeconds || 0);
    const delaySec = (typeof rawDelay === 'number' && Number.isFinite(rawDelay)) ? rawDelay : 0;
    const { delayMinutes, delayText } = formatDelayText(delaySec);

    // 3. 系統の全停留所順序リストを取得
    const stopsList = getStopsForRoute(pattern, direction, targetPoleId, dest);

    // 4. 各停留所のインデックス特定
    const targetIdx = findStopIndex(stopsList, targetStopName);
    const fromIdx = findStopIndex(stopsList, fromStopName);
    const toIdx = findStopIndex(stopsList, toStopName);

    // 5. 相対位置およびステータス判定
    let status = 'en_route';
    let stopsAway = null;

    if (targetIdx !== -1) {
      // 目的停留所がルート内に存在する場合の高精度判定
      if (fromIdx !== -1) {
        if (fromIdx > targetIdx) {
          // すでに当停留所を通過済
          status = 'passed';
          stopsAway = null;
        } else if (fromIdx === targetIdx) {
          // 当停留所に到着/停車中
          status = 'at_stop';
          stopsAway = 0;
        } else {
          // 当停留所の手前を運行中
          const diff = targetIdx - fromIdx;
          if (diff === 1 || (toIdx !== -1 && toIdx === targetIdx)) {
            // 1つ前の停留所を出発し、当停留所へ向かっている
            status = 'approaching';
            stopsAway = 1;
          } else {
            // 2個以上手前を運行中
            status = 'en_route';
            stopsAway = diff;
          }
        }
      } else if (toIdx !== -1) {
        // fromIdx が不明だが toIdx が特定できた場合
        if (toIdx > targetIdx) {
          status = 'passed';
          stopsAway = null;
        } else if (toIdx === targetIdx) {
          status = 'approaching';
          stopsAway = 1;
        } else {
          status = 'en_route';
          stopsAway = targetIdx - toIdx + 1;
        }
      }
    } else {
      // ルート内に目的停留所が見つからない場合のフォールバック
      if (fromStopName === targetStopName) {
        status = 'at_stop';
        stopsAway = 0;
      } else if (toStopName === targetStopName) {
        status = 'approaching';
        stopsAway = 1;
      } else {
        status = 'en_route';
        stopsAway = null;
      }
    }

    // 終着停留所到着等のエッジケース処理
    if (!rawToPole && rawFromPole && fromStopName === targetStopName) {
      status = 'at_stop';
      stopsAway = 0;
    }

    const statusText = formatStatusText(status, stopsAway, fromStopName, toStopName);
    const locationSummary = formatLocationSummary(status, stopsAway, fromStopName, toStopName, targetStopName, delayMinutes);

    // 6. JR風ステップタイムラインノード配列の生成
    const { timelineNodes, busSegmentIndex, busMarkerPercent } = this._buildTimelineNodes(
      stopsList,
      fromIdx,
      toIdx,
      targetIdx,
      targetStopName,
      status,
      stopsAway,
      maxNodes
    );

    return {
      stopsAway,
      status,
      statusText,
      locationSummary,
      fromStopName,
      toStopName,
      delayMinutes,
      delaySeconds: delaySec,
      delayText,
      timelineNodes,
      busSegmentIndex,
      busMarkerPercent
    };
  }

  /**
   * 直近3〜4停留所のJR風ステップタイムラインノード列およびバスマーカー位置を動的に生成する
   * @private
   */
  _buildTimelineNodes(stopsList, fromIdx, toIdx, targetIdx, targetStopName, status, stopsAway, maxNodes = 4) {
    if (!Array.isArray(stopsList) || stopsList.length === 0 || targetIdx === -1) {
      return {
        timelineNodes: [
          { name: targetStopName, poleId: null, isTarget: true, state: 'target', relText: '当バス停', subLabel: '乗車位置', stopsAway: 0 }
        ],
        busSegmentIndex: -1,
        busMarkerPercent: 0
      };
    }

    // スライスの開始インデックスを決定 (目的停留所を含む直近 maxNodes 個)
    // 走行中バスの fromIdx がさらに手前にある場合も考慮
    let startIdx = Math.max(0, targetIdx - (maxNodes - 1));
    if (fromIdx !== -1 && fromIdx < targetIdx) {
      // 走行中の区間がタイムラインに見えるように調整
      startIdx = Math.max(0, Math.min(fromIdx, targetIdx - (maxNodes - 1)));
    }
    const endIdx = targetIdx;

    const slicedStops = stopsList.slice(startIdx, endIdx + 1);
    
    // 各ノードのステート構築
    const timelineNodes = slicedStops.map((stopName, i) => {
      const actualIdx = startIdx + i;
      const isTarget = (actualIdx === targetIdx);
      const relStops = targetIdx - actualIdx;

      let state = 'upcoming';
      let relText = `${relStops}個前`;
      let subLabel = `${relStops}個前`;

      if (isTarget) {
        relText = '当バス停';
        subLabel = (status === 'at_stop') ? '現在停車中' : '乗車位置';
        if (status === 'at_stop') {
          state = 'current';
        } else {
          state = 'target';
        }
      } else if (actualIdx < fromIdx) {
        state = 'passed';
        subLabel = '通過済';
      } else if (actualIdx === fromIdx) {
        state = (status === 'at_stop') ? 'current' : 'passed';
        subLabel = (status === 'at_stop') ? '停車中' : '発車済';
      } else if (actualIdx === toIdx) {
        state = 'approaching';
        subLabel = '次到着';
      }

      return {
        name: stopName,
        index: actualIdx,
        isTarget,
        state,
        relText,
        subLabel,
        stopsAway: relStops
      };
    });

    // どの区間（ノード間: 0 〜 timelineNodes.length - 2）にバスがいるかを算出
    let busSegmentIndex = -1;
    let busMarkerPercent = 50; // 区間中央

    if (status === 'at_stop') {
      busSegmentIndex = timelineNodes.findIndex(n => n.isTarget);
      busMarkerPercent = 100;
    } else if (status === 'approaching') {
      busSegmentIndex = timelineNodes.length - 2; // 当停留所直前の区間
      busMarkerPercent = 65; // 到着間近
    } else if (status === 'en_route' && fromIdx !== -1) {
      const seg = fromIdx - startIdx;
      if (seg >= 0 && seg < timelineNodes.length - 1) {
        busSegmentIndex = seg;
        busMarkerPercent = 50;
      }
    }

    return {
      timelineNodes,
      busSegmentIndex,
      busMarkerPercent
    };
  }

  /**
   * 運行前/待機時用のデフォルトタイムラインノード列を生成する
   * @private
   */
  _createDefaultTimelineNodes(targetStopName, routePatternId, direction, maxNodes = 4, targetPoleId = null, destination = null) {
    const stopsList = getStopsForRoute(routePatternId, direction, targetPoleId, destination);
    const targetIdx = findStopIndex(stopsList, targetStopName);

    if (targetIdx === -1 || !stopsList.length) {
      return [
        { name: targetStopName, isTarget: true, state: 'target', relText: '当バス停', subLabel: '乗車位置', stopsAway: 0 }
      ];
    }

    const startIdx = Math.max(0, targetIdx - (maxNodes - 1));
    const sliced = stopsList.slice(startIdx, targetIdx + 1);

    return sliced.map((stopName, i) => {
      const actualIdx = startIdx + i;
      const isTarget = (actualIdx === targetIdx);
      const relStops = targetIdx - actualIdx;

      return {
        name: stopName,
        index: actualIdx,
        isTarget,
        state: isTarget ? 'target' : 'upcoming',
        relText: isTarget ? '当バス停' : `${relStops}個前`,
        subLabel: isTarget ? '乗車位置' : `${relStops}個前`,
        stopsAway: relStops
      };
    });
  }

  /**
   * 縦型路線マップ用: 停留所縦ラインと、各区間に存在する全運行中バス（複数台）のマッピングデータを生成する
   * @param {Object} [options={}] オプション設定
   * @returns {{
   *   targetStopName: string,
   *   targetPoleId: string,
   *   routeName: string,
   *   directionName: string,
   *   activeBusCount: number,
   *   stops: Array<{
   *     name: string,
   *     index: number,
   *     isTarget: boolean,
   *     isPassed: boolean,
   *     relText: string,
   *     busesAtStop: Array<Object>,
   *     busesEnRouteToNext: Array<Object>
   *   }>
   * }}
   */
  getVerticalRouteMap(realtimeBuses = [], targetPoleId = '', routePatternId = null, options = {}) {
    const targetStopName = getStopNameFromPole(targetPoleId);
    const direction = options.direction || null;
    const destination = options.destination || null;

    // 1. 路線全停留所リストを取得
    const fullStops = getStopsForRoute(routePatternId, direction, targetPoleId, destination);
    const targetIdx = findStopIndex(fullStops, targetStopName);

    // 2. 表示範囲の決定（始発から終点まで、または当停留所を中心とした見やすい区間）
    let startIdx = 0;
    let endIdx = fullStops.length - 1;

    if (targetIdx !== -1) {
      // ユーザーの当停留所の手前最大6停留所〜通過後2停留所をフォーカス（見やすさ最適化）
      startIdx = Math.max(0, targetIdx - 6);
      endIdx = Math.min(fullStops.length - 1, targetIdx + 2);
    }

    const slicedStops = fullStops.slice(startIdx, endIdx + 1);

    // 3. 路線上のバスをスキャンしてマッピング
    const lineMatcher = routePatternId ? String(routePatternId).replace(/[^0-9]/g, '') : '';
    let activeBusCount = 0;

    // 停留所データ構造の初期化
    const stopNodes = slicedStops.map((stopName, i) => {
      const actualIdx = startIdx + i;
      const isTarget = (actualIdx === targetIdx);
      const isPassed = (targetIdx !== -1 && actualIdx > targetIdx);
      const diff = targetIdx !== -1 ? (targetIdx - actualIdx) : null;

      let relText = '';
      if (isTarget) {
        relText = '当バス停 (乗車位置)';
      } else if (diff !== null && diff > 0) {
        relText = `${diff}個前`;
      } else if (diff !== null && diff < 0) {
        relText = `${Math.abs(diff)}個先`;
      }

      return {
        name: stopName,
        index: actualIdx,
        isTarget,
        isPassed,
        relText,
        busesAtStop: [],
        busesEnRouteToNext: []
      };
    });

    if (Array.isArray(realtimeBuses) && realtimeBuses.length > 0) {
      for (const bus of realtimeBuses) {
        if (!bus) continue;

        const rawFrom = bus['odpt:fromBusstopPole'] || bus.fromStop || '';
        const rawTo = bus['odpt:toBusstopPole'] || bus.toStop || '';
        if (!rawFrom && !rawTo) continue;

        // 系統マッチング (111系統, 133系統, 64系統)
        const busRouteStr = bus['odpt:busroute'] || bus['odpt:busroutePattern'] || bus['owl:sameAs'] || '';
        const busLineNum = busRouteStr.replace(/[^0-9]/g, '');

        if (lineMatcher && busLineNum && !busLineNum.includes(lineMatcher) && !lineMatcher.includes(busLineNum)) {
          continue;
        }

        const fromName = getStopNameFromPole(rawFrom);
        const toName = getStopNameFromPole(rawTo);
        const fromStopIdx = findStopIndex(fullStops, fromName);
        const toStopIdx = findStopIndex(fullStops, toName);

        const rawDelay = (typeof bus['odpt:delay'] === 'number') ? bus['odpt:delay'] : (bus.delaySeconds || 0);
        const delayInfo = formatDelayText(rawDelay);

        const busLine = (bus['odpt:busroute'] || '').includes('133') ? '133系統' :
          (bus['odpt:busroute'] || '').includes('64') ? '64系統' : '111系統';
        const busDest = busLocationService.getStopName(bus['odpt:terminalBusstopPole'] || bus['odpt:destinationBusstopPole'] || destination || '');

        const busObj = {
          busId: bus['@id'] || bus['owl:sameAs'] || 'live-bus',
          line: busLine,
          destination: busDest ? `${busDest}行` : '',
          delayMinutes: delayInfo.delayMinutes,
          delayText: delayInfo.delayText,
          delayClass: delayInfo.delayMinutes > 0 ? 'delay-some' : 'delay-none',
          fromStopName: fromName,
          toStopName: toName,
          label: `${busLine} ${busDest ? busDest + '行' : ''} (${delayInfo.delayText})`
        };

        // 停車中判定 (fromName が一致し toName が空、または terminal 到着)
        if (fromStopIdx !== -1 && (!toName || fromStopIdx === toStopIdx)) {
          const node = stopNodes.find(n => n.index === fromStopIdx);
          if (node) {
            node.busesAtStop.push(busObj);
            activeBusCount++;
          }
        } else if (fromStopIdx !== -1) {
          // 区間走行中
          const node = stopNodes.find(n => n.index === fromStopIdx);
          if (node) {
            busObj.isApproachingTarget = (fromStopIdx === targetIdx - 1);
            node.busesEnRouteToNext.push(busObj);
            activeBusCount++;
          }
        }
      }
    }

    const routeTitle = routePatternId ? `${routePatternId}` : '横浜市営バス';
    const destName = destination ? `${destination}` : (fullStops[fullStops.length - 1] || '');

    return {
      targetStopName,
      targetPoleId,
      routeName: routeTitle,
      directionName: destName ? `${destName} 方面` : '',
      activeBusCount,
      stops: stopNodes
    };
  }

  /**
   * 手前5停留所（当停留所＋手前5つ＝6停留所）の接近プログレスバー用データを生成する
   * 
   * @param {Array} realtimeBuses リアルタイムバス配列
   * @param {'yokodai'|'koizumi'|'kamiooka'} stopKey
   * @returns {{
   *   targetStopName: string,
   *   targetStopKey: string,
   *   isTerminus: boolean,
   *   activeBus: Object|null,
   *   status: 'scheduled'|'at_stop'|'approaching'|'en_route'|'passed',
   *   statusText: string,
   *   stopsAway: number|null,
   *   delayMinutes: number,
   *   delayText: string,
   *   stops: Array<{
   *     name: string,
   *     isTarget: boolean,
   *     isPassed: boolean,
   *     isCurrent: boolean,
   *     relText: string
   *   }>,
   *   busPosition: {
   *     segmentIndex: number, // 0..4 (ノード間) または -1
   *     percent: number,      // 0..100
   *     isAtStop: boolean,
   *     atStopIndex: number
   *   }
   * }}
   */
  get5StopApproachingStatus(realtimeBuses = [], stopKey = 'yokodai') {
    if (stopKey === 'kamiooka') {
      return {
        targetStopName: '上大岡駅前',
        targetStopKey: 'kamiooka',
        isTerminus: true,
        activeBus: null,
        status: 'scheduled',
        statusText: '当駅始発',
        stopsAway: 0,
        delayMinutes: 0,
        delayText: '定刻',
        stops: [],
        busPosition: { segmentIndex: -1, percent: 0, isAtStop: true, atStopIndex: 0 }
      };
    }

    const isYokodai = (stopKey === 'yokodai');
    const targetStopName = isYokodai ? '洋光台北口' : '古泉';
    const lineKey = isYokodai ? '111' : '133';
    const targetPoleId = isYokodai ? '7800.1' : '1810.1';
    const dirToKamiooka = isYokodai ? 'outbound' : 'inbound';

    // 6つの停留所シーケンスを定義 (左から右: 手前5つ ➔ 当停留所)
    const stopSequence = isYokodai
      ? ['バイパス下', '洋光台五丁目', '洋光台駅前', '西公園前', '洋光台二丁目', '洋光台北口']
      : ['坂下公園前', '滝頭', '市電保存館前', '滝頭地域ケアプラザ前', '仲之町', '古泉'];

    // 全ルートリスト（インデックス計算用）
    const fullStops = getStopsForRoute(lineKey, dirToKamiooka, targetPoleId, '上大岡駅前');
    const targetIdx = findStopIndex(fullStops, targetStopName);

    // 該当路線・上大岡行きのバスから、当停留所に最も近いバスを探す
    let closestBus = null;
    let closestStatus = null;
    let minStopsAway = 999;

    if (Array.isArray(realtimeBuses)) {
      for (const bus of realtimeBuses) {
        if (!bus) continue;
        const busRouteStr = bus['odpt:busroute'] || bus['odpt:busroutePattern'] || '';
        if (!busRouteStr.includes(lineKey)) continue;

        // 行先チェック (上大岡駅前 行)
        const dest = getStopNameFromPole(bus['odpt:destinationBusstopPole'] || bus['odpt:terminalBusstopPole'] || '');
        if (dest && !dest.includes('上大岡') && !dest.includes('磯子')) {
          // 港南台行きや根岸行きは除外
          continue;
        }

        const status = this.getBusLocationStatus(bus, targetPoleId, lineKey, {
          direction: dirToKamiooka,
          destination: '上大岡駅前',
          maxTimelineNodes: 6
        });

        if (status.status !== 'passed' && status.status !== 'scheduled') {
          const away = status.stopsAway ?? 99;
          if (away < minStopsAway) {
            minStopsAway = away;
            closestBus = bus;
            closestStatus = status;
          }
        }
      }
    }

    // バスが見つからなかった場合はデフォルト予定状態
    if (!closestBus || !closestStatus) {
      const defaultStatus = this.getBusLocationStatus(null, targetPoleId, lineKey, {
        direction: dirToKamiooka,
        destination: '上大岡駅前',
        maxTimelineNodes: 6
      });

      const stops = stopSequence.map((name, i) => {
        const isTarget = (i === stopSequence.length - 1);
        const rel = stopSequence.length - 1 - i;
        return {
          name,
          isTarget,
          isPassed: false,
          isCurrent: false,
          relText: isTarget ? '当バス停' : `${rel}個前`
        };
      });

      return {
        targetStopName,
        targetStopKey: stopKey,
        isTerminus: false,
        activeBus: null,
        status: 'scheduled',
        statusText: '運行予定',
        stopsAway: null,
        delayMinutes: 0,
        delayText: '定刻',
        stops,
        busPosition: { segmentIndex: -1, percent: 0, isAtStop: false, atStopIndex: -1 }
      };
    }

    // 走行中バスの位置を stopSequence (0..5) 上の座標にマッピング
    const fromName = closestStatus.fromStopName;
    const toName = closestStatus.toStopName;
    const seqFromIdx = stopSequence.indexOf(fromName);
    const seqToIdx = stopSequence.indexOf(toName);

    let segmentIndex = -1;
    let percent = 50;
    let isAtStop = false;
    let atStopIndex = -1;

    if (closestStatus.status === 'at_stop') {
      isAtStop = true;
      atStopIndex = (seqFromIdx !== -1) ? seqFromIdx : (stopSequence.length - 1);
    } else if (closestStatus.status === 'approaching') {
      segmentIndex = stopSequence.length - 2; // 最後の区間
      percent = 70;
    } else if (closestStatus.status === 'en_route') {
      if (seqFromIdx !== -1 && seqFromIdx < stopSequence.length - 1) {
        segmentIndex = seqFromIdx;
        percent = 50;
      } else if (seqToIdx !== -1 && seqToIdx > 0) {
        segmentIndex = seqToIdx - 1;
        percent = 50;
      } else {
        // 5つ前よりさらに手前
        segmentIndex = -1;
        percent = 0;
      }
    }

    const stops = stopSequence.map((name, i) => {
      const isTarget = (i === stopSequence.length - 1);
      const isCurrent = (isAtStop && atStopIndex === i);
      const isPassed = (!isAtStop && segmentIndex !== -1 && segmentIndex > i) || (isAtStop && atStopIndex > i);
      const rel = stopSequence.length - 1 - i;

      return {
        name,
        isTarget,
        isPassed,
        isCurrent,
        relText: isTarget ? '当バス停' : `${rel}個前`
      };
    });

    return {
      targetStopName,
      targetStopKey: stopKey,
      isTerminus: false,
      activeBus: closestBus,
      status: closestStatus.status,
      statusText: closestStatus.statusText,
      stopsAway: closestStatus.stopsAway,
      delayMinutes: closestStatus.delayMinutes,
      delayText: closestStatus.delayText,
      stops,
      busPosition: {
        segmentIndex,
        percent,
        isAtStop,
        atStopIndex
      }
    };
  }

  /**
   * JR東日本アプリ風: 上下線2本立て（複線）縦型路線図データを生成する
   * 
   * @param {Array} realtimeBuses ODPT API odpt:Bus オブジェクト配列
   * @param {'111'|'133'} lineKey '111' または '133'
   * @returns {{
   *   lineKey: string,
   *   lineTitle: string,
   *   upboundLabel: string,
   *   downboundLabel: string,
   *   upboundBusCount: number,
   *   downboundBusCount: number,
   *   totalBusCount: number,
   *   stops: Array<{
   *     name: string,
   *     isMajor: boolean,
   *     index: number,
   *     upboundBusesAtStop: Array<Object>,
   *     upboundBusesEnRoute: Array<Object>,
   *     downboundBusesAtStop: Array<Object>,
   *     downboundBusesEnRoute: Array<Object>
   *   }>
   * }}
   */
  getDoubleTrackRouteMap(realtimeBuses = [], lineKey = '111') {
    const isLine111 = (lineKey === '111');
    const lineTitle = isLine111 ? '111系統' : '133系統';
    const upboundLabel = '上大岡駅前 方面 (上り)';
    const downboundLabel = isLine111 ? '港南台駅前 方面 (下り)' : '根岸駅前 方面 (下り)';

    // 上（上大岡駅前）から下（港南台/根岸）への順序マスター
    const stopMasterList = isLine111
      ? [
        '上大岡駅前', '関の下', '笹下港南中央通', '港南区総合庁舎前', '吉原',
        '新吉原橋', '日野公園墓地入口', '日野中央公園入口', '洋光台北口',
        '洋光台二丁目', '西公園前', '洋光台駅前', '洋光台五丁目', 'バイパス下',
        '港南台第一中学校前', '港南台第一小学校前', '臼杵', '港南環境センター前',
        '榎戸', '横浜女子短大前', '港南台駅前'
      ]
      : [
        '上大岡駅前', '最戸橋', '越戸橋', '向田橋', '大岡交番前', '万福寺前',
        '上笹堀', '横浜岡村郵便局前', '天神前', '岡村町', '古泉', '仲之町',
        '滝頭地域ケアプラザ前', '市電保存館前', '滝頭', '坂下公園前', '下町',
        'プールセンター前', '根岸駅前'
      ];

    const majorStops = isLine111
      ? ['上大岡駅前', '洋光台北口', '洋光台駅前', '港南台駅前']
      : ['上大岡駅前', '古泉', '滝頭', '根岸駅前'];

    // 停留所オブジェクト配列の初期化
    const stops = stopMasterList.map((name, idx) => ({
      name,
      index: idx,
      isMajor: majorStops.includes(name),
      upboundBusesAtStop: [],
      upboundBusesEnRoute: [],
      downboundBusesAtStop: [],
      downboundBusesEnRoute: []
    }));

    let upboundBusCount = 0;
    let downboundBusCount = 0;

    if (Array.isArray(realtimeBuses)) {
      for (const bus of realtimeBuses) {
        if (!bus) continue;

        const busRouteStr = bus['odpt:busroute'] || bus['odpt:busroutePattern'] || '';
        if (!busRouteStr.includes(lineKey)) continue;

        const rawFrom = bus['odpt:fromBusstopPole'] || bus.fromStop || '';
        const rawTo = bus['odpt:toBusstopPole'] || bus.toStop || '';
        if (!rawFrom && !rawTo) continue;

        const fromName = getStopNameFromPole(rawFrom);
        const toName = getStopNameFromPole(rawTo);
        const fromIdx = stopMasterList.indexOf(fromName);
        const toIdx = stopMasterList.indexOf(toName);

        const destName = getStopNameFromPole(bus['odpt:destinationBusstopPole'] || bus['odpt:terminalBusstopPole'] || '');
        const patternStr = bus['odpt:busroutePattern'] || '';
        const isUpbound =
          destName.includes('上大岡') ||
          patternStr.includes('11100') ||
          patternStr.includes('13300') ||
          (fromIdx !== -1 && toIdx !== -1 && fromIdx > toIdx);

        const rawDelay = (typeof bus['odpt:delay'] === 'number') ? bus['odpt:delay'] : (bus.delaySeconds || 0);
        const delayInfo = formatDelayText(rawDelay);

        const busObj = {
          busId: bus['@id'] || bus['owl:sameAs'] || 'live-bus',
          line: lineTitle,
          direction: isUpbound ? 'upbound' : 'downbound',
          dest: destName || (isUpbound ? '上大岡駅前' : (isLine111 ? '港南台駅前' : '根岸駅前')),
          fromStopName: fromName,
          toStopName: toName,
          delayMinutes: delayInfo.delayMinutes,
          delayText: delayInfo.delayText,
          delayClass: delayInfo.delayMinutes > 0 ? 'delay-some' : 'delay-none'
        };

        if (isUpbound) {
          upboundBusCount++;
          // 上り: 下から上 (fromIdx > toIdx)
          if (fromIdx !== -1 && (!toName || fromIdx === toIdx)) {
            // 停車中
            if (stops[fromIdx]) stops[fromIdx].upboundBusesAtStop.push(busObj);
          } else if (fromIdx !== -1) {
            // 区間走行中 (fromIdx から 上へ向かう)
            if (stops[fromIdx]) stops[fromIdx].upboundBusesEnRoute.push(busObj);
          }
        } else {
          downboundBusCount++;
          // 下り: 上から下 (fromIdx < toIdx)
          if (fromIdx !== -1 && (!toName || fromIdx === toIdx)) {
            // 停車中
            if (stops[fromIdx]) stops[fromIdx].downboundBusesAtStop.push(busObj);
          } else if (fromIdx !== -1) {
            // 区間走行中 (fromIdx から 下へ向かう)
            if (stops[fromIdx]) stops[fromIdx].downboundBusesEnRoute.push(busObj);
          }
        }
      }
    }

    return {
      lineKey,
      lineTitle,
      upboundLabel,
      downboundLabel,
      upboundBusCount,
      downboundBusCount,
      totalBusCount: upboundBusCount + downboundBusCount,
      stops
    };
  }
}

// シングルトンインスタンスのエクスポート
export const busLocationService = new BusLocationService();
export default busLocationService;

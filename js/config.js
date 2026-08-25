/**
 * config.js
 * Configuration constants, API endpoints, storage keys, stops & route definitions.
 * Yokohama Municipal Bus Transit Guide & Real-Time Operation Web App
 */

export const API_BASE = 'https://api.odpt.org/api/v4/';
export const DEFAULT_CONSUMER_KEY = '';
export const OPERATOR = 'odpt.Operator:YokohamaMunicipal';
export const OPERATOR_ID = 'odpt.Operator:YokohamaMunicipal';

export const DEFAULT_TRANSFER_BUFFER_MINUTES = 0;
export const DEFAULT_BUFFER_MINUTES = 0;
export const DEFAULT_POLLING_INTERVAL_SEC = 30;
export const POLLING_INTERVAL_SEC = 30;

export const STORAGE_KEYS = {
  API_KEY: 'transporter_api_key',
  TRANSFER_BUFFER: 'transporter_transfer_buffer',
  BUFFER: 'transporter_transfer_buffer',
  THEME: 'transporter_theme',
  AUTO_REFRESH: 'transporter_auto_refresh',
  AUTO_POLL: 'transporter_auto_refresh',
  CACHE_PREFIX: 'transporter_cache_',
  CACHE_TIMETABLE: 'transporter_cache_timetable_',
  CACHE_STOPS: 'transporter_cache_stops',
  ROUTE_FILTER: 'transporter_route_filter',
  LAST_DIRECTION: 'transporter_last_direction'
};

export const STOPS = {
  YOKODAI: {
    id: 'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1',
    sameAs: 'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1',
    name: '洋光台北口',
    nameEn: 'Yokodai-Kitaguchi',
    nameKana: 'ようこうだいきたぐち',
    poleNumber: '1',
    routes: ['111'],
    lat: 35.3831,
    long: 139.5985
  },
  KAMIOOKA: {
    id: 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6',
    sameAs: 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6',
    idArrival: 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.13',
    name: '上大岡駅前',
    nameEn: 'Kamiooka-Ekimae',
    nameKana: 'かみおおおかえきまえ',
    poleNumber: '6',
    arrivalPoleNumber: '13',
    routes: ['111', '133'],
    lat: 35.4086,
    long: 139.5964
  },
  KOIZUMI: {
    id: 'odpt.BusstopPole:YokohamaMunicipal.Koizumi.1810.1',
    sameAs: 'odpt.BusstopPole:YokohamaMunicipal.Koizumi.1810.1',
    idInbound: 'odpt.BusstopPole:YokohamaMunicipal.Koizumi.1810.1',
    name: '古泉',
    nameEn: 'Koizumi',
    nameKana: 'こいずみ',
    poleNumber: '1',
    inboundPoleNumber: '1',
    routes: ['133'],
    lat: 35.4215,
    long: 139.6152
  }
};

export const ROUTES = {
  ROUTE_111: {
    id: 'odpt.Busroute:YokohamaMunicipal.111',
    name: '111系統',
    line: '111系統',
    patternOutbound: 'odpt.BusroutePattern:YokohamaMunicipal.11100.10_1',
    patternInbound: 'odpt.BusroutePattern:YokohamaMunicipal.11101.10_1',
    destOutbound: '上大岡駅前',
    destInbound: '港南台駅前',
    durationMinutes: 15,
    // 主要停留所リスト (後方互換性)
    stops: [
      '洋光台北口',
      '日野中央公園入口',
      '日野公園墓地入口',
      '新吉原橋',
      '吉原',
      '港南区総合庁舎前',
      '笹下港南中央通',
      '関の下',
      '上大岡駅前'
    ],
    // 往路 (上大岡駅前行: 全21停留所)
    stopsOutbound: [
      '港南台駅前',
      '横浜女子短大前',
      '榎戸',
      '港南環境センター前',
      '臼杵',
      '港南台第一小学校前',
      '港南台第一中学校前',
      'バイパス下',
      '洋光台五丁目',
      '洋光台駅前',
      '西公園前',
      '洋光台二丁目',
      '洋光台北口',
      '日野中央公園入口',
      '日野公園墓地入口',
      '新吉原橋',
      '吉原',
      '港南区総合庁舎前',
      '笹下港南中央通',
      '関の下',
      '上大岡駅前'
    ],
    // 復路 (港南台駅前行: 全21停留所)
    stopsInbound: [
      '上大岡駅前',
      '関の下',
      '笹下港南中央通',
      '港南区総合庁舎前',
      '吉原',
      '新吉原橋',
      '日野公園墓地入口',
      '日野中央公園入口',
      '洋光台北口',
      '洋光台二丁目',
      '西公園前',
      '洋光台駅前',
      '洋光台五丁目',
      'バイパス下',
      '港南台第一中学校前',
      '港南台第一小学校前',
      '臼杵',
      '港南環境センター前',
      '榎戸',
      '横浜女子短大前',
      '港南台駅前'
    ]
  },
  ROUTE_133: {
    id: 'odpt.Busroute:YokohamaMunicipal.133',
    name: '133系統',
    line: '133系統',
    patternOutbound: 'odpt.BusroutePattern:YokohamaMunicipal.13303.08_1',
    patternInbound: 'odpt.BusroutePattern:YokohamaMunicipal.13300.08_1',
    destOutbound: '根岸駅前',
    destInbound: '上大岡駅前',
    via: '古泉',
    durationMinutes: 12,
    // 主要停留所リスト (後方互換性)
    stops: [
      '上大岡駅前',
      '最戸橋',
      '越戸橋',
      '向田橋',
      '大岡交番前',
      '万福寺前',
      '上笹堀',
      '横浜岡村郵便局前',
      '天神前',
      '岡村町',
      '古泉',
      '仲之町',
      '滝頭',
      '根岸駅前'
    ],
    // 往路 (上大岡駅前発 根岸駅前行: 全19停留所)
    stopsOutbound: [
      '上大岡駅前',
      '最戸橋',
      '越戸橋',
      '向田橋',
      '大岡交番前',
      '万福寺前',
      '上笹堀',
      '横浜岡村郵便局前',
      '天神前',
      '岡村町',
      '古泉',
      '仲之町',
      '滝頭地域ケアプラザ前',
      '市電保存館前',
      '滝頭',
      '坂下公園前',
      '下町',
      'プールセンター前',
      '根岸駅前'
    ],
    // 復路 (根岸駅前発 上大岡駅前行: 全18停留所)
    stopsInbound: [
      '根岸駅前',
      'プールセンター前',
      '下町',
      '坂下公園前',
      '滝頭',
      '市電保存館前',
      '滝頭地域ケアプラザ前',
      '仲之町',
      '古泉',
      '岡村町',
      '天神前',
      '横浜岡村郵便局前',
      '上笹堀',
      '万福寺前',
      '向田橋',
      '越戸橋',
      '最戸橋',
      '上大岡駅前'
    ]
  },
  ROUTE_64: {
    id: 'odpt.Busroute:YokohamaMunicipal.064',
    name: '64系統',
    line: '64系統',
    patternOutbound: 'odpt.BusroutePattern:YokohamaMunicipal.06400.10_4',
    patternInbound: 'odpt.BusroutePattern:YokohamaMunicipal.06406.10_1',
    destOutbound: '磯子駅前',
    destInbound: '港南台駅前',
    durationMinutes: 12,
    // 主要停留所リスト (後方互換性)
    stops: [
      '上大岡駅前',
      '港南区総合庁舎前',
      '日野',
      '清水橋',
      '港南台駅前'
    ],
    // 往路 (港南台駅前発 上大岡経由 磯子駅前行)
    stopsOutbound: [
      '港南台駅前',
      '清水橋',
      '日野',
      '日野中央公園入口',
      '日野公園墓地入口',
      '新吉原橋',
      '吉原',
      '港南区総合庁舎前',
      '笹下港南中央通',
      '関の下',
      '上大岡駅前',
      '最戸橋',
      '越戸橋',
      '向田橋',
      '大岡交番前',
      '万福寺前',
      '上笹堀',
      '笹堀',
      '磯子駅前'
    ],
    // 復路 (磯子駅前発 上大岡経由 港南台駅前行)
    stopsInbound: [
      '磯子駅前',
      '笹堀',
      '上笹堀',
      '万福寺前',
      '向田橋',
      '越戸橋',
      '最戸橋',
      '上大岡駅前',
      '関の下',
      '笹下港南中央通',
      '港南区総合庁舎前',
      '吉原',
      '新吉原橋',
      '日野公園墓地入口',
      '日野中央公園入口',
      '日野',
      '清水橋',
      '港南台駅前'
    ]
  }
};

export const CACHE_TTL = {
  STATIC_DATA: 7 * 24 * 60 * 60, // 7 days in seconds
  TIMETABLE: 24 * 60 * 60,        // 24 hours in seconds
  REALTIME: 0                    // 0 seconds (never cached)
};

export const CONFIG = {
  API_BASE,
  DEFAULT_CONSUMER_KEY,
  OPERATOR,
  OPERATOR_ID,
  DEFAULT_TRANSFER_BUFFER_MINUTES,
  DEFAULT_BUFFER_MINUTES,
  DEFAULT_POLLING_INTERVAL_SEC,
  POLLING_INTERVAL_SEC,
  STORAGE_KEYS,
  STOPS,
  ROUTES,
  CACHE_TTL
};

export default CONFIG;

/**
 * mock-data.js
 * Comprehensive offline fallback data and schema-compliant ODPT mock engine.
 * Yokohama Municipal Bus Transit Guide & Real-Time Operation Web App
 */

import { STOPS, ROUTES, OPERATOR_ID } from '../config.js';

// =========================================================================
// 1. BusstopPoles (odpt:BusstopPole)
// =========================================================================
export const MOCK_BUSSTOP_POLES = [
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:ucode:_00001C00000000000002000000500111',
    '@type': 'odpt:BusstopPole',
    'owl:sameAs': STOPS.YOKODAI.id,
    'dc:date': '2026-08-22T00:00:00+09:00',
    'dc:title': '洋光台北口',
    'odpt:busstopPoleTitle': {
      ja: '洋光台北口',
      en: 'Yokodai-Kitaguchi',
      'ja-Hrkt': 'ようこうだいきたぐち'
    },
    'odpt:operator': [OPERATOR_ID],
    'odpt:busstopPoleNumber': '1',
    'geo:lat': 35.3831,
    'geo:long': 139.5985,
    'odpt:busroutePattern': [
      ROUTES.ROUTE_111.patternOutbound
    ]
  },
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:ucode:_00001C00000000000002000000500112',
    '@type': 'odpt:BusstopPole',
    'owl:sameAs': STOPS.KAMIOOKA.id,
    'dc:date': '2026-08-22T00:00:00+09:00',
    'dc:title': '上大岡駅前',
    'odpt:busstopPoleTitle': {
      ja: '上大岡駅前',
      en: 'Kamiooka-Ekimae',
      'ja-Hrkt': 'かみおおおかえきまえ'
    },
    'odpt:operator': [OPERATOR_ID],
    'odpt:busstopPoleNumber': '12',
    'geo:lat': 35.4086,
    'geo:long': 139.5964,
    'odpt:busroutePattern': [
      ROUTES.ROUTE_133.patternOutbound,
      ROUTES.ROUTE_64.patternOutbound
    ]
  },
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:ucode:_00001C00000000000002000000500113',
    '@type': 'odpt:BusstopPole',
    'owl:sameAs': STOPS.KAMIOOKA.idArrival,
    'dc:date': '2026-08-22T00:00:00+09:00',
    'dc:title': '上大岡駅前',
    'odpt:busstopPoleTitle': {
      ja: '上大岡駅前',
      en: 'Kamiooka-Ekimae',
      'ja-Hrkt': 'かみおおおかえきまえ'
    },
    'odpt:operator': [OPERATOR_ID],
    'odpt:busstopPoleNumber': '11',
    'geo:lat': 35.4086,
    'geo:long': 139.5964,
    'odpt:busroutePattern': [
      ROUTES.ROUTE_111.patternOutbound
    ]
  },
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:ucode:_00001C00000000000002000000500114',
    '@type': 'odpt:BusstopPole',
    'owl:sameAs': STOPS.KOIZUMI.id,
    'dc:date': '2026-08-22T00:00:00+09:00',
    'dc:title': '古泉',
    'odpt:busstopPoleTitle': {
      ja: '古泉',
      en: 'Koizumi',
      'ja-Hrkt': 'こいずみ'
    },
    'odpt:operator': [OPERATOR_ID],
    'odpt:busstopPoleNumber': '1',
    'geo:lat': 35.4215,
    'geo:long': 139.6152,
    'odpt:busroutePattern': [
      ROUTES.ROUTE_133.patternInbound
    ]
  },
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:ucode:_00001C00000000000002000000500115',
    '@type': 'odpt:BusstopPole',
    'owl:sameAs': STOPS.KOIZUMI.idInbound,
    'dc:date': '2026-08-22T00:00:00+09:00',
    'dc:title': '古泉',
    'odpt:busstopPoleTitle': {
      ja: '古泉',
      en: 'Koizumi',
      'ja-Hrkt': 'こいずみ'
    },
    'odpt:operator': [OPERATOR_ID],
    'odpt:busstopPoleNumber': '2',
    'geo:lat': 35.4215,
    'geo:long': 139.6152,
    'odpt:busroutePattern': [
      ROUTES.ROUTE_133.patternOutbound
    ]
  }
];

// =========================================================================
// 2. BusRoutePatterns (odpt:BusRoutePattern)
// =========================================================================
export const MOCK_ROUTES = [
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:ucode:_00001C00000000000002000000510111',
    '@type': 'odpt:BusRoutePattern',
    'owl:sameAs': ROUTES.ROUTE_111.patternOutbound,
    'dc:title': '111系統 (洋光台北口 ➔ 上大岡駅前)',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_111.id,
    'odpt:direction': '上大岡駅前方面',
    'odpt:busstopPoleOrder': ROUTES.ROUTE_111.stops.map((title, idx) => ({
      'odpt:index': idx + 1,
      'odpt:busstopPoleTitle': { ja: title }
    }))
  },
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:ucode:_00001C00000000000002000000510112',
    '@type': 'odpt:BusRoutePattern',
    'owl:sameAs': ROUTES.ROUTE_111.patternInbound,
    'dc:title': '111系統 (上大岡駅前 ➔ 洋光台北口 ➔ 港南台駅前)',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_111.id,
    'odpt:direction': '港南台駅前方面',
    'odpt:busstopPoleOrder': [...ROUTES.ROUTE_111.stops].reverse().map((title, idx) => ({
      'odpt:index': idx + 1,
      'odpt:busstopPoleTitle': { ja: title }
    }))
  },
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:ucode:_00001C00000000000002000000510133',
    '@type': 'odpt:BusRoutePattern',
    'owl:sameAs': ROUTES.ROUTE_133.patternOutbound,
    'dc:title': '133系統 (上大岡駅前 ➔ 古泉 ➔ 根岸駅前)',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_133.id,
    'odpt:direction': '根岸駅前方面',
    'odpt:busstopPoleOrder': ROUTES.ROUTE_133.stops.map((title, idx) => ({
      'odpt:index': idx + 1,
      'odpt:busstopPoleTitle': { ja: title }
    }))
  },
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:ucode:_00001C00000000000002000000510134',
    '@type': 'odpt:BusRoutePattern',
    'owl:sameAs': ROUTES.ROUTE_133.patternInbound,
    'dc:title': '133系統 (古泉 ➔ 上大岡駅前)',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_133.id,
    'odpt:direction': '上大岡駅前方面',
    'odpt:busstopPoleOrder': [...ROUTES.ROUTE_133.stops].reverse().map((title, idx) => ({
      'odpt:index': idx + 1,
      'odpt:busstopPoleTitle': { ja: title }
    }))
  },
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:ucode:_00001C00000000000002000000510064',
    '@type': 'odpt:BusRoutePattern',
    'owl:sameAs': ROUTES.ROUTE_64.patternOutbound,
    'dc:title': '64系統 (上大岡駅前 ➔ 磯子駅前)',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_64.id,
    'odpt:direction': '磯子駅前方面'
  }
];

// =========================================================================
// 3. Raw Departure Times for Schedules (Weekday / Saturday / Holiday)
// =========================================================================

const LINE_111_OUTBOUND_TIMES = {
  Weekday: [
    '06:22', '06:39', '06:55', '07:12', '07:21',
    '07:33', '07:44', '07:54', '08:05', '08:14',
    '08:27', '08:42', '08:53', '09:10', '09:29',
    '09:42', '09:56', '10:12', '10:27', '10:42',
    '10:57', '11:13', '11:26', '11:40', '11:58',
    '12:16', '12:30', '12:47', '13:02', '13:16',
    '13:34', '13:50', '14:05', '14:22', '14:36',
    '14:52', '15:06', '15:19', '15:35', '15:40',
    '15:50', '15:59', '16:10', '16:23', '16:36',
    '16:49', '17:02', '17:14', '17:26', '17:43',
    '18:03', '18:22', '18:43', '19:03', '19:23',
    '19:41', '20:01', '20:21', '20:47', '21:14',
    '21:42', '22:11'
  ],
  Saturday: [
    '06:27', '06:59', '07:26', '07:47',
    '08:10', '08:33', '08:55', '09:15',
    '09:37', '09:56', '10:15', '10:36',
    '10:53', '11:11', '11:29', '11:47',
    '12:03', '12:21', '12:39', '12:56',
    '13:14', '13:30', '13:47', '14:06',
    '14:21', '14:38', '14:55', '15:09',
    '15:26', '15:44', '16:00', '16:16',
    '16:32', '16:49', '17:07', '17:26',
    '17:46', '18:06', '18:28', '18:53',
    '19:18', '19:46', '20:16', '20:45',
    '21:19', '21:56'
  ],
  Holiday: [
    '06:27', '06:59', '07:24', '07:45',
    '08:08', '08:33', '08:55', '09:15',
    '09:37', '09:56', '10:15', '10:36',
    '10:53', '11:11', '11:29', '11:47',
    '12:03', '12:21', '12:39', '12:56',
    '13:14', '13:30', '13:47', '14:06',
    '14:21', '14:38', '14:55', '15:09',
    '15:26', '15:44', '16:00', '16:16',
    '16:32', '16:49', '17:07', '17:26',
    '17:46', '18:06', '18:28', '18:53',
    '19:18', '19:46', '20:16', '20:45',
    '21:19', '21:56'
  ]
};

const LINE_133_OUTBOUND_TIMES = {
  Weekday: [
    '06:45', '07:14', '07:31', '07:57',
    '08:16', '08:28', '08:44', '09:04',
    '09:25', '09:58', '10:18', '10:37',
    '11:03', '11:28', '12:01', '12:31',
    '12:59', '13:30', '14:06', '14:26',
    '15:01', '15:23', '16:02', '16:27',
    '16:37', '16:54', '17:28', '17:50',
    '18:07', '18:26', '18:45', '19:04',
    '19:29', '19:55', '20:26', '20:48',
    '21:24', '21:55'
  ],
  Saturday: [
    '07:05', '07:48', '08:22',
    '09:01', '09:42', '10:30',
    '11:10', '11:58', '12:30',
    '13:00', '13:53', '14:30',
    '15:15', '15:48', '16:30',
    '17:07', '17:58', '18:30',
    '19:10', '19:50', '20:21',
    '21:00'
  ],
  Holiday: [
    '07:05', '07:48', '08:22',
    '09:01', '09:42', '10:30',
    '11:10', '11:58', '12:30',
    '13:00', '13:53', '14:30',
    '15:15', '15:48', '16:30',
    '17:07', '17:58', '18:30',
    '19:10', '19:50', '20:21',
    '21:00'
  ]
};

const LINE_64_OUTBOUND_TIMES = {
  Weekday: [
    '06:12', '06:55', '07:24',
    '07:50', '08:37', '09:37',
    '10:50', '11:43', '12:16',
    '13:05', '13:51', '14:40',
    '15:16', '15:47', '16:14',
    '16:42', '17:18', '18:16',
    '18:54', '19:44', '20:59',
    '21:43', '22:25'
  ],
  Saturday: [
    '06:26', '07:11', '07:41',
    '08:31', '09:23', '10:15',
    '11:17', '11:46', '12:45',
    '13:18', '14:15', '15:06',
    '15:58', '16:47', '17:24',
    '18:13', '19:00', '20:08',
    '21:10', '22:16'
  ],
  Holiday: [
    '06:26', '07:11', '07:41',
    '08:31', '09:23', '10:15',
    '11:17', '11:46', '12:45',
    '13:18', '14:15', '15:06',
    '15:58', '16:47', '17:24',
    '18:13', '19:00', '20:08',
    '21:10', '22:16'
  ]
};

const LINE_133_OUTBOUND_KOIZUMI_TIMES = {
  Weekday: [
    '07:00', '07:29', '07:47', '08:13',
    '08:32', '08:44', '09:00', '09:19',
    '09:40', '10:13', '10:33', '10:52',
    '11:18', '11:43', '12:16', '12:46',
    '13:14', '13:45', '14:21', '14:41',
    '15:16', '15:40', '16:19', '16:44',
    '16:54', '17:11', '17:45', '18:07',
    '18:24', '18:42', '19:01', '19:19',
    '19:44', '20:10', '20:41', '21:03',
    '21:39', '22:10'
  ],
  Saturday: [
    '07:20', '08:03', '08:37',
    '09:16', '09:57', '10:45',
    '11:25', '12:13', '12:45',
    '13:15', '14:08', '14:45',
    '15:30', '16:03', '16:45',
    '17:22', '18:13', '18:45',
    '19:25', '20:05', '20:36',
    '21:15'
  ],
  Holiday: [
    '07:20', '08:03', '08:37',
    '09:16', '09:57', '10:45',
    '11:25', '12:13', '12:45',
    '13:15', '14:08', '14:45',
    '15:30', '16:03', '16:45',
    '17:22', '18:13', '18:45',
    '19:25', '20:05', '20:36',
    '21:15'
  ]
};

// 古泉 1番のりば発 (133系統 上大岡駅前 行) - 横浜市営バス公式ダイヤ
const LINE_133_INBOUND_TIMES = {
  Weekday: [
    '06:22', '06:41', '06:59', '07:29',
    '07:44', '07:55', '08:11', '08:35',
    '08:48', '09:22', '09:43', '10:03',
    '10:25', '10:50', '11:25', '11:48',
    '12:27', '12:48', '13:29', '13:49',
    '14:25', '14:48', '15:35', '15:50',
    '16:07', '16:25', '16:47', '17:08',
    '17:27', '17:47', '18:08', '18:29',
    '18:52', '19:26', '19:50', '20:15',
    '20:51', '21:30'
  ],
  Saturday: [
    '06:36', '07:12', '07:52',
    '08:32', '09:12', '09:52',
    '10:32', '11:17', '11:52',
    '12:27', '13:12', '13:52',
    '14:39', '15:17', '15:52',
    '16:30', '17:12', '17:50',
    '18:27', '19:14', '19:51',
    '20:26'
  ],
  Holiday: [
    '06:36', '07:12', '07:52',
    '08:32', '09:12', '09:52',
    '10:32', '11:17', '11:52',
    '12:27', '13:12', '13:52',
    '14:39', '15:17', '15:52',
    '16:30', '17:12', '17:50',
    '18:27', '19:14', '19:51',
    '20:26'
  ]
};

// 上大岡駅前 6番のりば発 (111系統 港南台駅前 行)
const LINE_111_INBOUND_TIMES = {
  Weekday: [
    '06:16', '06:43', '07:04', '07:18', '07:31',
    '07:41', '07:49', '07:56', '08:04', '08:11',
    '08:15', '08:19', '08:21', '08:29', '08:39',
    '08:50', '09:01', '09:14', '09:26', '09:38',
    '09:50', '10:02', '10:15', '10:28', '10:41',
    '10:53', '11:06', '11:20', '11:34', '11:48',
    '12:04', '12:19', '12:34', '12:46', '13:00',
    '13:14', '13:28', '13:45', '14:00', '14:14',
    '14:28', '14:44', '15:00', '15:13', '15:27',
    '15:40', '15:53', '16:07', '16:19', '16:32',
    '16:48', '17:01', '17:16', '17:30', '17:45',
    '17:58', '18:15', '18:34', '18:48', '19:06',
    '19:26', '19:46', '20:06', '20:26', '20:53',
    '21:18', '21:41', '22:07', '22:32'
  ],
  Saturday: [
    '06:46', '07:23', '07:52', '08:18',
    '08:40', '09:00', '09:20', '09:40',
    '10:02', '10:23', '10:42', '11:02',
    '11:20', '11:38', '11:55', '12:15',
    '12:30', '12:48', '13:06', '13:23',
    '13:41', '13:59', '14:16', '14:33',
    '14:50', '15:06', '15:23', '15:40',
    '15:57', '16:14', '16:28', '16:44',
    '17:00', '17:18', '17:35', '17:53',
    '18:11', '18:31', '18:53', '19:18',
    '19:44', '20:10', '20:40', '21:09',
    '21:40', '22:17'
  ],
  Holiday: [
    '06:46', '07:23', '07:52', '08:18',
    '08:40', '09:00', '09:20', '09:40',
    '10:02', '10:23', '10:42', '11:02',
    '11:20', '11:38', '11:55', '12:15',
    '12:30', '12:48', '13:06', '13:23',
    '13:41', '13:59', '14:16', '14:33',
    '14:50', '15:06', '15:23', '15:40',
    '15:57', '16:14', '16:28', '16:44',
    '17:00', '17:18', '17:35', '17:53',
    '18:11', '18:31', '18:53', '19:18',
    '19:44', '20:10', '20:40', '21:09',
    '21:40', '22:17'
  ]
};

// 洋光台北口 2番のりば発 (111系統 港南台駅前 行)
const LINE_111_INBOUND_YOKODAI_TIMES = {
  Weekday: [
    '06:29', '06:56', '07:17', '07:31', '07:44',
    '07:54', '08:02', '08:09', '08:17', '08:24',
    '08:28', '08:32', '08:34', '08:42', '08:52',
    '09:03', '09:14', '09:27', '09:39', '09:51',
    '10:03', '10:15', '10:28', '10:41', '10:54',
    '11:06', '11:19', '11:33', '11:47', '12:01',
    '12:17', '12:32', '12:47', '12:59', '13:13',
    '13:27', '13:41', '13:58', '14:13', '14:27',
    '14:41', '14:57', '15:13', '15:26', '15:40',
    '15:53', '16:06', '16:20', '16:32', '16:45',
    '17:01', '17:14', '17:29', '17:43', '17:58',
    '18:11', '18:28', '18:47', '19:01', '19:19',
    '19:39', '19:59', '20:19', '20:39', '21:06',
    '21:31', '21:54', '22:20', '22:45'
  ],
  Saturday: [
    '06:59', '07:36', '08:05', '08:31',
    '08:53', '09:13', '09:33', '09:53',
    '10:15', '10:36', '10:55', '11:15',
    '11:33', '11:51', '12:08', '12:28',
    '12:43', '13:01', '13:19', '13:36',
    '13:54', '14:12', '14:29', '14:46',
    '15:03', '15:19', '15:36', '15:53',
    '16:10', '16:27', '16:41', '16:57',
    '17:13', '17:31', '17:48', '18:06',
    '18:24', '18:44', '19:06', '19:31',
    '19:57', '20:23', '20:53', '21:22',
    '21:53', '22:30'
  ],
  Holiday: [
    '06:59', '07:36', '08:05', '08:31',
    '08:53', '09:13', '09:33', '09:53',
    '10:15', '10:36', '10:55', '11:15',
    '11:33', '11:51', '12:08', '12:28',
    '12:43', '13:01', '13:19', '13:36',
    '13:54', '14:12', '14:29', '14:46',
    '15:03', '15:19', '15:36', '15:53',
    '16:10', '16:27', '16:41', '16:57',
    '17:13', '17:31', '17:48', '18:06',
    '18:24', '18:44', '19:06', '19:31',
    '19:57', '20:23', '20:53', '21:22',
    '21:53', '22:30'
  ]
};

// =========================================================================
// 4. Timetable Helpers & Generator
// =========================================================================

export function buildTimetableEntries(times, line, destination, direction = 'outbound') {
  return times.map((t, idx) => ({
    busId: `${line.replace('系統', '')}-${direction}-${idx}`,
    line,
    destination,
    departureTime: t,
    isNonStepBus: true,
    delayMinutes: 0
  }));
}

export function getMockTimetables(calendar = 'Weekday') {
  const cal = LINE_111_OUTBOUND_TIMES[calendar] ? calendar : 'Weekday';
  return {
    line111Outbound: buildTimetableEntries(LINE_111_OUTBOUND_TIMES[cal], '111系統', '上大岡駅前', 'out'),
    line133Outbound: buildTimetableEntries(LINE_133_OUTBOUND_TIMES[cal], '133系統', '根岸駅前', 'out'),
    line133OutboundKoizumi: buildTimetableEntries(LINE_133_OUTBOUND_KOIZUMI_TIMES[cal], '133系統', '根岸駅前', 'out'),
    line64Outbound: buildTimetableEntries(LINE_64_OUTBOUND_TIMES[cal], '64系統', '磯子駅前', 'out'),
    line133Inbound: buildTimetableEntries(LINE_133_INBOUND_TIMES[cal], '133系統', '上大岡駅前', 'in'),
    line111Inbound: buildTimetableEntries(LINE_111_INBOUND_TIMES[cal], '111系統', '港南台駅前', 'in'),
    line111InboundYokodai: buildTimetableEntries(LINE_111_INBOUND_YOKODAI_TIMES[cal], '111系統', '港南台駅前', 'in')
  };
}

/**
 * Returns timetable entries for specific stop and calendar.
 */
export function getMockTimetable(stopId, direction = 'outbound', calendar = 'Weekday') {
  const tables = getMockTimetables(calendar);
  if (stopId === STOPS.YOKODAI.id || stopId === 'yokodai') {
    return tables.line111Outbound;
  }
  if (stopId === STOPS.KAMIOOKA.id || stopId === 'kamiooka') {
    return direction === 'inbound' ? tables.line111Inbound : tables.line133Outbound;
  }
  if (stopId === STOPS.KOIZUMI.id || stopId === 'koizumi') {
    return tables.line133Inbound;
  }
  return tables.line111Outbound;
}

// =========================================================================
// 5. Active Realtime Buses Mock (odpt:Bus)
// =========================================================================
export const MOCK_BUSES = [
  // --- 111系統 往路 (洋光台・上大岡方面) ---
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:uuid:mock-bus-111-4412',
    '@type': 'odpt:Bus',
    'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.111.Vehicle4412',
    'dc:date': '2026-08-23T02:00:00+09:00',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_111.id,
    'odpt:busroutePattern': ROUTES.ROUTE_111.patternOutbound,
    'odpt:startingBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonandaiStation.1823.3',
    'odpt:terminalBusstopPole': STOPS.KAMIOOKA.idArrival,
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Yoshihara.7816.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonanWardOffice.1827.1',
    'odpt:delay': 180, // +3分遅れ (上大岡駅前まで3個前)
    'geo:lat': 35.3980,
    'geo:long': 139.5960
  },
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:uuid:mock-bus-111-4415',
    '@type': 'odpt:Bus',
    'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.111.Vehicle4415',
    'dc:date': '2026-08-23T02:00:00+09:00',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_111.id,
    'odpt:busroutePattern': ROUTES.ROUTE_111.patternOutbound,
    'odpt:startingBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonandaiStation.1823.3',
    'odpt:terminalBusstopPole': STOPS.KAMIOOKA.idArrival,
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonanWardOffice.1827.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.SasageKonanchuodori.2021.1',
    'odpt:delay': 120, // +2分遅れ (上大岡駅前まで2個前)
    'geo:lat': 35.4020,
    'geo:long': 139.5962
  },
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:uuid:mock-bus-111-4418',
    '@type': 'odpt:Bus',
    'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.111.Vehicle4418',
    'dc:date': '2026-08-23T02:00:00+09:00',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_111.id,
    'odpt:busroutePattern': ROUTES.ROUTE_111.patternOutbound,
    'odpt:startingBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonandaiStation.1823.3',
    'odpt:terminalBusstopPole': STOPS.KAMIOOKA.idArrival,
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Sekinoshita.2604.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.13',
    'odpt:delay': 0, // 定刻 (上大岡駅前へまもなく到着: 1個前)
    'geo:lat': 35.4060,
    'geo:long': 139.5963
  },
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:uuid:mock-bus-111-4408',
    '@type': 'odpt:Bus',
    'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.111.Vehicle4408',
    'dc:date': '2026-08-23T02:00:00+09:00',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_111.id,
    'odpt:busroutePattern': ROUTES.ROUTE_111.patternOutbound,
    'odpt:startingBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonandaiStation.1823.3',
    'odpt:terminalBusstopPole': STOPS.KAMIOOKA.idArrival,
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiNichome.7802.1',
    'odpt:toBusstopPole': STOPS.YOKODAI.id,
    'odpt:delay': 300, // +5分遅れ (洋光台北口へまもなく到着: 1個前)
    'geo:lat': 35.3810,
    'geo:long': 139.5980
  },
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:uuid:mock-bus-111-4405',
    '@type': 'odpt:Bus',
    'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.111.Vehicle4405',
    'dc:date': '2026-08-23T02:00:00+09:00',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_111.id,
    'odpt:busroutePattern': ROUTES.ROUTE_111.patternOutbound,
    'odpt:startingBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonandaiStation.1823.3',
    'odpt:terminalBusstopPole': STOPS.KAMIOOKA.idArrival,
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.NishiPark.4223.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiNichome.7802.1',
    'odpt:delay': 60, // +1分遅れ (洋光台北口まで2個前)
    'geo:lat': 35.3780,
    'geo:long': 139.5970
  },

  // --- 111系統 復路 (港南台方面) ---
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:uuid:mock-bus-111-4430',
    '@type': 'odpt:Bus',
    'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.111.Vehicle4430',
    'dc:date': '2026-08-23T02:00:00+09:00',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_111.id,
    'odpt:busroutePattern': ROUTES.ROUTE_111.patternInbound,
    'odpt:startingBusstopPole': STOPS.KAMIOOKA.id,
    'odpt:terminalBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonandaiStation.1823.3',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.HinoChuoKoenIriguchi.5256.2',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.2',
    'odpt:delay': 0, // 定刻 (洋光台北口2番乗り場へまもなく到着: 1個前)
    'geo:lat': 35.3850,
    'geo:long': 139.5980
  },

  // --- 133系統 往路 (上大岡駅前発 根岸駅前行: 古泉経由) ---
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:uuid:mock-bus-133-2890',
    '@type': 'odpt:Bus',
    'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.133.Vehicle2890',
    'dc:date': '2026-08-23T02:00:00+09:00',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_133.id,
    'odpt:busroutePattern': ROUTES.ROUTE_133.patternOutbound,
    'odpt:startingBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.12',
    'odpt:terminalBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.NegishiStation.4600.4',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokohamaOkamuraPostOffice.7848.2',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Tenjinmae.3609.2',
    'odpt:delay': 120, // +2分遅れ (古泉2番まで3個前)
    'geo:lat': 35.4180,
    'geo:long': 139.6080
  },
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:uuid:mock-bus-133-2892',
    '@type': 'odpt:Bus',
    'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.133.Vehicle2892',
    'dc:date': '2026-08-23T02:00:00+09:00',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_133.id,
    'odpt:busroutePattern': ROUTES.ROUTE_133.patternOutbound,
    'odpt:startingBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.12',
    'odpt:terminalBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.NegishiStation.4600.4',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Tenjinmae.3609.2',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Okamuracho.827.2',
    'odpt:delay': 0, // 定刻 (古泉2番まで2個前)
    'geo:lat': 35.4200,
    'geo:long': 139.6110
  },
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:uuid:mock-bus-133-2895',
    '@type': 'odpt:Bus',
    'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.133.Vehicle2895',
    'dc:date': '2026-08-23T02:00:00+09:00',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_133.id,
    'odpt:busroutePattern': ROUTES.ROUTE_133.patternOutbound,
    'odpt:startingBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.12',
    'odpt:terminalBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.NegishiStation.4600.4',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Okamuracho.827.2',
    'odpt:toBusstopPole': STOPS.KOIZUMI.idInbound,
    'odpt:delay': 300, // +5分遅れ (古泉2番へまもなく到着: 1個前)
    'geo:lat': 35.4210,
    'geo:long': 139.6135
  },
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:uuid:mock-bus-133-2888',
    '@type': 'odpt:Bus',
    'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.133.Vehicle2888',
    'dc:date': '2026-08-23T02:00:00+09:00',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_133.id,
    'odpt:busroutePattern': ROUTES.ROUTE_133.patternOutbound,
    'odpt:startingBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.12',
    'odpt:terminalBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.NegishiStation.4600.4',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.12',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Saidobashi.2004.2',
    'odpt:delay': 0, // 定刻 (上大岡駅前12番を出発直後)
    'geo:lat': 35.4100,
    'geo:long': 139.5980
  },

  // --- 133系統 復路 (根岸駅前発 上大岡駅前行: 古泉経由) ---
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:uuid:mock-bus-133-2901',
    '@type': 'odpt:Bus',
    'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.133.Vehicle2901',
    'dc:date': '2026-08-23T02:00:00+09:00',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_133.id,
    'odpt:busroutePattern': ROUTES.ROUTE_133.patternInbound,
    'odpt:startingBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.NegishiStation.4600.4',
    'odpt:terminalBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.1',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Nakanocho.4023.2',
    'odpt:toBusstopPole': STOPS.KOIZUMI.id,
    'odpt:delay': 60, // +1分遅れ (古泉1番へまもなく到着: 1個前)
    'geo:lat': 35.4220,
    'geo:long': 139.6170
  },
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:uuid:mock-bus-133-2905',
    '@type': 'odpt:Bus',
    'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.133.Vehicle2905',
    'dc:date': '2026-08-23T02:00:00+09:00',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_133.id,
    'odpt:busroutePattern': ROUTES.ROUTE_133.patternInbound,
    'odpt:startingBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.NegishiStation.4600.4',
    'odpt:terminalBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.1',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Saidobashi.2004.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.1',
    'odpt:delay': 120, // +2分遅れ (上大岡駅前1番へまもなく到着: 1個前)
    'geo:lat': 35.4095,
    'geo:long': 139.5970
  },

  // --- 64系統 ---
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:uuid:mock-bus-64-3101',
    '@type': 'odpt:Bus',
    'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.064.Vehicle3101',
    'dc:date': '2026-08-23T02:00:00+09:00',
    'odpt:operator': OPERATOR_ID,
    'odpt:busroute': ROUTES.ROUTE_64.id,
    'odpt:busroutePattern': ROUTES.ROUTE_64.patternOutbound,
    'odpt:startingBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonandaiStation.1823.5',
    'odpt:terminalBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.IsogoStation.218.5',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.SasageKonanchuodori.2021.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Sekinoshita.2604.1',
    'odpt:delay': 0, // 定刻 (上大岡駅前まで2個前)
    'geo:lat': 35.4030,
    'geo:long': 139.5960
  }
];

export function getMockRealtimeBuses(routePatternId = null) {
  if (!routePatternId) return MOCK_BUSES;
  return MOCK_BUSES.filter(b => b['odpt:busroutePattern'] === routePatternId);
}

/**
 * 特定の停留所に関係するモックバスを取得する
 * @param {string} poleId
 * @returns {Array}
 */
export function getMockBusesForStop(poleId) {
  if (!poleId) return MOCK_BUSES;
  return MOCK_BUSES.filter(b => 
    b['odpt:fromBusstopPole'] === poleId ||
    b['odpt:toBusstopPole'] === poleId ||
    (b['odpt:startingBusstopPole'] && b['odpt:startingBusstopPole'] === poleId) ||
    (b['odpt:terminalBusstopPole'] && b['odpt:terminalBusstopPole'] === poleId)
  );
}

// =========================================================================
// 6. Operational Information Mock (odpt:BusInformation)
// =========================================================================
export const MOCK_BUS_INFO = [
  {
    '@context': 'http://vocab.odpt.org/context_odpt.jsonld',
    '@id': 'urn:ucode:_00001C00000000000002000000800001',
    '@type': 'odpt:BusInformation',
    'owl:sameAs': 'odpt.BusInformation:YokohamaMunicipal.General.20260822',
    'dc:date': '2026-08-22T02:00:00+09:00',
    'odpt:operator': OPERATOR_ID,
    'odpt:informationStatus': 'Normal',
    'odpt:informationText': '現在、市営バスは全線おおむね平常通り運行しております。'
  }
];

export function getMockBusInformation() {
  return MOCK_BUS_INFO;
}

export const MockData = {
  MOCK_BUSSTOP_POLES,
  MOCK_ROUTES,
  MOCK_BUSES,
  MOCK_BUS_INFO,
  getMockTimetables,
  getMockTimetable,
  getMockRealtimeBuses,
  getMockBusesForStop,
  getMockBusInformation
};

export default MockData;


const https = require('https');
const fs = require('fs');

const API_KEY = 'sp6f7n9vz8rl444kyzez0hrmw9j9j5owtyiw8tksze5mamr8wd7nrcc6xeybydat';
const OPERATOR = 'odpt.Operator:YokohamaMunicipal';

const TARGET_ROUTES = ['111系統', '133系統'];

const TARGET_STOPS = {
  'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1': '洋光台北口 1番のりば (上大岡駅前方面)',
  'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.2': '洋光台北口 2番のりば (港南台駅前方面)',
  'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.1': '上大岡駅前 1番降車場',
  'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6': '上大岡駅前 6番のりば (洋光台・港南台方面)',
  'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.12': '上大岡駅前 12番のりば (古泉・根岸方面)',
  'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.13': '上大岡駅前 13番降車場',
  'odpt.BusstopPole:YokohamaMunicipal.Koizumi.1810.1': '古泉 1番のりば (上大岡駅前方面)'
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Fetching BusTimetables from ODPT API ===');
  const allTimetables = [];

  for (const route of TARGET_ROUTES) {
    const encoded = encodeURIComponent(route);
    const url = `https://api.odpt.org/api/v4/odpt:BusTimetable?acl:consumerKey=${API_KEY}&odpt:operator=${OPERATOR}&dc:title=${encoded}`;
    console.log(`Fetching ${route}...`);
    try {
      const timetables = await fetchJson(url);
      if (Array.isArray(timetables)) {
        console.log(`Fetched ${timetables.length} timetables for ${route}`);
        allTimetables.push(...timetables);
      }
    } catch (e) {
      console.error(`Failed to fetch ${route}:`, e);
    }
  }

  console.log(`Total timetables fetched: ${allTimetables.length}`);

  const result = {};
  Object.keys(TARGET_STOPS).forEach(stopId => {
    result[stopId] = { Weekday: [], Saturday: [], Holiday: [] };
  });

  let entryCounter = 1;
  const seenKeys = new Set();

  allTimetables.forEach(tt => {
    const calendar = tt['odpt:calendar'] || '';
    let dayType = null;
    if (calendar.includes('Weekday')) dayType = 'Weekday';
    else if (calendar.includes('Saturday')) dayType = 'Saturday';
    else if (calendar.includes('Holiday')) dayType = 'Holiday';

    if (!dayType) return; // Skip non-standard/special calendars

    let rawTitle = tt['dc:title'] || '';
    let lineName = rawTitle.replace(/^0/, ''); // '064系統' -> '64系統'
    const busTimetableId = tt['owl:sameAs'] || '';
    const pattern = tt['odpt:busroutePattern'] || '';

    const objects = tt['odpt:busTimetableObject'] || [];
    objects.forEach(obj => {
      const stopId = obj['odpt:busstopPole'];
      const depTime = obj['odpt:departureTime'];

      if (TARGET_STOPS[stopId] && depTime) {
        // Unique key to prevent duplicates
        const uniqueKey = `${stopId}_${dayType}_${depTime}_${lineName}_${busTimetableId}`;
        if (!seenKeys.has(uniqueKey)) {
          seenKeys.add(uniqueKey);

          let dest = obj['odpt:destinationSign'] || '';
          if (!dest) {
            if (lineName === '111系統') {
              dest = stopId.endsWith('.1') || stopId.endsWith('.13') ? '上大岡駅前 行' : '港南台駅前 行';
            } else if (lineName === '133系統') {
              dest = stopId.endsWith('.1') ? '上大岡駅前 行' : '根岸駅前 行';
            } else if (lineName === '64系統') {
              dest = stopId.endsWith('.6') ? '港南台駅前 行' : '磯子駅前 行';
            }
          }

          result[stopId][dayType].push({
            id: `real_${entryCounter++}`,
            busId: busTimetableId,
            line: lineName,
            destination: dest,
            departureTime: depTime,
            pattern: pattern
          });
        }
      }
    });
  });

  // Sort each stop and calendar by departureTime ascending
  Object.keys(TARGET_STOPS).forEach(stopId => {
    ['Weekday', 'Saturday', 'Holiday'].forEach(day => {
      result[stopId][day].sort((a, b) => {
        if (!a.departureTime || !b.departureTime) return 0;
        return a.departureTime.localeCompare(b.departureTime);
      });
    });
  });

  console.log('\n=== Summary of Target Stops Timetable Count ===');
  Object.keys(TARGET_STOPS).forEach(stopId => {
    const label = TARGET_STOPS[stopId];
    console.log(`${label} [${stopId}]:`);
    ['Weekday', 'Saturday', 'Holiday'].forEach(day => {
      const list = result[stopId][day];
      const lines = [...new Set(list.map(x => x.line))];
      const first = list[0]?.departureTime || '--:--';
      const last = list[list.length - 1]?.departureTime || '--:--';
      console.log(`  - ${day}: ${list.length}便 ${JSON.stringify(lines)} (始発: ${first} / 終発: ${last})`);
    });
  });

  // Write to js/api/real-timetable-data.js
  const fileContent = `// Auto-generated real timetable data from ODPT API
export const REAL_TIMETABLES = ${JSON.stringify(result, null, 2)};
`;

  fs.writeFileSync('js/api/real-timetable-data.js', fileContent, 'utf-8');
  console.log('\nSuccessfully generated js/api/real-timetable-data.js');
}

main().catch(err => {
  console.error('Error generating timetable:', err);
});

# 横浜市営バスナビゲーションWebアプリ (Transporter) 徹底バグ監査・検証レポート

## 1. 総合所見・エグゼクティブサマリー

ユーザーから寄せられた「動作が不安定」「あっているのかわからない」「表示がおかしい」という懸念に基づき、コードベース全体（`js/api/`, `js/services/`, `js/ui/`, 設定ファイル、テスト群、データ生成スクリプト）を徹底的に検証しました。

調査の結果、**全8つの重点項目すべてにおいて、重大な論理バグ、非同期競合（レースコンディション）、データの欠落、仕様書（PROJECT.md）と実装の不整合**が特定されました。

### 主な発見点
1. **行先判定が100%誤判定されるJS言語仕様バグ**: `dest.includes('')` という空文字判定が常に `true` になるため、正常な行先判定が完全破壊され、ポール末尾番号のみで機械的に決め打ちされている。
2. **古泉バス停（根岸方面）の完全欠落**: データ生成ツールで `1810.2`（根岸方面）が漏れており、UI側も上り（上大岡方面）しか定義されていないため、根岸方面の時刻表が一切表示できない。
3. **上大岡駅前バスターミナルのりば誤表記**: 洋光台・港南台方面が本来「6番のりば」であるべきところ、サービス層で「11番のりば」と誤記されている。
4. **GPS取得による画面の勝手な上書き・タブ強制遷移**: 遅れて届く位置情報が、ユーザーの手動操作を無視して勝手に画面を反転させたりタブを移動させたりするため、強い「動作不安定感」を招いている。
5. **深夜帯（23時〜0時台）の乗り継ぎ計算破綻**: 日跨ぎの分計算（ロールオーバー）が存在せず、23時以降に0時台の深夜バスが「過去の便」として除外される。
6. **APIキー未設定時のタブ間表示分裂**: 乗り換えタブでは「⚠️時刻表データを取得できませんでした」と出る一方、停留所タブでは内蔵時刻表が普通に表示され、ユーザーを混乱させている。
7. **方向反転やタブ切り替え連打による非同期レースコンディション**: 非同期描画の世代管理がなく、連打すると「時刻表データ取得失敗」エラーが誤発火する。
8. **接近プログレスバーの上下線・停車中バスの描画不整合**: 上大岡駅前が「当駅始発」固定で接近表示が無効化されているほか、下り方向の手前5停留所に非対応。

---

## 2. 重点調査項目の詳細検証結果

### 【項目1】APIキー・データ取得・フォールバックの整合性

#### (1) PROJECT.mdの「Pure API Policy（モック排除）」と実際のコードの矛盾
- **該当ファイル**:
  - `PROJECT.md` (lines 102–109)
  - `js/api/odpt-client.js` (line 9, lines 302–312)
  - `js/api/real-timetable-data.js` (全7,164行, 約277KB)
  - `generate_timetable.js` (lines 1–157)
- **コード抜粋 (`odpt-client.js` L302-311)**:
  ```javascript
  // 2. Fallback to built-in full verified timetable dataset
  if (REAL_TIMETABLES) {
    let matchedKey = poleId;
    if (!REAL_TIMETABLES[matchedKey]) {
      matchedKey = Object.keys(REAL_TIMETABLES).find(k => k.includes(poleId) || (poleId && poleId.includes(k)));
    }
    if (matchedKey && REAL_TIMETABLES[matchedKey] && REAL_TIMETABLES[matchedKey][dayType]) {
      return REAL_TIMETABLES[matchedKey][dayType];
    }
  }
  ```
- **原因・実態**:
  - `PROJECT.md` の「Pure API Policy」では、「内蔵データの完全撤廃とAPI直接取得の徹底」「静的な内蔵時刻表データやフォールバック用モックデータを完全排除」「APIキー未設定時は架空データで誤魔化さず⚠️時刻表データを取得できませんでしたと表示する」と規定されている。
  - しかし実装コードでは、`generate_timetable.js` でAPIから事前抽出された 277KB の巨大データ `real-timetable-data.js` がインポートされ、APIキー未設定時や通信失敗時に自動フォールバックされている。
- **影響**:
  仕様書と実コードが乖離しており、プロジェクト内でモック排除とオフラインフォールバック維持の方針分裂が起きている。

#### (2) APIキー未設定時、乗り換えタブと停留所タブで表示が食い違う問題
- **該当ファイル**:
  - `js/app.js` (lines 707–728: `renderTransferView`, lines 743–800: `renderStopsView`)
  - `js/ui/render-main.js` (lines 78–98)
  - `js/api/odpt-client.js` (lines 188–192, 302–312)
- **原因**:
  - **乗り換えタブ (`renderTransferView`)**:
    `storageService.hasApiKey()` を明示的にチェックし、キーが空の場合は `routeStatus = 'no_api_key'` を設定して、UIに「⚠️ 時刻表データを取得できませんでした（設定からAPIキーを入力してください）」を表示する（Pure API Policyに沿った挙動）。
  - **停留所タブ (`renderStopsView`)**:
    `hasApiKey()` のチェックを一切行わずに `odptClient.fetchBusstopPoleTimetables()` を呼び出す。
    `odptClient` はキーがない場合、内蔵の `REAL_TIMETABLES` にフォールバックして時刻表データを返すため、何のエラーも出ず普通に時刻表が表示される。
- **再現条件**:
  - 設定でAPIキーを未設定（または消去）した状態で、乗り換えタブと停留所タブを切り替える。
- **影響**:
  - 乗り換えタブでは「APIキーがないため取得できない」と警告されるのに、停留所タブに行くと時刻表が普通に見えるため、ユーザーは「故障しているのか」「どちらが正しいのか」混乱する。
- **推奨修正案**:
  - **方針A（Pure API Policyを徹底する場合）**:
    `odpt-client.js` から `REAL_TIMETABLES` へのフォールバックを撤廃し、APIキー未設定時は空配列を返す。同時に `renderStopsView` にもAPIキー未設定時の警告画面を追加する。
  - **方針B（デモ・オフライン動作を許容する場合）**:
    乗り換えタブでもフォールバック時刻表がある場合は乗り換え案内を表示可能にし、上部に「オフライン/内蔵ダイヤ表示中」の控えめなバッジを表示する。

---

### 【項目2】行先判定のロジックバグ

#### (1) `dest.includes('')` による条件式の恒常的真（常にtrue）
- **該当ファイルと行番号**:
  - `js/api/odpt-client.js` (lines 11–26: `normalizeDestination`)
  - `generate_timetable.js` (lines 35–50: `sanitizeDestination`)
- **コード抜粋**:
  ```javascript
  function normalizeDestination(dest, lineName, stopId) {
    if (!dest || dest.includes('') || dest.includes('大岡駅前') || dest.includes('港') || dest.includes('根岸')) {
      if (lineName === '111系統') {
        if (stopId && (stopId.endsWith('.1') || stopId.endsWith('.13'))) return '上大岡駅前 行';
        if (dest && dest.includes('洋光台')) return '洋光台駅前 行';
        return '港南台駅前 行';
      } else if (lineName === '133系統') {
        return (stopId && stopId.endsWith('.1')) ? '上大岡駅前 行' : '根岸駅前 行';
      }
    }
    if (!dest) { ... }
    return dest.endsWith('行') ? dest : `${dest} 行`;
  }
  ```
- **原因**:
  - JavaScriptの `String.prototype.includes` において、任意の文字列に対して `str.includes('')` は **常に `true`** を返す。
  - したがって、`dest` にどのような文字列が入っていても `dest.includes('')` が成立し、最初の `if` ブロックへ必ず入る。
- **影響**:
  - 133系統の場合、元の行先（`dest`）が何であっても、ポールIDが `.1` であれば強制的に「上大岡駅前 行」、そうでなければ強制的に「根岸駅前 行」に上書きされる。
  - 111系統でも、ポール末尾が `.1` または `.13` なら無条件に「上大岡駅前 行」、それ以外で「洋光台」を含まないものは全て「港南台駅前 行」になる。
  - 途中止まり便（例: 滝頭止まり）や他系統の行先がすべて消滅し、誤った終点行先に偽装されてしまう。
- **推奨修正案**:
  `dest.includes('')` を即時削除し、空文字判定（`!dest || !dest.trim()`）と正規のキーワード判定を分離する。
  ```javascript
  function normalizeDestination(dest, lineName, stopId) {
    if (!dest || !dest.trim()) {
      if (lineName === '111系統') {
        return (stopId && (stopId.endsWith('.1') || stopId.endsWith('.13'))) ? '上大岡駅前 行' : '港南台駅前 行';
      } else if (lineName === '133系統') {
        return (stopId && stopId.endsWith('.1')) ? '上大岡駅前 行' : '根岸駅前 行';
      }
      return '運行予定';
    }
    const clean = dest.trim();
    if (clean.includes('上大岡') || clean.includes('大岡駅前')) return '上大岡駅前 行';
    if (clean.includes('港南台')) return '港南台駅前 行';
    if (clean.includes('洋光台')) return '洋光台駅前 行';
    if (clean.includes('根岸')) return '根岸駅前 行';
    return clean.endsWith('行') ? clean : `${clean} 行`;
  }
  ```

---

### 【項目3】古泉バス停のデータ欠落・ポール不整合

#### (1) 古泉 1810.2（根岸方面）のデータ欠落とUI制限
- **該当ファイル**:
  - `stops_info.json` (lines 33–41)
  - `generate_timetable.js` (lines 9–17)
  - `js/ui/render-stop-view.js` (lines 14–25)
  - `js/ui/render-modal.js` (lines 396–410)
  - `js/config.js` (lines 56–69)
  - `js/api/real-timetable-data.js`
  - `routes_info.json`
- **コード抜粋 (`render-stop-view.js` L22-25)**:
  ```javascript
  koizumi: [
    { pole: '1', label: '上大岡方面', poleId: 'odpt.BusstopPole:YokohamaMunicipal.Koizumi.1810.1' }
    // ← pole: '2' (根岸方面) が未定義！
  ]
  ```
- **原因**:
  1. `stops_info.json` には `1810.1`（1番のりば）と `1810.2`（2番のりば）が定義されている。
  2. しかし `generate_timetable.js` の `TARGET_STOPS` に `1810.1` のみ登録され、`1810.2` が記載されていなかった。そのため生成された `real-timetable-data.js` に古泉2番のりばの時刻表が1行も存在しない。
  3. さらに `js/ui/render-stop-view.js` の `STOP_PLATFORMS.koizumi` に `{ pole: '1', label: '上大岡方面', poleId: '...1810.1' }` しか定義されていない。
  4. `js/config.js` の `STOPS.KOIZUMI` にも `idInbound: '...1810.1'` しかなく、下りポールIDの参照先がない。
  5. `routes_info.json` には133系統のパターン情報が0件。
- **再現条件**:
  - 「停留所」タブで「古泉」を選択する。
- **影響**:
  - 古泉停留所では「上大岡方面」しか選べず、のりば切り替えピルも出ないため、**根岸方面のバス情報を閲覧することが一切できない**。
- **推奨修正案**:
  1. `generate_timetable.js` の `TARGET_STOPS` に `'odpt.BusstopPole:YokohamaMunicipal.Koizumi.1810.2': '古泉 2番のりば (根岸駅前方面)'` を追加し時刻表データを再生成。
  2. `render-stop-view.js` の `STOP_PLATFORMS.koizumi` に `{ pole: '2', label: '根岸方面', poleId: 'odpt.BusstopPole:YokohamaMunicipal.Koizumi.1810.2' }` を追加。
  3. `config.js` の `STOPS.KOIZUMI` に `idOutbound: 'odpt.BusstopPole:YokohamaMunicipal.Koizumi.1810.2'` を追加。

---

### 【項目4】のりば番号・テキスト表示の不整合

#### (1) 上大岡駅前（洋光台方面）が「11番のりば」と誤表記されている問題
- **該当ファイルと行番号**:
  - `js/services/transfer-service.js` (lines 68–76)
  - `js/config.js` (lines 76–79: `ROUTES.ROUTE_111`)
- **コード抜粋 (`transfer-service.js` L68-76)**:
  ```javascript
  leg2: {
    line: '111系統',
    routeId: ROUTES.ROUTE_111.id,
    patternId: ROUTES.ROUTE_111.patternInbound,
    from: '上大岡駅前',
    to: '洋光台北口',
    destinationLabel: '港南台駅前 行 (洋光台北口経由)',
    durationMinutes: 15,
    platform: '11番のりば' // <-- 誤り！正しくは「6番のりば」
  }
  ```
- **原因・影響**:
  - 上大岡駅バスターミナルにおいて、111系統（洋光台・港南台方面）は **6番のりば**（ポール `1046.6`）から発車する。11番ポールは降車場または他系統用であり、111系統は発車しない。
  - `PROJECT.md` や `config.js`（`STOPS.KAMIOOKA.poleNumber: '6'`）では正しく「6番」と定義されているが、`transfer-service.js` にのみ「11番のりば」と誤記されている。
  - また、`config.js` の `ROUTE_111` で `patternOutbound` に `11100.10_1`（実際は港南台行）、`patternInbound` に `11101.10_1`（実際は上大岡行）が割り当てられており、方向の命名規則が逆転している。
- **推奨修正案**:
  - `transfer-service.js` line 75 を `platform: '6番のりば'` に修正する。
  - `config.js` の `ROUTE_111` のパターンID対応を整合させる。

---

### 【項目5】Geolocation（位置情報）自動ルーティングの挙動

#### (1) GPS取得完了時に勝手にタブが切り替わり、方向が反転する問題
- **該当ファイルと行番号**:
  - `js/app.js` (lines 114–137, lines 537–544)
  - `js/services/location-service.js` (lines 122–159)
- **コード抜粋 (`app.js` L114-134)**:
  ```javascript
  try {
    const geoNav = await locationService.determineInitialNavigation();
    if (geoNav) {
      if (geoNav.nearestStopKey === 'kamiooka') {
        this.activeStopKey = 'kamiooka';
        this.currentTab = 'view-stops';
      } else if (geoNav.nearestStopKey === 'koizumi') {
        this.direction = 'inbound';
        this.activeStopKey = 'koizumi';
        this.currentTab = 'view-transfer';
      } else if (geoNav.nearestStopKey === 'yokodai') {
        this.direction = 'outbound';
        this.activeStopKey = 'yokodai';
        this.currentTab = 'view-transfer';
      }
      this.state.setState({ ... });
      this.switchTab(this.currentTab); // 遅れて勝手にタブが切り替わる！
    }
  }
  ```
- **原因**:
  1. `init()` 実行時、まずデフォルトの画面（乗り換えタブ・洋光台北口発）が即座に同期描画される。
  2. ユーザーが画面を見始めたり、手動でタブや方向を切り替えて操作を開始した数秒後に、非同期の `determineInitialNavigation()`（ブラウザGPS取得）が完了する。
  3. その際、「ユーザーがすでに手動で画面を操作したか」を判定するフラグが一切存在しないため、ユーザーの操作を上書きして勝手にタブを切り替え、方向を反転させてしまう。
  4. さらに `switchTab('view-stops')` の中でも（lines 537-544）、下部ナビの「停留所」を押すたびに `locationService.cachedPosition` を参照して最寄り停留所に強制リセットする処理が入っており、ユーザーが選んだ停留所が保持されない。
  5. 最大許容距離（ジオフェンス）の設定がなく、横浜市外や海外にいる場合でも無理やり最寄り停留所が選ばれてしまう。
- **再現条件**:
  位置情報を許可したブラウザでアプリを開き、起動直後の1〜2秒以内に手動で「古泉発」や「停留所」タブをタップする。
- **影響**:
  ユーザーが操作している最中に画面が勝手に切り替わったり、行先が反転するため、「動作が不安定」「勝手に動いてバグっている」という強いストレスを与える。
- **推奨修正案**:
  - ユーザーが一度でも手動操作（タブ切り替え、方向切り替え、停留所選択）を行った場合は `this._userInteracted = true` フラグを立て、GPS取得完了時の強制遷移をスキップする。
  - `switchTab` 内で無条件に `activeStopKey` を上書きする処理を削除し、選択状態を維持する。
  - 許容距離（例: 2.5km）を超えている場合は自動ルーティングを行わない。

---

### 【項目6】乗り継ぎ計算（transfer-service.js）の境界値・時刻比較

#### (1) 深夜帯（23時〜24時台、0時台）および日跨ぎ接続の比較破綻
- **該当ファイルと行番号**:
  - `js/services/transfer-service.js` (lines 117, 130–135, 144–148)
  - `js/services/timetable-service.js` (lines 139–145)
- **コード抜粋 (`transfer-service.js` L117, L135)**:
  ```javascript
  const curMinutes = cTime.getHours() * 60 + cTime.getMinutes();
  ...
  const dep1Min = this.timetableService.timeStringToMinutes(b1.departureTime);
  const actualDep1 = dep1Min + delay1;

  if (actualDep1 < curMinutes) continue; // <-- 単純分比較
  ...
  if (actualDep2 >= minConnectingTime) { // <-- 単純分比較
  ```
- **原因**:
  1. **0時台の便が除外される**:
     ODPT時刻表に `"00:10"` などの深夜便が含まれる場合、`timeStringToMinutes("00:10") = 10`。
     現在時刻が 23:50（`curMinutes = 1430`）の場合、`10 < 1430` と判定され、直近の便であるにもかかわらず「過去の便」として除外（continue）される。
  2. **深夜0時台に閲覧した場合の破綻**:
     現在時刻が深夜 0:15（`curMinutes = 15`）のとき、深夜ダイヤの `"24:30"`（`1470`分）が存在すると、24時間後の便と誤認されて所要時間が狂う。また翌朝の便 `"06:00"`（`360`分）が `360 >= 15` で直近候補として誤選択される。
  3. **日跨ぎ接続の破綻**:
     第1便が 23:50発 ➔ 00:05着（`1445`分）、第2便が 00:15発（`15`分）の場合、`actualDep2 >= minConnectingTime`（`15 >= 1445`）が成立せず、「接続便なし」として判定されてしまう。
  4. `timetable-service.js` の `filterTimetable` でも `fromMin >= 22 * 60` の日跨ぎ補正がない。
- **推奨修正案**:
  `transfer-service.js` および `timetable-service.js` に 24時間循環（日跨ぎウィンドウ: 22時以降の翌日未明便は +1440分）を考慮した差分判定ヘルパーを導入する。

---

### 【項目7】路線マップ・接近プログレスバーの描画不整合

#### (1) 複線縦型路線図における区間走行中バス（en_route）の描画不整合
- **該当ファイルと行番号**:
  - `js/services/bus-location-service.js` (lines 1320–1366)
  - `js/ui/step-timeline.js` (lines 380–440)
- **原因**:
  - 路線マップの停留所リストは、上大岡駅前（最上部 index 0）から港南台/根岸駅前（最下部 index N）の順で並んでいる。
  - 上り線（上大岡行き）のバスは、下から上（`fromIdx` ➔ `fromIdx - 1`）に向かって進む。
  - しかし、`bus-location-service.js` では区間走行中バスを `stops[fromIdx].upboundBusesEnRoute` に格納しており、UI側（`step-timeline.js`）でも `stops[fromIdx]` の行スロット内に描画している。
  - そのため、上に向かって走っているバスが「出発停留所の真横」に描画され、停車中バスとの区別や区間進行感が損なわれている。
  - また、位置情報で `toBusstopPole` が未解決の上りバスが停留所に停車した際、`fromIdx > toIdx` の条件が失敗して突然下り線（右トラック）にワープするケースがある。

#### (2) 停留所ビューの接近プログレスバーにおける方向・始発固定問題
- **該当ファイルと行番号**:
  - `js/services/bus-location-service.js` (lines 1075–1090)
  - `js/ui/render-stop-view.js` (line 164)
  - `js/ui/step-timeline.js` (lines 286–319)
- **原因**:
  - `render-stop-view.js` で `busLocationService.get5StopApproachingStatus(realtimeBuses, activeStopKey)` を呼び出す際、選択中ののりば（ポール番号や方向）を渡していない。
  - 洋光台北口は「上大岡行き（上り）」、古泉も「上大岡行き（上り）」のシーケンスしか定義されておらず、下り方向（港南台方面・根岸方面）の接近バーが一切表示できない。
  - 上大岡駅前は `if (stopKey === 'kamiooka') return { isTerminus: true, statusText: '当駅始発' }` とハードコードされており、上大岡駅に接近中のバスがあっても「当駅始発」の静的バナーに固定され、接近情報が完全に無効化されている。
  - バスが停留所に停車中（`at_stop`）の際、ノード側にバスアイコンを描画するテンプレートがないため、バスアイコンが一時的に消滅する。
- **推奨修正案**:
  - `get5StopApproachingStatus` に方向・ポール引数を追加し、選択されたのりばに応じた手前5停留所列を動的に解決する。
  - 上大岡駅前でも接近中バスがある場合はプログレスバーを描画する。

---

### 【項目8】UI/CSS・DOM・イベントリスナーの不整合とレースコンディション

#### (1) 方向切り替えボタン等の連打による非同期レースコンディション
- **該当ファイルと行番号**:
  - `js/app.js` (lines 260–264, lines 479–483, lines 669–740)
- **原因**:
  - 方向反転ボタン（`#btn-swap-direction`）を押すと `this.toggleDirection()` が呼ばれ、非同期の `this.renderAll()` が実行される。
  - しかし連打防止やリクエストの世代管理（キャンセル処理）がない。
  - `renderTransferView()` 内で `await Promise.all(...)` を実行中に再度ボタンが押されると、取得中の時刻表データ（古泉発・133系統）に対して反転後の状態（`this.direction === 'outbound'`）で `t.line.includes('111')` のフィルタをかけてしまい、データが0件になって突然「⚠️ 時刻表データを取得できませんでした」エラーが発生する。
- **推奨修正案**:
  - 非同期描画に世代ID（`this._renderGeneration = (this._renderGeneration || 0) + 1`）を導入し、最新世代以外の結果を破棄する。またボタン連打にデバウンス処理（300ms）を適用する。

#### (2) 設定ボタン押下時のモーダル表示とタブ切り替えの多重発火競合
- **該当ファイル**:
  - `js/app.js` (lines 267–271)
  - `js/ui/render-modal.js` (lines 100–102)
- **原因**:
  - ヘッダー右上の設定ボタン（`#btn-settings` 等）に対して、`render-modal.js` が「設定モーダルを開く」イベントをバインドし、同時に `app.js` が「設定タブに切り替える」イベントをバインドしているため、両方が多重発火して競合する。
- **推奨修正案**:
  - `PROJECT.md` の方針（「クイック設定モーダルを廃止し、設定ビューへ直接遷移」）に従い、`render-modal.js` 側の設定モーダルオープンリスナーを削除する。

#### (3) インライン時刻表グリッドでの0時台深夜便の消滅
- **該当ファイル**:
  - `js/ui/render-stop-view.js` (lines 316–336, 347–378)
- **原因**:
  - `hourMap` が 5〜24時 で初期化されているため、`00:15` 発の便は `h = 0` となり、`hourMap[0]` が存在せず配列から破棄される。
- **推奨修正案**:
  - `h === 0` を `h = 24`（24時台）にマッピングするか、0時台キーをサポートする。

#### (4) テーマ切り替えボタンのトグル不整合
- **該当ファイル**:
  - `js/app.js` (lines 285–297)
  - `js/services/storage-service.js` (lines 142–155)
- **原因**:
  - `app.js` では `localStorage.setItem('app_theme', nextTheme)`、`storage-service.js` では `STORAGE_KEYS.THEME`（`transporter_theme`）に保存しており、キー名が不整合。
  - またデフォルトが `'system'` の場合、OSがダークモードだと `(cur === 'dark') ? 'light' : 'dark'` が `'dark'` になり、1回目のクリックで何も変化しない。
- **推奨修正案**:
  - 保存キーを `STORAGE_KEYS.THEME` に統一し、メディアクエリ（`matchMedia`）を参照して確実にテーマを反転させる。

---

## 3. 修正優先度・対応ロードマップ

| 優先度 | 項目 | 影響度 | 修正対象ファイル |
|:---|:---|:---|:---|
| **最高 (P0)** | **行先判定 `dest.includes('')` バグ** | 全系統の行先表示が誤判定される | `js/api/odpt-client.js`<br>`generate_timetable.js` |
| **最高 (P0)** | **古泉バス停 1810.2（根岸方面）データ欠落** | 根岸方面の時刻表が一切見られない | `generate_timetable.js`<br>`js/ui/render-stop-view.js`<br>`js/config.js` |
| **高 (P1)** | **方向反転連打の非同期レースコンディション** | 連打で「時刻表取得失敗」エラーになる | `js/app.js` |
| **高 (P1)** | **GPS自動遷移によるユーザー操作の上書き** | 操作中に勝手に画面や方向が変わる | `js/app.js`<br>`js/services/location-service.js` |
| **中 (P2)** | **APIキー未設定時のタブ間表示不整合** | 乗り換えタブはエラー、停留所は表示 | `js/app.js`<br>`js/api/odpt-client.js` |
| **中 (P2)** | **上大岡駅前のりば「11番」誤表記** | 実際は6番のりば | `js/services/transfer-service.js` |
| **中 (P2)** | **深夜帯・日跨ぎ乗り継ぎ計算の破綻** | 23〜0時台の乗り継ぎ案内が失敗する | `js/services/transfer-service.js`<br>`js/services/timetable-service.js` |
| **低 (P3)** | **複線図en_route描画位置 & 接近バー方向固定** | バスの描画位置や始発表示の違和感 | `js/services/bus-location-service.js`<br>`js/ui/step-timeline.js` |
| **低 (P3)** | **インライン時刻表0時台便消滅** | 深夜終バスが表示されない | `js/ui/render-stop-view.js` |
| **低 (P3)** | **テーマキー重複 & 設定イベント多重登録** | モーダルとタブの競合、キー不整合 | `js/app.js`<br>`js/ui/render-modal.js` |
| **最高 (P0: 解決済)** | **停留所タブ走行中・接近情報 & 便マッチング破綻** | 2分後発車便に14駅前のバスが紐づく、上大岡駅前のリアルタイムステータス消滅、逆方向バス混入 | `js/services/timetable-service.js`<br>`js/services/bus-location-service.js`<br>`js/ui/step-timeline.js`<br>`js/ui/render-stop-view.js` |

---

### 【追補】停留所タブ「走行中・接近情報」不具合の完全是正（コミット `a0342f1`）

1. **時刻表便とリアルタイムバスのマッチング破綻 (`timetable-service.js`)**
   - **原因**: `minTimeDiff` が出発時刻（分数）の最小値と比較されていたため、現在時刻に関係なく早朝便にバスが吸い込まれるか、直近便に14駅前のバスが機械的に紐づいていた。
   - **是正**: バスの現在地（`fromStop`, `toStop`, `stopsAway`）から目的停留所までの想定所要時間（1停留所約2分＋遅延）と現在時刻を組み合わせ、**推定到着時刻が最も合致する便にのみジャストフィットでマッチング**するよう刷新。通過済みバスの除外も徹底。
2. **手前5停留所接近バーの判定・表示破綻 (`bus-location-service.js`, `step-timeline.js`)**
   - **原因**:
     - 上大岡駅前が `stopKey === 'kamiooka'` で固定され、リアルタイム運行状態が完全に遮断されていた。
     - バス行先が空文字の際に逆方向（11100下り便）が上り接近バーに誤混入していた。
     - 5停留所以上離れたバスで「10つ前」という不自然な日本語とバーの空白化が発生していた。
     - 走行中（`en_route`）に現在位置詳細テキスト（`detailText`）が常に空になっていた。
   - **是正**:
     - `odpt:busroutePattern`（11101/11100, 13300/13303）による方向隔離を最優先とし、逆方向バスを完全排除。
     - 上大岡駅前（6番/12番）において「🚍 乗り場に停車中（ご乗車いただけます）」、「⚡ まもなく入線」のリアルタイムステータス判定・バナー表示を新設。
     - 5停留所以遠の表現を「○停留所手前を走行中（【○○】発車 ➔ 【○○】へ走行中）」と自然で具体的なテキストに改善。
3. **ポールIDハードコード (`render-stop-view.js`)**
   - **是正**: `'7800.1'` 固定を排除し、`activeStopKey` と `activePole` から動的に正しい `poleId` を解決。古泉の双方向時刻表フォールバックも適正化。

---

### 【追補2】先発便Heroカードと走行中接近バーの完全同期・所定時刻超過便の保持

「先発便と走行中が連動していなかった」不具合の徹底調査により判明した根本原因および修正内容：

1. **先発便Heroカードにおける走行区間・接近バッジの欠落是正 (`render-stop-view.js`)**
   - **問題**: 後続便リストには「🚍 ○○〜○○間 (あと○駅)」というリアルタイム走行区間が表示されていたが、最も大きく目立つ先発便Heroカード（`firstHeroHtml`）には `locationStatus` が一切埋め込まれておらず、走行中なのかどうかが不明瞭だった。
   - **是正**: 先発便カード内に `stepTimelineComponent.renderMini(firstDep.locationStatus)` を新設の `.hero-mini-loc` として組み込み、先発便カード自体に「🚍 ○○〜○○間 (あと○駅)」が直結表示されるよう同期。

2. **先発便と手前5停留所接近バーの完全連動 (`bus-location-service.js`)**
   - **問題**: `get5StopApproachingStatus` が先発便（`firstDep`）とは無関係にバス配列から独立して探索していたため、先発便が定刻運行予定（手前にバスがいない）なのにバーが別のバスを表示したり、先発便の遅延・位置とバーの遅延・位置が食い違っていた。
   - **是正**: `get5StopApproachingStatus` に第4引数 `preferredDep`（先発便）を追加。先発便に紐づいた `matchedBus` や `locationStatus` を最優先で接近バーに反映。先発便が定刻運行予定（`scheduled`）の場合は、後続用のバスを誤って先発便バーに出さないよう完全同期化。

3. **所定時刻経過時の便消失バグ是正 (`timetable-service.js`)**
   - **問題**: `getNextDepartures` において `diffSec < -120`（所定時刻から2分経過）で機械的に便が除外されていたため、バスが遅延していて停留所手前（まもなく到着）にいるにもかかわらず所定時刻の2分後に先発便が画面から消滅。次の便（20分後等）が先発便に繰り上がってしまい、走行中バー（まもなく到着）とHeroカード（20分後・定刻）で完全に分裂していた。
   - **是正**: バスが遅延していてまだ停留所手前（`at_stop`, `approaching`, `en_route (stopsAway <= 3)`）にいる場合は、所定時刻を過ぎても通過（`passed`）するまで先発便として保持し、15分以上経過した完全なゴースト便のみを除外するよう改修。


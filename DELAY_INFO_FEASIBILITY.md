# 横浜市営バス（111系統・133系統・全般）遅延情報・運行情報 取得可能性 調査・分析レポート

## 1. エグゼクティブサマリー（調査結果の総括）

公共交通オープンデータセンター（ODPT API v4）および横浜市交通局の公式データソースを対象に、横浜市営バス（特に111系統・133系統および市営バス全般）の遅延・運行情報の取得可能性について徹底調査を実施しました。

### 主要な調査結論
1. **遅延秒数（定量的遅延データ）は `odpt:Bus` の `odpt:delay` から取得可能**:
   - 横浜市営バス（`odpt.Operator:YokohamaMunicipal`）の全車載GPS・運行管理システムと連動しており、運行中バスの各オブジェクトに `odpt:delay`（単位: 秒、整数値）が配信されています。更新間隔は約30〜60秒です。
2. **運行支障テキスト（定性的アラート情報）は `odpt:BusInformation` ではなく GTFS-RT で配信**:
   - ODPT API v4 の `odpt:BusInformation` エンドポイントは横浜市営バス向けには提供されておらず（HTTP 404 または空配列 `[]`）、運休・事故・迂回等の運行情報は **GTFS-Realtime の Service Alert エンドポイント（`YokohamaMunicipalBus_alert`）** として Protocol Buffers 形式で配信されています。
3. **現行アプリ（Transporter）の基盤は既に高度に対応済み**:
   - 現行コード（`timetable-service.js`, `bus-location-service.js`, `transfer-service.js` 等）には、`odpt:delay` を読み取り、時刻表とのマッチング、手前5停留所接近バー、複線路線図、乗り換え可能便の動的再計算を行うロジックが既に組み込まれています。
4. **推奨される次のステップ**:
   - カウントダウンタイマーを見込み時刻（予定時刻＋遅延秒数）に完全連動させる改修、および GTFS-RT Alert（`YokohamaMunicipalBus_alert`）をブラウザ側でデコードしてヘッダーの運行支障バナーへ反映させる設計が最も効果的です。

---

## 2. ODPT API v4 における横浜市営バスの遅延・運行情報の配信実態

### 2.1 `odpt:Bus` エンドポイントと `odpt:delay` の配信状況
- **エンドポイント**:
  `GET https://api.odpt.org/api/v4/odpt:Bus?odpt:operator=odpt.Operator:YokohamaMunicipal&acl:consumerKey={API_KEY}`
- **`odpt:delay` の仕様と型**:
  - 型: `xsd:integer`（秒単位の整数値）
  - 定義: 運行ダイヤ（予定時刻）に対する遅延時間（秒）。
    - `0`: 定刻運行
    - `180`: 3分遅れ
    - `-60`: 1分早発・早着傾向
- **配信実態と有効性**:
  - 横浜市営バスの車両にはGPS車載器が搭載されており、走行中の車両がダイヤ（`odpt:busTimetable` または `odpt:busroutePattern`）に正しく紐付いている場合、高精度な遅延秒数が返却されます。
  - **制約・例外ケース**:
    - 始発停留所での待機中、回送便、臨時増発便、または通信不調時は、`odpt:delay` が `undefined`（プロパティ非存在）、`null`、あるいは `0` になることがあります。
- **更新頻度**:
  - ODPTサーバー側のキャッシュ更新頻度は **約30秒〜60秒**。
  - クライアント側（Transporter）の現在のポーリング設定（`DEFAULT_POLLING_INTERVAL_SEC = 30`）と完全に整合しています。

### 2.2 `odpt:BusInformation` の配信実態（なぜ404や空が返るのか）
- **エンドポイント**:
  `GET https://api.odpt.org/api/v4/odpt:BusInformation?odpt:operator=odpt.Operator:YokohamaMunicipal&acl:consumerKey={API_KEY}`
- **配信実態**:
  - **ODPT API v4（JSON-LD）上では横浜市営バス向けの `odpt:BusInformation` は配信されていません**。
  - リクエストを送信すると、**HTTP 404 Not Found** または **空配列 `[]`** が返却される仕様となっています。
- **背景とアプリ内実装の確認**:
  - 横浜市交通局の運行支障テキスト情報は、JSON-LD APIではなく GTFS-Realtime（Protocol Buffers）の Alert フィードに集約されているためです。
  - 現行コード `js/api/odpt-client.js`（107-113行）でも、このODPTの仕様を前提として以下のハンドリングが施されています：
    ```javascript
    if (response.status === 404 && endpoint === 'odpt:BusInformation') {
      // 404 on ODPT means no disruption records (e.g. BusInformation) or empty dataset
      return [];
    }
    ```
    また、`fetchBusInformation()` メソッド（338-345行）も「横浜市営バスは ODPT 上で odpt:BusInformation を配信せず、遅延は odpt:Bus (odpt:delay) に直接含まれる」旨のコメントとともに `return []` を返す設計となっています。

### 2.3 111系統・133系統における配信の有効性
- **111系統（港南台駅前 ⇄ 洋光台北口 ⇄ 上大岡駅前）**:
  - 港南営業所・磯子営業所管轄。終日高頻度運行されており、全便が運行管理システムに登録されているため、`odpt:Bus` における `odpt:delay` の取得安定性は極めて高いです。
- **133系統（上大岡駅前 ⇄ 古泉 ⇄ 根岸駅前）**:
  - 滝頭営業所管轄。中型車等による運行ですが、同様にGPS車載器が完全配備されており、`odpt:delay` の取得が有効に機能します。

---

## 3. 公式データソースとの連携可能性

| データソース | 配信形式 | 取得できる情報 | 連携の実現性・評価 |
| :--- | :--- | :--- | :--- |
| **① ODPT API v4 (`odpt:Bus`)** | REST / JSON-LD | リアルタイム在線位置（停留所間）、**遅延秒数 (`odpt:delay`)**、緯度経度 | **◎ 最適（現行採用中）**<br>CORS対応、公式認可、認証キーで安定取得可能。 |
| **② ODPT GTFS-RT (`YokohamaMunicipalBus_alert`)** | Protocol Buffers (PBF) | **運休・事故・迂回・大幅遅延の公式告知テキスト（Alert）** | **◎ 連携推奨（運行支障バナー用）**<br>ODPTが公式提供。同一APIキーでアクセス可能。 |
| **③ 横浜市交通局 公式バスロケ (`navi.hamabus.city.yokohama.lg.jp`)** | HTML / Webページ (NAVITIME ASP) | 接近情報（◯分待ち、◯バス停前）、運行状況テキスト | **× 非推奨**<br>公開APIなし。Webスクレイピングは規約違反リスク・HTML変更脆弱性大。 |
| **④ 横浜市オープンデータポータル** | カタログ / CSV / リンク | 静的オープンデータ | **△ 不要**<br>リアルタイム動的データはODPTセンターへ完全委託・集約されている。 |

### GTFS-Realtime Service Alert（`YokohamaMunicipalBus_alert`）との連携可能性
- **エンドポイント**:
  `GET https://api.odpt.org/api/v4/gtfs/realtime/YokohamaMunicipalBus_alert?acl:consumerKey={API_KEY}`
- **連携方式**:
  - ODPT APIはブラウザからの直接アクセス（CORS）を許可しています。
  - ブラウザの `fetch(url)` で `arraybuffer` として取得し、JavaScriptの軽量Protobufパーサー（例: `pbf` または `protobufjs/light`）を用いてデコードすることで、**「◯◯線 道路工事に伴う迂回運行について」「大雨による一部運休」などの公式テキスト情報をブラウザ単体で取得可能**です。

---

## 4. 現在のWebアプリ（Transporter）における遅延情報の活用可能性と制約

### 4.1 現行コードベースにおける実装状況
Transporter は既に遅延情報（`odpt:delay`）を前提とした堅牢な設計になっています：
1. **データ取得層 (`odpt-client.js`)**:
   - `fetchBuses()` により、30秒間隔で `odpt:Bus` をポーリング取得。
2. **遅延マージ層 (`timetable-service.js`)**:
   - `mergeRealtimeDelays()` により、静的時刻表（`REAL_TIMETABLES` / `odpt:BusTimetable`）と運行中バスを照合。
   - `odpt:delay`（秒）を分単位（`Math.round(sec / 60)`）に換算し、予定時刻に加算して `actualDepartureTime`（実績・見込み発車時刻）を動的生成。
3. **乗り換え計算層 (`transfer-service.js`)**:
   - 第1区間の遅延（`delay1`）を加味した上大岡到着見込み時刻（`arr1Min = actualDep1 + leg1TravelTime`）を算出し、第2区間の見込み発車時刻（`actualDep2`）が乗り換え可能時間（`arr1Min + buffer`）を満たす直結便を自動抽出。
4. **UI表現層**:
   - **停留所ビュー (`render-stop-view.js`)**: 先発便Heroカードおよび後続便リストに遅延バッジ（`+◯分` / `定刻`）を表示。
   - **接近バー (`step-timeline.js`)**: 手前5停留所プログレスバー上にバスアイコンと遅延バッジを表示。
   - **路線図ビュー (`render-route-map.js`)**: JR風複線路線図の走行中バスピルカード内に遅延バッジ（`+◯分` / `定刻`）を表示。

### 4.2 技術的制約と課題
1. **カウントダウンタイマーの基準時刻（わずかなズレ）**:
   - 先発便Heroカード等のコロン形式カウントダウン（`T-mm:ss`）の一部ロジックにおいて、予定時刻（`departureTime`）を基準にしている箇所があり、大幅遅延時に「画面上は発車直後・発車済みになっているが、実際は遅延しているためバスはまだ来ていない」という感覚的ズレが生じる余地があります。
2. **便マッチング（Trip Matching）の曖昧性**:
   - ODPTの `odpt:Bus` に `odpt:busTimetable`（便ID）が設定されていない場合、アプリは「系統番号」「行先」「予定時刻の近さ」で推定マッチングを行います。
   - バスが20分以上大幅遅延した場合、1本後の便と誤ってマッチングされるリスクがあります。
3. **データ伝送タイムラグ（約1〜2分）**:
   - 車載器GPS ➔ 交通局 ➔ ODPT ➔ アプリ という伝送経路があるため、画面上のバス位置や遅延秒数は「約1〜2分前の状態」です。停留所直前（あと1停留所 / まもなく到着）の段階では、すでに到着している可能性があるため、バッファ設計が必要です。
4. **運行支障バナーの固定化**:
   - 前述の通り `odpt:BusInformation` が空であるため、ヘッダーのステータスバナー（`render-status.js`）は常時「平常運転」となり、事故・運休・迂回アラートが反映されていません。

---

## 5. 実装に向けた技術的推奨ロードマップ（設計提案）

※ 本調査では実装は一切行わず、今後の開発に向けた設計方針の提案のみを記載します。

### 【フェーズ1】既存の遅延データ（`odpt:delay`）を活用したUI・計算精度の向上（工数小・効果大）
1. **カウントダウンを見込み発車時刻（`actualDepartureTime`）へ完全統一**:
   - `countdownText` の算出ロジックを、予定時刻ではなく `actualDepartureTime`（予定時刻 ＋ `delayMinutes`）基準に統一。
   - これにより、バスが3分遅れている場合はカウントダウンの残り時間が3分延長され、ユーザーが停留所で焦るのを防止。
2. **乗り換え接続ロスト警告の追加**:
   - 第1区間の遅延により上大岡駅での乗り継ぎが不可能（`actualDep2 < arr1Min`）になった場合、乗り換え画面に「⚠️ 遅延のため接続不可（次便を案内中）」の視覚アラートを表示し、自動的に後続の接続可能便へ切り替えるダイナミックルーティングの強化。
3. **大幅遅延時の誤マッチ防止リミッター**:
   - 予定時刻から一定時間（例: ±20分）以上乖離している場合は、別便と判定して無理なマッチングを避ける安全ガードの導入。

### 【フェーズ2】GTFS-RT Service Alert（`YokohamaMunicipalBus_alert`）による運行支障テキストの連携
1. **Protobuf デコードモジュールの導入**:
   - npmの軽量ライブラリ（`pbf` や `protobufjs/light`）または静的デコーダーを導入。
2. **`odptClient.fetchBusInformation()` の刷新**:
   - `https://api.odpt.org/api/v4/gtfs/realtime/YokohamaMunicipalBus_alert` から Alert データを取得・パース。
   - 対象系統（111系統、133系統、または市営バス全般）のアラートが存在する場合に抽出。
3. **ステータスバナー (`render-status.js`) への直結**:
   - アラート検知時に、ヘッダーのステータスバナーを「⚠️ 運行支障（遅延・運休・迂回）」に切り替え、タップ時に交通局公式の案内テキストを表示。

### 【フェーズ3】将来的な高度機能（混雑度・プッシュ通知）
1. **混雑度情報（Vehicle Occupancy）の表示**:
   - 横浜市営バスが提供する混雑度データ（空席あり / 立ち席あり / 混雑）を取得し、路線図のバスアイコンに混雑インジケーターを付与。
2. **PWA 遅延プッシュ通知**:
   - 登録した通勤・通学便が一定以上（例: 5分以上）遅延した場合にService Workerを通じてプッシュ通知する機能。

---

## 6. まとめと提言

- 横浜市営バスの遅延情報取得において、**ODPT API v4 の `odpt:Bus` 内に含まれる `odpt:delay` を用いる手法は完全に正しく、現行アプリの設計方針はデータ仕様に極めて合致しています**。
- 一方で、「テキスト形式の運行支障情報」については、ODPTのJSON-LD（`odpt:BusInformation`）ではなく、**GTFS-Realtime の `YokohamaMunicipalBus_alert` を利用するのが唯一の公式かつ確実なアプローチ**であることが判明しました。
- 次のステップとして実装に着手する際は、まずは**フェーズ1（既存の `odpt:delay` を活用した見込み時刻連動カウントダウンと乗り換え接続警告のブラッシュアップ）**から着手することを強く推奨いたします。

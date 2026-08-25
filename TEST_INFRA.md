# E2E Test Infra: Yokohama City Bus Transit Web App (transporter)

## Test Philosophy
- **Opaque-box & Requirement-driven**: 内部実装に依存せず、ユーザー要求（`ORIGINAL_REQUEST.md`, `REQUIREMENTS.md`）および受入基準（AC-1〜AC-8）に直接基づく。
- **Methodology**: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Interaction Testing + Real-World Workload Scenarios.
- **No-External-Service Dependency**: Node.js / JSDOM / Headless Browser 環境で完全に自己完結して実行可能。

## Feature Inventory & Test Coverage Goals
| # | Feature | Requirement Source | Tier 1 (単体/機能) | Tier 2 (境界/異常系) | Tier 3 (組み合わせ) | Tier 4 (実世界) |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | PWA Shell & Static App Loading | ORIGINAL_REQUEST R1, AC-1 | 5 | 5 | ✓ | ✓ |
| 2 | Yokohama Bus Theme & Dark Mode | ORIGINAL_REQUEST R1 | 5 | 5 | ✓ | ✓ |
| 3 | Bidirectional Direction Toggle | ORIGINAL_REQUEST R3, AC-2 | 5 | 5 | ✓ | ✓ |
| 4 | Single Leg & Stop View Tabs | ORIGINAL_REQUEST R3, AC-2 | 5 | 5 | ✓ | ✓ |
| 5 | Transfer Calculation (Buffer, Best/Next) | ORIGINAL_REQUEST R3, AC-3 | 5 | 5 | ✓ | ✓ |
| 6 | Bus Line & Destination Filtering | ORIGINAL_REQUEST R3, AC-4 | 5 | 5 | ✓ | ✓ |
| 7 | Settings Modal & Storage Persistence | ORIGINAL_REQUEST R2, AC-5 | 5 | 5 | ✓ | ✓ |
| 8 | Polling Timer, Manual Refresh & Time | ORIGINAL_REQUEST R2, AC-6 | 5 | 5 | ✓ | ✓ |
| 9 | ODPT API Fallback & Offline Resilience | ORIGINAL_REQUEST R2, AC-7 | 5 | 5 | ✓ | ✓ |
| 10 | Credit Notice & Metadata Display | ORIGINAL_REQUEST R2, AC-8 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Test Runner**: `node tests/e2e-runner.js`
- **Exit Code**: 0 if all tests pass, 1 if any failure occurs
- **Test Files**:
  - `tests/tier1-feature-tests.js` (Tier 1: Feature Coverage, >= 50 test cases)
  - `tests/tier2-boundary-tests.js` (Tier 2: Boundary & Corner Cases, >= 50 test cases)
  - `tests/tier3-combination-tests.js` (Tier 3: Pairwise Combinations, >= 15 test cases)
  - `tests/tier4-scenario-tests.js` (Tier 4: Real-World Workload Scenarios, >= 8 test cases)

## Coverage Thresholds
- **Tier 1**: $\ge 50$ test cases
- **Tier 2**: $\ge 50$ test cases
- **Tier 3**: $\ge 15$ test cases
- **Tier 4**: $\ge 8$ test cases
- **Total Minimum**: $\ge 123$ automated test cases

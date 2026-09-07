# Project Polaris

アクセスログを、人とAIが確認できる構造化された観測情報へ変換するプロダクト。

設計書は [`md/`](md/) 配下にある。実装はまず `md/26_Development_Setup_and_First_Sprint.md` の Sprint 1（リポジトリ基盤 + Analyzer Parser / Normalizer）から開始している。認証・課金はまだ実装していない。

---

## Requirements

- Node.js `20.19.0`（[`.node-version`](.node-version) 参照）
- Yarn `1.22.15`（Classic / Workspaces）
- Docker（ローカルの PostgreSQL / Redis / MinIO 用）

## Install

```bash
yarn install
```

## Environment

必要な環境変数は [`.env.example`](.env.example) に名前のみ記載している。ローカル開発用に `.env` を作成しコピーする。

```bash
cp .env.example .env
```

`DATABASE_URL` / `REDIS_URL` / `S3_*` / `APP_BASE_URL` は必須（`packages/shared` の Zod スキーマが起動時に検証し、不足時は Fail Fast する）。`MAX_UPLOAD_BYTES`（既定 50MB）/ `RAW_LOG_RETENTION_HOURS`（既定 24時間）/ `AI_MAX_OUTPUT_TOKENS`（既定 4096）/ `AI_MAX_INPUT_BYTES`（既定 200000 byte）はベンチマーク前の仮値で、いずれもConfig化されており無制限にはならない。`AI_PROVIDER`は既定`openai`（Sprint 6時点で対応するのはOpenAIのみ）。`OPENAI_MODEL`は実際にAI Explanationを動かす場合のみ必須（未設定でもCIは通る — 後述のFake AI Providerのみを使うため）。`OPENAI_API_KEY` / `OPENAI_REASONING_EFFORT` / `CLERK_*` / `STRIPE_*` は任意。

`.env` はコミットしない。Secret Value を `.env.example` へ書かない。

## Docker

ローカルの PostgreSQL / Redis / MinIO を起動する。

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

| Service | Host Port |
| --- | --- |
| PostgreSQL | 55432 |
| Redis | 16379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |

PostgreSQL / Redis は他プロジェクトの標準ポート(5432 / 6379)との衝突を避けるため非標準ポートを使う。`DATABASE_URL` / `REDIS_URL` はこのポートで設定する。Redis は `56379` ではなく `16379` を使う — `56379` は Windows/Hyper-V の動的ポート除外範囲に含まれており bind に失敗するため(`netsh interface ipv4 show excludedportrange protocol=tcp` で確認可能)。

MinIO は `:latest` ではなくタグ固定(`RELEASE.2025-09-07T16-13-09Z`)を使う。MinIO の Docker Image は 2023 年に `curl`/`wget` が `$PATH` から削除されておりコンテナ内 Healthcheck が機能しないため、Healthcheck は CI 側の Step から `curl` で待ち受ける形にしている。

## Database Migration

`packages/db` は Prisma 7（`prisma-client` Generator + `@prisma/adapter-pg` Driver Adapter）で PostgreSQL に接続する。接続先は `schema.prisma` ではなく `packages/db/prisma.config.ts` が `DATABASE_URL` から読む。

```bash
yarn db:migrate:dev      # ローカル: Migration作成 + 適用
yarn db:migrate:deploy   # CI/本番相当: 既存Migrationの適用のみ
```

Prisma Clientの型は `yarn install` の `postinstall` で自動生成される（`packages/db/src/generated/prisma/`、Gitには含めない）。Schemaを変更した場合は手動で `yarn workspace @polaris/db run generate` を再実行する。

## Development

`apps/web`（Vue 3 + Vite）はBackend（`tsc -b`のProject Reference Graph）から独立したToolchainを持つ（`vue-tsc` / Vite自身のType Check）。Root Scriptはこの境界に沿って`:backend` / `:frontend`に分割しており、CIはこの分割済みScriptを個別のStepとして呼ぶ（重複実行防止, `md/40_Sprint_5_Plan_Review.md` F-03）。素の`typecheck` / `test` / `build`はローカルでの一括実行用。

```bash
yarn typecheck   # = typecheck:backend && typecheck:frontend
yarn test        # = test:backend && test:frontend
yarn build       # = build:backend && build:frontend
yarn lint        # eslint
yarn format      # prettier --write
```

各Workspaceは `yarn workspace @polaris/<name> <script>` で個別に実行できる。

### API / Worker をローカルで動かす

Docker Compose（PostgreSQL / Redis / MinIO）が起動している状態で、Migrationを適用してからそれぞれBuildして起動する。

```bash
yarn db:migrate:dev
yarn workspace @polaris/api build && yarn workspace @polaris/api start      # http://localhost:3001
yarn workspace @polaris/worker build && yarn workspace @polaris/worker start
```

API最小Endpoint（`md/34_Development_Setup_and_Fourth_Sprint.md` §50）：

```text
POST /projects/:projectId/analyses      Analysis作成
POST /analyses/:analysisId/upload       Raw Access Log Upload（multipart/form-data, フィールド名 "file"）
GET  /analyses/:analysisId              Status Polling
GET  /analyses/:analysisId/observations ObservationSet取得（未生成時は404）
```

Analyzer本体はAPI Process内では実行しない。UploadはTemporary Storageへ保存後、Redis/BullMQ経由でWorkerへEnqueueされ、Worker側でAnalyzerを実行してPostgreSQLへPersistし、成功後にRaw Access Logを削除する。

Sprint 5でProject / Analysis一覧・作成のEndpointを追加し、APIの Error Response は全Route共通で `{ error: { code, message } }` 形式になった。

```text
POST /projects                          Project作成
GET  /projects                          Project一覧（Analysis数 / 最終Analysis日時付き）
GET  /projects/:projectId               Project詳細
GET  /projects/:projectId/analyses      Project配下のAnalysis一覧
```

Sprint 6でAI Explanation用のEndpointを追加した。Analyzer成功後、`Analysis.aiStatus`は`not_requested → queued → running → success | failed`と遷移する（`GET /analyses/:analysisId`のDTOで参照可能）。

```text
GET  /analyses/:analysisId/explanation        AI Explanation取得（未生成/失敗時は404/409）
POST /analyses/:analysisId/explanation/retry  AI Explanationの再試行（失敗後のみ; 既存成功結果は再生成しない）
```

### Web (Vue) をローカルで動かす

API（`http://localhost:3001`）が起動している状態で、別Terminalで:

```bash
cp apps/web/.env.example apps/web/.env   # VITE_API_BASE_URL
yarn workspace @polaris/web run dev      # http://localhost:5173
```

## Test

```bash
yarn test
```

Analyzerのテストは [`fixtures/access-logs/`](fixtures/access-logs/) の合成データ（実案件ログは含まない）を使う。

`apps/product-e2e` は apps/api・apps/worker・apps/webの実コードを1Processに組み合わせたProduct Integration Test（Project作成→Upload→実Worker処理→Polling→Result画面→Path Aggregation表示→行Click→Detail Drawer表示→AI Explanation生成完了→Finding表示→関連データへの遷移）。Analyzer WorkerだけでなくAI Explanation Worker（`AIProvider`はFake実装 — 実OpenAI呼び出しはCIで一切行わない）も同一Processで起動する。Docker ComposeのPostgreSQL/Redis/MinIOに対して実行するため、`apps/api` / `apps/worker` を先にBuildしておく必要がある（`exports`のSubpath経由でdist/を読むため）。

```bash
yarn build:backend
yarn workspace @polaris/product-e2e run test
```

## Build

```bash
yarn build
```

---

## Repository Structure

```text
polaris/
├─ apps/
│  ├─ web/           Vue 3 + Vite Frontend（Project / Analysis / Result画面）
│  ├─ api/           Fastify HTTP API（Project / Analysis CRUD, Upload / Status / Observations Endpoint）
│  ├─ worker/        BullMQ Worker（Analyzer Job / Raw Log Delete Retry / Cleanup）
│  └─ product-e2e/   apps/web・api・workerを実Infra上で結合するProduct Integration Test
│
├─ packages/
│  ├─ domain/    Framework非依存のDomain型（Project / Analysis / UploadedAccessLog / AnalysisExecution 等）
│  ├─ analyzer/  Analyzer Core（Parser / Normalizer / Aggregation / Known Information / ObservationSet）
│  ├─ ai/        AI Explanation連携（Prompt Builder / OpenAI Responses API Adapter / Schema・Grounding Validation）
│  ├─ db/        Prisma Client / Repository（Project / Analysis / ObservationSetRecord /
│  │              ProjectKnownInformation / UploadedAccessLog / AnalysisExecution）
│  ├─ queue/     BullMQ Queue境界（Queue名 / Job Payload型 / Connection Factory / enqueue）
│  ├─ storage/   Temporary Object Storage境界（S3/MinIO Adapter, Storage Key生成）
│  └─ shared/    複数Layer共通のUtility（Environment Validation等）
│
├─ fixtures/
│  └─ access-logs/   Synthetic Access Log Fixture
│
├─ infra/
│  └─ docker/         docker-compose.yml
│
├─ md/                 設計書（00〜35）
└─ .github/workflows/  CI
```

### Sprint 1 のスコープ

`md/26_Development_Setup_and_First_Sprint.md` に定義された S1-01〜S1-18 に対応する。

含む：リポジトリ / Workspace基盤、TypeScript Strict Mode、Environment Validation、Docker Compose、Domain Status型、Analyzerの Streaming Reader / Parser / Normalizer / Parse Summary、Synthetic Fixture、CI。

含まない（意図的にスコープ外）：Vue画面の作り込み、Clerk、Stripe、OpenAI、BullMQ本実装、Full Prisma Schema、Aggregation、Known Information、Candidate Selection、ObservationSet、Production Deploy。

### Sprint 4 のスコープ

`md/34_Development_Setup_and_Fourth_Sprint.md` に定義された S4-01〜S4-50 に対応する。

含む：Redis/BullMQ Queue（`packages/queue`）、Temporary Object Storage（`packages/storage`, MinIO/S3 Compatible）、Upload Lifecycle、Analyzer Worker（CAS/Idempotency Guard含む）、Raw Log Delete + Retry + Cleanup、Retry Classification、最小Fastify API、PostgreSQL/Redis/MinIO実Integration Test。

含まない（意図的にスコープ外）：Vue Aggregation UI、AI Explanation、Authentication、Billing、Report/CSV Export、WebSocket/SSE、Compressed Log Upload、Direct Signed URL Upload、Production Deploy。

最重要不変条件：ObservationSet Persist成功前にRaw Access Logを削除しない（詳細は `md/34_Development_Setup_and_Fourth_Sprint.md` §5、実装判断の経緯は `md/35_Sprint_4_Plan_Review.md` 参照）。

### Sprint 5 のスコープ

`md/39_Development_Setup_and_Fifth_Sprint.md` に対応する。

含む：`apps/web`（Project作成・一覧、Analysis作成・Upload・Processing Polling、Result画面のPath/Source IP/Status/Method/User-Agent/Time Aggregation Tab、Detail Drawer）、`apps/api`のProject/Analysis一覧・詳細Endpoint追加とError Response形式の統一、`apps/product-e2e`（実Infra上のProduct Integration Test）。

含まない（意図的にスコープ外, `md/10_Output_Presentation.md`）：AI Explanation（Sprint 6）、Authentication、Billing、Health/Risk/Severity/Priority Score（恒久的にスコープ外）、Raw Log Viewer、WebSocket/SSE。

### Sprint 6 のスコープ

`md/44_Development_Setup_and_Sixth_Sprint.md` に対応する。

含む：`packages/ai`（Prompt Builder / Zod Schema・Grounding Validation / OpenAI Responses API Adapter / Provider Registry）、AI Queue（`packages/queue`）とAI Explanation Worker（`apps/worker`、Analyzer成功後に自動Enqueue、`Analysis.aiStatus`のLifecycle管理、Retry Classification、Crash-after-Persist Recovery）、`AIExplanationRecord`のPersistence（`packages/db`）、`apps/api`のAI Explanation取得・再試行Endpoint、`apps/web`のResult画面AI Section（Overall Urgency / AI Summary / Findings / Retry UI、Aggregationへの関連データ遷移）、`apps/product-e2e`へのAI Worker追加。

最重要不変条件（`md/44_Development_Setup_and_Sixth_Sprint.md`）：AIの失敗はAnalyzerの失敗として見せない（`Analysis.status`は常に`completed`のまま、`aiStatus`だけが`failed`になる）。AI出力はAnalyzerの観測事実と視覚的に区別する（Fact/Interpretationのセクション分離、常に「AIによる」ラベル付き）。Risk/Severity/Priority/Finding単位のUrgencyは存在しない — `overallUrgency`は「どの程度早く確認すべきか」のみを表す。Raw Access LogはAIへ一切送信しない（送信対象はObservationSetのみ）。CIは実OpenAI呼び出しを一切行わず、Worker/API/Product Integration Testの全てでFake AI Providerのみを使う。

含まない（意図的にスコープ外）：AI Provider選択UI（`AI_PROVIDER`は`openai`固定）、Billing/Entitlementによる機能制限、Chat形式のAI対話（`PromptPurpose`は`'initial_summary'`のみ）、Production Deploy。

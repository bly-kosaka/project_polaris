# Project Polaris

アクセスログを、人とAIが確認できる構造化された観測情報へ変換するプロダクト。

設計書は [`md/`](md/) 配下にある。実装はまず `md/26_Development_Setup_and_First_Sprint.md` の Sprint 1（リポジトリ基盤 + Analyzer Parser / Normalizer）から開始している。UI・認証・課金・AI連携はまだ実装していない。

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

`DATABASE_URL` / `REDIS_URL` / `S3_*` / `APP_BASE_URL` は必須（`packages/shared` の Zod スキーマが起動時に検証し、不足時は Fail Fast する）。`MAX_UPLOAD_BYTES`（既定 50MB）/ `RAW_LOG_RETENTION_HOURS`（既定 24時間）はベンチマーク前の仮値で、両方とも Config化されており無制限にはならない。`OPENAI_API_KEY` / `CLERK_*` / `STRIPE_*` は該当機能が未実装のため現時点では任意。

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

```bash
yarn typecheck   # tsc -b（全Workspace）
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

Analyzer本体はAPI Process内では実行しない。UploadはTemporary Storageへ保存後、Redis/BullMQ経由でWorkerへEnqueueされ、Worker側でAnalyzerを実行してPostgreSQLへPersistし、成功後にRaw Access Logを削除する。Project作成用の公開APIは本Sprintでは未実装で、Test/Fixtureからは`packages/db`のRepositoryを直接使う。

## Test

```bash
yarn test
```

Analyzerのテストは [`fixtures/access-logs/`](fixtures/access-logs/) の合成データ（実案件ログは含まない）を使う。

## Build

```bash
yarn build
```

---

## Repository Structure

```text
polaris/
├─ apps/
│  ├─ web/       Vue 3 + Vite Frontend（未実装のScaffoldのみ）
│  ├─ api/       Fastify HTTP API（Upload / Status / Observations Endpoint）
│  └─ worker/    BullMQ Worker（Analyzer Job / Raw Log Delete Retry / Cleanup）
│
├─ packages/
│  ├─ domain/    Framework非依存のDomain型（Project / Analysis / UploadedAccessLog / AnalysisExecution 等）
│  ├─ analyzer/  Analyzer Core（Parser / Normalizer / Aggregation / Known Information / ObservationSet）
│  ├─ ai/        AI Explanation連携（未実装）
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

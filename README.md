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

`DATABASE_URL` / `REDIS_URL` / `S3_*` / `APP_BASE_URL` は Sprint 1 のローカル基盤として必須（`packages/shared` の Zod スキーマが起動時に検証し、不足時は Fail Fast する）。`OPENAI_API_KEY` / `CLERK_*` / `STRIPE_*` は該当機能が未実装のため現時点では任意。

`.env` はコミットしない。Secret Value を `.env.example` へ書かない。

## Docker

ローカルの PostgreSQL / Redis / MinIO を起動する。

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

| Service | Port |
| --- | --- |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |

## Development

```bash
yarn typecheck   # tsc -b（全Workspace）
yarn lint        # eslint
yarn format      # prettier --write
```

各Workspaceは `yarn workspace @polaris/<name> <script>` で個別に実行できる。

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
│  ├─ web/       Vue 3 + Vite Frontend（Sprint 1では未実装のScaffoldのみ）
│  ├─ api/       Fastify HTTP API（同上）
│  └─ worker/    Queue Worker（同上）
│
├─ packages/
│  ├─ domain/    Framework非依存のDomain型（Lifecycle Status等）
│  ├─ analyzer/  Analyzer Core（Sprint 1: Parser / Normalizer / Streaming Reader）
│  ├─ ai/        AI Explanation連携（未実装）
│  ├─ db/        Prisma Client / Repository（未実装）
│  └─ shared/    複数Layer共通のUtility（Environment Validation等）
│
├─ fixtures/
│  └─ access-logs/   Synthetic Access Log Fixture
│
├─ infra/
│  └─ docker/         docker-compose.yml
│
├─ md/                 設計書（00〜26）
└─ .github/workflows/  CI
```

### Sprint 1 のスコープ

`md/26_Development_Setup_and_First_Sprint.md` に定義された S1-01〜S1-18 に対応する。

含む：リポジトリ / Workspace基盤、TypeScript Strict Mode、Environment Validation、Docker Compose、Domain Status型、Analyzerの Streaming Reader / Parser / Normalizer / Parse Summary、Synthetic Fixture、CI。

含まない（意図的にスコープ外）：Vue画面の作り込み、Clerk、Stripe、OpenAI、BullMQ本実装、Full Prisma Schema、Aggregation、Known Information、Candidate Selection、ObservationSet、Production Deploy。

# Project Polaris

アクセスログを、人とAIが確認できる構造化された観測情報へ変換するプロダクト。

設計書は [`md/`](md/) 配下にある。実装はまず `md/26_Development_Setup_and_First_Sprint.md` の Sprint 1（リポジトリ基盤 + Analyzer Parser / Normalizer）から開始している。認証（Clerk）はSprint 7で実装済み。課金（Stripe、Free/Pro Plan）はSprint 8で実装済み。

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

`DATABASE_URL` / `REDIS_URL` / `S3_*` / `APP_BASE_URL` は必須（`packages/shared` の Zod スキーマが起動時に検証し、不足時は Fail Fast する）。`MAX_UPLOAD_BYTES`（既定 50MB）/ `RAW_LOG_RETENTION_HOURS`（既定 24時間）/ `AI_MAX_OUTPUT_TOKENS`（既定 4096）/ `AI_MAX_INPUT_BYTES`（既定 200000 byte）はベンチマーク前の仮値で、いずれもConfig化されており無制限にはならない。`AI_PROVIDER`は既定`openai`（Sprint 6時点で対応するのはOpenAIのみ）。`OPENAI_MODEL`は実際にAI Explanationを動かす場合のみ必須（未設定でもCIは通る — 後述のFake AI Providerのみを使うため）。`OPENAI_API_KEY` / `OPENAI_REASONING_EFFORT` は任意。

`CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` はZodスキーマ上は任意だが、`apps/api`は起動時（`main()`実行時のみ、Type CheckやTest実行時は無関係）に`CLERK_SECRET_KEY`が未設定だと明示的にFail Fastする — 実際にAPIを起動する場合は必須。CIはFake Auth Adapterのみを使うため、この2つを設定しなくてもCIは通る。`apps/web`側は別途 `apps/web/.env` の `VITE_CLERK_PUBLISHABLE_KEY` が必要（後述）。

`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRO_PRICE_ID` も同様にZodスキーマ上は任意だが、`apps/api`の起動時（`main()`実行時のみ）にこの3つのいずれかが未設定だと明示的にFail Fastする — 実際にAPIを起動しStripe連携を動かす場合は必須。CIは`apps/api`の`index.ts`（`main()`）を一切起動せず、Backend/Frontend TestとProduct Integration TestはすべてFake Billing Gateway（`Subscription` Tableへの直接書き込みでのみProを付与する）を使うため、この3つを設定しなくてもCIは通る。

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

Sprint 7で全Route（上記すべて）にAuthentication + Ownershipを追加した。全Requestに`Authorization: Bearer <Clerk Session Token>`が必須（欠落/不正時は401 `AUTHENTICATION_REQUIRED` / `AUTHENTICATION_INVALID`、Clerk側の一時的な障害時は503 `AUTHENTICATION_UNAVAILABLE` — 401とは意図的に区別し、有効なSessionを持つUserを誤ってSign Inへ差し戻さないようにしている）。Email未確認時は403 `EMAIL_VERIFICATION_REQUIRED`。他Accountが所有するProject/Analysisへのアクセスは404（`PROJECT_NOT_FOUND` / `ANALYSIS_NOT_FOUND`）を返す — 403は使わない（存在の有無を推測されないため）。

Sprint 8でBillingのEndpointを追加した。`POST /analyses/:analysisId/explanation/retry`はOwnership Check成功後・既存の業務State Checkより前にEntitlement Check（Pro専用）が入る — Free Accountは常に403 `ENTITLEMENT_REQUIRED`を返す。

```text
GET  /billing                             現在のPlan / Subscription状態 / 利用可能Featureを取得
POST /billing/checkout                    Stripe Checkout Sessionを作成しURLを返す（既にPro時は409 ALREADY_PRO）
POST /billing/portal                      Stripe Billing Portal Sessionを作成しURLを返す（BillingCustomer未作成時は409 BILLING_CUSTOMER_NOT_FOUND）
POST /webhooks/stripe                     Stripe Webhook受信（Public Scope — Clerk認証を通さず、Stripe Signatureのみで検証する）
```

### Web (Vue) をローカルで動かす

API（`http://localhost:3001`）が起動している状態で、別Terminalで:

```bash
cp apps/web/.env.example apps/web/.env   # VITE_API_BASE_URL / VITE_CLERK_PUBLISHABLE_KEY
yarn workspace @polaris/web run dev      # http://localhost:5173
```

`VITE_CLERK_PUBLISHABLE_KEY`は実際にSign In/Sign Upを動かす場合に必須（Clerk Dashboardの公開Key）。未設定でもUnit Test/Buildは通る（`main.ts`のみが参照するため）。

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
│  ├─ web/           Vue 3 + Vite Frontend（Project / Analysis / Result画面, Sign In/Sign Up/Account Settings）
│  ├─ api/           Fastify HTTP API（Project / Analysis CRUD, Upload / Status / Observations Endpoint,
│  │                  Authentication/Ownership Hook）
│  ├─ worker/        BullMQ Worker（Analyzer Job / Raw Log Delete Retry / Cleanup）
│  └─ product-e2e/   apps/web・api・workerを実Infra上で結合するProduct Integration Test
│
├─ packages/
│  ├─ domain/    Framework非依存のDomain型（Project / Analysis / Account / UploadedAccessLog / AnalysisExecution 等）
│  ├─ analyzer/  Analyzer Core（Parser / Normalizer / Aggregation / Known Information / ObservationSet）
│  ├─ ai/        AI Explanation連携（Prompt Builder / OpenAI Responses API Adapter / Schema・Grounding Validation）
│  ├─ auth/      Authentication境界（Provider非依存のAuthAdapter Interface, ClerkAuthAdapter）
│  ├─ db/        Prisma Client / Repository（Project / Analysis / Account / ObservationSetRecord /
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

### Sprint 7 のスコープ

`md/50_Development_Setup_and_Seventh_Sprint.md` に対応する。

含む：`packages/auth`（Provider非依存の`AuthAdapter` Interface、`ClerkAuthAdapter` — Session-bound Tokenの検証、Auth Provider障害とToken不正の分離、`@clerk/backend`の`users.getUser()`フォールバックによるEmail/Email確認状態の取得）、`Account`モデルとLazy Provisioning（初回Requestで`Account`を自動作成、`authSubject`の`@unique`制約による原子的Upsertで並行Requestでも安全）、`Project.ownerAccountId`によるOwnership、全Repository QueryへのOwnership Scope追加（SQLの`WHERE`句自体でFilterし、「取得してから比較」は行わない）、`apps/api`へのGlobal Authentication/Email Verification Hookと各RouteのOwnership Check、`apps/web`のClerk統合（Sign In/Sign Up/Account Settings画面、初回Navigationの認証状態未確定Raceに対処するApp.vueのGate、`apiFetch`へのAuthorization Header自動付与）、`apps/product-e2e`へのAccount分離検証（別Accountからの直接URLアクセスは404）。

最重要不変条件：非所有のProject/Analysisへのアクセスは常に404（`PROJECT_FORBIDDEN`のような403系Codeは存在しない — 存在の有無を推測されないため）。Ownershipの判定は必ずBackend側で行い、Frontendの表示制御を信頼しない。Auth Provider（Clerk）の一時的な障害はToken不正と区別し503を返す（有効なSessionを持つUserを誤ってSign Inへ差し戻さない）。ClientはOwnerを自称できない（`ownerAccountId`は常にAuthenticate済みのAccountから決定）。`apps/worker` / `packages/analyzer` / `packages/ai` はAccount非依存のまま — QueueのJob Payloadには`analysisId`のみが載り、Tokenは一切運ばれない。

運用上の注意：Clerk Dashboardでカスタム Session Token Templateを設定していない場合、`ClerkAuthAdapter`は毎Requestごとに`users.getUser()`を1回追加で呼ぶ（Email/Email確認状態がSession Claimに含まれないため）。これはMVPとして許容している設計上のTrade-off（Latency増加、Clerk Backend APIのRate Limit・可用性への結合）であり、将来的にはCustom Session Claimまたは短命Cacheでの改善余地がある。

含まない（意図的にスコープ外）：Billing/Entitlement（別Sprint）、Webhook同期（`Account`のProfile更新は各Requestでの Best-effort Refreshのみ）、Organization/Team機能、Social Login個別設定、Production Deploy。

### Sprint 8 のスコープ

`md/57_Development_Setup_and_Eighth_Sprint.md` に対応する。中心原則：「Stripeが支払い状態を決め、PolarisがEntitlementを決める。Analyzerは変わらない」。

含む：`packages/domain`への純粋なEntitlement型/Resolver追加（`resolveEntitlement()` — I/O一切なし、Subscription Statusから`plan`/`features`/`billing`を導出する純関数）、`BillingCustomer` / `Subscription` / `BillingWebhookEvent` / `UsageEvent`の4Prisma Model（`Account`自体にはStripe関連Columnを一切追加しない）、`apps/api/src/billing/`（Stripe SDKを直接扱うのはこの下の`StripeGateway`のみ — `BillingGateway` Interfaceで抽象化、Checkout/Portal Session発行、`ensure-billing-customer.ts`による並行初回Checkout Raceの安全な処理）、`GET /billing` / `POST /billing/checkout` / `POST /billing/portal`、Public Scope（Clerk認証を通さない）の`POST /webhooks/stripe`（Signature検証 → Event種別Filter → Stripeへの正規状態再取得 → `BillingWebhookEvent`の`providerEventId`一意制約によるIdempotent処理、Webhook Payload自体の値は一切信用せずAccount特定は必ず正規再取得した`stripeCustomerId`から行う）、`POST /analyses/:analysisId/explanation/retry`へのEntitlement Gate（Ownership Check成功の直後・既存の業務State Checkより前に実行 — Free Userには常に一貫した403を返し、業務Stateを漏らさない）、`UsageEvent`記録（`persistAnalyzerSuccess`と同一Transaction内、`analysisId`一意制約でIdempotent、Quota強制は未実装）、`apps/web`のBilling画面（Plan/Status/更新日表示、Upgrade/Manage Billing Button、`?checkout=success`は再取得のトリガーのみでPro確定の根拠にはしない）と`AnalysisResultPage`のEntitlement Required通知、`apps/product-e2e`へのFree→Retry Blocked→Upgrade→Pro→Retry Allowedの一連Flow検証。

最重要不変条件：Analyzerの出力はFree/Proで完全に同一（`packages/analyzer`は不可侵）。Ownership（404）は常にEntitlement（403）より先に判定する — 非所有Resourceへの403は存在の有無を漏らすため使わない。Checkoutの`success_url`到達だけではProを確定させない（Webhookが書き込んだ`Subscription` Snapshotのみが根拠）。Subscription StatusからPlanへのMappingはFail Closed（`active` / `trialing` / `past_due`のみPro、それ以外— 将来の未知のStatusも含む — はFree）。Webhookは順序非依存かつIdempotent（Payload自体を信用せずStripeへ正規再取得する）。テストでProを付与する手段は`Subscription` Tableへの直接書き込みのみ（`FakeBillingGateway`内部StateはEntitlement判定に一切関与しない）。CIは実Stripe呼び出しを一切行わない（`apps/api`の`index.ts`はCIのどのStepからも起動されないため`STRIPE_*`はCIで未設定のままでよい）。

含まない（意図的にスコープ外）：Usage Quota強制（`UsageEvent`は記録のみ）、Free/Pro以外のPlan、AI Chat機能、複数Billing Provider対応、Production Deploy／実Stripe Test-Mode Smoke Test（Stripe Test-Mode Keyが必要なため手動実施 — 未実施）。

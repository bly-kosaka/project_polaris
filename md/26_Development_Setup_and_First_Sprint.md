# Project Polaris
# 26_Development_Setup_and_First_Sprint
## 開発環境構築・First Sprint

---

# 1. 目的

本書では、Project Polarisの設計フェーズから実装フェーズへ移行するための初期開発手順を定義する。

対象：

```text
Repository
Monorepo Structure
Package Management
Local Environment
Docker Compose
PostgreSQL
Redis
Object Storage
Environment Variables
Prisma
CI
Testing
Sprint 1
Claude Code Handoff
```

最初の目的は、

> **Analyzerを単体で正しく実装・検証できる開発基盤を作ること**

である。

認証・課金・AI連携を最初から同時実装しない。

---

# 2. First Sprint Goal

Sprint 1の完了状態：

```text
Repository
↓
Local Environment
↓
Domain Type
↓
Analyzer Parser
↓
Normalizer
↓
Parse Summary / Warning
↓
Synthetic Access Log Test
```

Aggregation全体を一気に完成させるのではなく、まずParser / Normalizerの品質を確立する。

---

# 3. Technology Baseline

19_Technology_Stack_and_Deploymentに基づく。

```text
Frontend
Vue 3 + Vite + TypeScript

API
Node.js + TypeScript + Fastify

Worker
Node.js + TypeScript

Database
PostgreSQL

ORM
Prisma

Queue
Redis + BullMQ

Object Storage
S3-compatible Storage

Validation
Zod

Test
Vitest

Hosting
Railway
```

---

# 4. Package Manager

Project全体でPackage Managerを統一する。

ユーザーの既存開発環境との一貫性を考慮し、

```text
Yarn
```

をPrimary候補とする。

pnpm固有機能をArchitecture上の前提にはしない。

Repository開始時に利用Versionを固定する。

---

# 5. Node.js

実装開始時点のActive / Maintenance LTSを採用し、

```text
.node-version
```

または同等の仕組みでVersionを固定する。

`latest`へ無条件追従しない。

---

# 6. Repository

推奨：

```text
polaris/
```

GitHub Repositoryとして作成する。

---

# 7. Monorepo Structure

初期：

```text
polaris/
├─ apps/
│  ├─ web/
│  ├─ api/
│  └─ worker/
│
├─ packages/
│  ├─ domain/
│  ├─ analyzer/
│  ├─ ai/
│  ├─ db/
│  └─ shared/
│
├─ fixtures/
│  └─ access-logs/
│
├─ infra/
│  └─ docker/
│
├─ docs/
│
├─ .github/
│  └─ workflows/
│
├─ package.json
├─ yarn.lock
├─ tsconfig.base.json
├─ eslint.config.*
├─ .env.example
├─ .gitignore
└─ README.md
```

---

# 8. apps/web

責務：

```text
Vue Application
Routing
UI
API Client
Authentication UI
Analysis Result
Aggregation
```

Analyzer Logicを置かない。

---

# 9. apps/api

責務：

```text
HTTP API
Authentication Verification
Authorization
Entitlement
Project / Analysis CRUD
Upload
Status
Result API
Billing Webhook
```

Access Log Parseを実行しない。

---

# 10. apps/worker

責務：

```text
Analyzer Job
AI Job
Cleanup Job
```

MVPでは同じWorker Process内にHandlerを持ってよい。

---

# 11. packages/domain

責務：

```text
Domain Type
Value Object
Lifecycle Status
Shared Contract
```

Framework / Prismaへ依存させない。

---

# 12. packages/analyzer

責務：

```text
Parser
Normalizer
Exclusion
Aggregation
Known Information Annotation
Candidate Selection
Redaction
Reference Resolution
ObservationSet Builder
```

AnalyzerのCore Package。

---

# 13. packages/ai

責務：

```text
AIExplanationInput
Prompt
Provider Adapter
Structured Output Validation
Reference Validation
```

Raw Logへアクセスさせない。

---

# 14. packages/db

責務：

```text
Prisma Client
Repository Implementation
Migration
```

Domain TypeとDB TypeのMappingを担当する。

---

# 15. packages/shared

本当に複数Layerで共通するUtilityのみ。

避ける：

```text
何でもsharedへ置く
```

---

# 16. fixtures/access-logs

Synthetic Access Logのみ置く。

例：

```text
basic-apache.log
basic-nginx.log
partial-invalid.log
all-invalid.log
known-paths.log
status-mixed.log
```

実案件LogをCommitしない。

---

# 17. docs

00〜26の設計書をRepositoryへ配置する場合の候補。

```text
docs/
├─ 00_Product_Vision_v2.md
...
└─ 26_Development_Setup_and_First_Sprint.md
```

最新版のみを基本とする。

---

# 18. Root package.json

Workspaceを定義する。

概念：

```json
{
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

Script候補：

```text
dev
build
test
lint
typecheck
format
```

---

# 19. TypeScript

Rootに、

```text
tsconfig.base.json
```

を置く。

各App / Packageはextendsする。

Strict Modeを有効にする。

---

# 20. Environment

最低：

```text
local
staging
production
```

を想定する。

初期実装でstagingを作らない場合もEnvironment Contractは分離しておく。

---

# 21. Local Infrastructure

Docker Compose：

```text
PostgreSQL
Redis
MinIO
```

を推奨。

Application自体はHost Node.jsで動かしてよい。

---

# 22. docker-compose概念

```text
postgres
redis
minio
```

のみ。

最初からApp / WorkerまでContainer化しなくてもよい。

---

# 23. PostgreSQL Local

用途：

```text
Project
Analysis
ObservationSet
AI Result
Known Information
Account
Subscription
Usage
```

---

# 24. Redis Local

用途：

```text
BullMQ
Job Lock
Retry
```

Cache用途を最初から追加しない。

---

# 25. MinIO Local

用途：

```text
Temporary Raw Access Log
```

S3-compatible AdapterのLocal Testに利用。

---

# 26. Environment Variables

`.env.example`へNameのみ記載する。

候補：

```text
NODE_ENV

DATABASE_URL

REDIS_URL

S3_ENDPOINT
S3_REGION
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_FORCE_PATH_STYLE

OPENAI_API_KEY
AI_EXPLANATION_MODEL
AI_CHAT_MODEL

CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY

STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET

APP_BASE_URL
```

---

# 27. Secret Rule

`.env`：

```text
Git Ignore
```

`.env.example`：

```text
No Secret Value
```

CI / RailwayではSecret Store / Environment Variableを利用する。

---

# 28. Environment Validation

Zodで起動時にEnvironmentをValidationする。

必須値不足時：

```text
Fail Fast
```

とする。

---

# 29. Initial Prisma Schema

Sprint 1では全Billing Schemaまで作り込まなくてよい。

最小：

```text
Project
Analysis
AnalysisExecution
ObservationSetRecord
```

から開始可能。

---

# 30. Project Model概念

```text
id
name
status
createdAt
updatedAt
```

Account OwnershipはAuth Sprintで追加してもよいが、Schema Migrationを考慮する。

---

# 31. Analysis Model概念

```text
id
projectId
status
analyzerStatus
aiStatus
sourceFileName
sourceFileSize
rawLogStorageKey
rawLogDeletionStatus
createdAt
updatedAt
```

---

# 32. ObservationSetRecord概念

```text
id
analysisId
schemaVersion
payload JSONB
createdAt
```

ObservationSetはImmutable原則。

---

# 33. AnalysisExecution概念

```text
id
analysisId
type
status
attempt
startedAt
finishedAt
errorCode
```

Raw Error Detailを不用意に保存しない。

---

# 34. Prisma Boundary

避ける：

```text
Prisma.Analysis
```

をApplication全体でDomain Modelとして利用。

推奨：

```text
Prisma Model
↓
Repository
↓
Domain Type
```

---

# 35. Analyzer Package Structure

推奨：

```text
packages/analyzer/src/
├─ parser/
├─ normalizer/
├─ exclusion/
├─ aggregation/
├─ known-information/
├─ selection/
├─ redaction/
├─ references/
├─ observation-set/
├─ config/
└─ index.ts
```

---

# 36. Sprint 1 Analyzer Scope

実装：

```text
Streaming Reader
Parser Interface
Apache/Nginx Common Patternの初期対応
Normalizer
Parse Summary
Parse Warning
Fatal / Partial判定
```

AggregationはSprint 2。

---

# 37. Parser Interface

概念：

```typescript
interface AccessLogParser {
  canParse(line: string): boolean;
  parse(line: string): ParseResult;
}
```

ただし実装時に`canParse`で同じLineを二重Parseする非効率が出る場合は、Parser Chain設計を調整してよい。

---

# 38. Normalized Request

概念：

```typescript
interface NormalizedAccessLogEntry {
  timestamp?: string;
  sourceIp?: string;
  method?: string;
  path?: string;
  query?: string;
  status?: number;
  responseBytes?: number;
  referrer?: string;
  userAgent?: string;
}
```

Missing Fieldを許容する。

---

# 39. Parse Result

概念：

```typescript
type ParseResult =
  | {
      status: 'parsed';
      value: NormalizedAccessLogEntry;
    }
  | {
      status: 'partial';
      value: NormalizedAccessLogEntry;
      warnings: ParseWarning[];
    }
  | {
      status: 'failed';
      warnings: ParseWarning[];
    };
```

---

# 40. Parse Warning

概念：

```typescript
interface ParseWarning {
  code: string;
  message: string;
  field?: string;
}
```

Raw Line全体をWarningへ保存しない。

---

# 41. Parse Summary

概念：

```typescript
interface ParseSummary {
  totalLines: number;
  parsedLines: number;
  partialLines: number;
  failedLines: number;
  warnings: ParseWarningSummary[];
}
```

---

# 42. Warning Summary

同じWarningをLineごとに大量保存しない。

```text
Warning Code
Count
Representative Safe Sample
```

へ集約する。

---

# 43. Parser Detection

MVPではUserへLog Format選択を要求しない。

Parser側で候補を試す。

ただし無制限なAuto Detection Complexityを作らない。

---

# 44. Synthetic Fixture

Sprint 1必須：

```text
valid.log
partial.log
invalid.log
mixed.log
```

---

# 45. Fixture Privacy

Fixtureに、

```text
実IP
実Email
実Token
実Session
```

を入れない。

RFC 5737等のDocumentation用IP Rangeを利用可能。

---

# 46. Test Strategy

Sprint 1：

```text
Unit Test
Fixture Test
Streaming Test
Memory Sanity Test
```

---

# 47. Parser Test

確認：

```text
timestamp
IP
method
path
query
status
bytes
referrer
UA
```

---

# 48. Partial Test

一部Fieldが欠落しても、

```text
Partial
```

として利用可能かを検証する。

---

# 49. Fatal Test

有効行0：

```text
Analyzer Fatal
```

となること。

---

# 50. Large File Test

Sprint 1では巨大FixtureをRepositoryへCommitしない。

Test時にSynthetic Generatorで生成可能にする。

---

# 51. Logging

初期からStructured Logging。

Log可能：

```text
analysisId
executionId
stage
duration
count
errorCode
```

Logしない：

```text
Raw Line
Raw Query
ObservationSet Full JSON
Token
Email
Session
```

---

# 52. Error Code

Human MessageとInternal Errorを分離。

例：

```text
PARSER_NO_VALID_LINES
PARSER_UNSUPPORTED_FORMAT
STORAGE_READ_FAILED
```

---

# 53. CI

GitHub Actions候補：

```text
Install
Type Check
Lint
Unit Test
Build
```

---

# 54. CI Trigger

```text
Pull Request
Push to main
```

---

# 55. Migration CI

DB Schema導入後：

```text
Prisma Validate
Migration Check
```

を追加。

---

# 56. Branch Strategy

個人開発MVPでは複雑にしない。

候補：

```text
main
feature/*
fix/*
```

---

# 57. Commit

1 Commitを巨大にしすぎない。

設計変更とImplementation変更の対応が追える粒度。

---

# 58. First Sprint Tasks

```text
S1-01 Repository作成
S1-02 Workspace作成
S1-03 TypeScript / Lint / Test基盤
S1-04 Docker Compose
S1-05 Environment Validation
S1-06 Domain Status Type
S1-07 Analyzer Package Skeleton
S1-08 NormalizedAccessLogEntry
S1-09 ParseResult / ParseWarning
S1-10 Streaming Reader
S1-11 Initial Parser
S1-12 Normalizer
S1-13 Parse Summary
S1-14 Synthetic Fixtures
S1-15 Parser Unit Test
S1-16 Partial / Fatal Test
S1-17 CI
S1-18 README更新
```

---

# 59. S1-01 Repository作成

Acceptance：

```text
Git Repository初期化
main Branch
.gitignore
README
```

---

# 60. S1-02 Workspace

Acceptance：

```text
apps/*
packages/*
```

がWorkspaceとして認識される。

RootからScript実行可能。

---

# 61. S1-03 TypeScript / Test

Acceptance：

```text
yarn typecheck
yarn lint
yarn test
```

がRootから成功。

---

# 62. S1-04 Docker Compose

Acceptance：

```text
PostgreSQL
Redis
MinIO
```

を起動できる。

---

# 63. S1-05 Environment

Acceptance：

`.env.example`あり。

不足Environmentで明確に起動失敗。

Secret ValueはCommitされない。

---

# 64. S1-06 Domain Status

実装：

```text
AnalysisStatus
AnalyzerStatus
AIStatus
RawLogDeletionStatus
```

Acceptance：

20で確定したStatus Modelと一致。

---

# 65. S1-07 Analyzer Skeleton

Acceptance：

```text
packages/analyzer
```

が単体Build / Test可能。

Web / APIへ依存しない。

---

# 66. S1-08 Normalized Entry

Acceptance：

必要FieldがTypeとして定義され、Missing Fieldを表現可能。

---

# 67. S1-09 Parse Type

Acceptance：

```text
parsed
partial
failed
```

を表現可能。

---

# 68. S1-10 Streaming Reader

Acceptance：

File全体を一括Readしない。

Line Iteratorとして処理できる。

---

# 69. S1-11 Initial Parser

Acceptance：

Synthetic Fixtureの標準的なAccess LogをParseできる。

Parser ErrorでProcess全体がCrashしない。

---

# 70. S1-12 Normalizer

Acceptance：

Parser固有OutputをNormalizedAccessLogEntryへ変換。

---

# 71. S1-13 Parse Summary

Acceptance：

```text
Total
Parsed
Partial
Failed
Warning Count
```

がFixture期待値と一致。

---

# 72. S1-14 Fixtures

最低：

```text
valid
partial
invalid
mixed
```

を用意。

実案件Dataなし。

---

# 73. S1-15 Parser Unit Test

主要Fieldを検証。

---

# 74. S1-16 Partial / Fatal

Acceptance：

```text
Mixed
→ Partial analysis possible

All Invalid
→ Fatal
```

---

# 75. S1-17 CI

PRで、

```text
typecheck
lint
test
build
```

が実行。

---

# 76. S1-18 README

最低：

```text
Requirements
Install
Environment
Docker
Development
Test
Repository Structure
```

を記載。

---

# 77. Sprint 1 Definition of Done

```text
Fresh Clone
↓
README
↓
Install
↓
Docker Start
↓
Test
```

で新規環境を再現できる。

さらに、

```text
Synthetic Access Log
↓
Streaming Read
↓
Parse
↓
Normalize
↓
Parse Summary
```

が自動Testで成功する。

---

# 78. Sprint 1でやらないこと

```text
Vue画面作り込み
Clerk
Stripe
OpenAI
BullMQ本実装
Full Prisma Schema
Aggregation
Known Information
Candidate Selection
ObservationSet
Production Deploy
```

Scopeを広げない。

---

# 79. Sprint 2 Preview

次：

```text
Aggregation
Known Information
Candidate Selection
Redaction
ObservationSet
```

Analyzer Coreを完成方向へ進める。

---

# 80. Sprint 3 Preview

```text
Prisma
Storage
Queue
Worker
Upload Lifecycle
```

---

# 81. Sprint 4 Preview

```text
Aggregation UI
Analysis Result Foundation
```

---

# 82. Sprint 5 Preview

```text
OpenAI
AI Explanation
Finding
Reference Navigation
```

---

# 83. Claude Code Handoff Principle

Claude Codeへ、

```text
Polaris全部を実装して
```

とは依頼しない。

Sprint / Task単位で渡す。

---

# 84. Claude Codeへ渡す資料

Sprint 1：

```text
19_Technology_Stack_and_Deployment.md
20_MVP_Implementation_Plan.md
25_MVP_Backlog_and_Acceptance_Criteria.md
26_Development_Setup_and_First_Sprint.md
```

Analyzer実装時：

```text
07_Analyzer_Architecture_v3.md
08_Analyzer_Aggregation_v8.md
13_Analysis_Data_Model.md
```

も参照。

---

# 85. Claude Code Initial Prompt

以下を初回実装指示のベースとする。

```text
Project Polarisの実装を開始してください。

最初のSprintでは、UI・認証・課金・AI連携は実装せず、
Repository基盤とAnalyzer Parser / Normalizerまでを対象とします。

必ず以下の設計書を読み、設計と矛盾する独自仕様を追加しないでください。

- 19_Technology_Stack_and_Deployment.md
- 20_MVP_Implementation_Plan.md
- 25_MVP_Backlog_and_Acceptance_Criteria.md
- 26_Development_Setup_and_First_Sprint.md
- 07_Analyzer_Architecture_v3.md
- 08_Analyzer_Aggregation_v8.md
- 13_Analysis_Data_Model.md

Sprint 1の対象はS1-01〜S1-18です。

特に以下を守ってください。

- Analyzerは評価・Severity・Priority・Intentを生成しない
- Access LogはStreaming処理する
- Raw Log全体をMemoryへ読み込まない
- Parse Warningを必ず保持する
- parsed / partial / failedを区別する
- Raw Log LineやSensitive Valueを通常Logへ出力しない
- Domain TypeをPrisma Typeへ直接依存させない
- 実案件Access LogをFixtureへ使用しない
- 不要な抽象化やFrameworkを追加しない
- Sprint 1 Scope外の機能を先回り実装しない

実装前に、
1. 実装計画
2. 作成・変更するFile一覧
3. 依存Package
4. 設計上の不明点
を提示してください。

不明点がなければ、その後実装へ進んでください。

完了時には、
- 実装内容
- Test結果
- 未完了Task
- 設計との差異
を報告してください。
```

---

# 86. Claude Code Review Prompt

Sprint完了後：

```text
Sprint 1の実装をProject Polarisの設計書に照らしてレビューしてください。

特に確認すること：

- Scope外実装がないか
- Analyzerに意味判断が混入していないか
- Streaming処理になっているか
- Raw LogをMemoryへ全読みしていないか
- Parse Warningが失われていないか
- partialとfatalの扱いが正しいか
- Sensitive DataがLogへ出ていないか
- DomainとInfrastructureが過度に結合していないか
- 不要な抽象化がないか
- TestがAcceptance Criteriaを満たしているか

問題は、
Critical / Major / Minor
に分類してください。

各指摘には、
- 対象File
- 問題
- 設計書との不一致
- 修正案
を記載してください。

問題がない項目も確認済みとして明記してください。
```

---

# 87. Design Change Rule

Claude Code実装中に設計上の不足が見つかった場合、

```text
勝手にArchitectureを決める
```

のではなく、

```text
Issue提示
↓
設計判断
↓
Markdown更新
↓
Implementation
```

の順とする。

---

# 88. First Implementation Checkpoint

Sprint 1終了後に、

```text
Parser
Normalizer
Parse Warning
Fixture
Test
```

をレビューする。

問題なければSprint 2へ進む。

---

# 89. MVP開発の基本姿勢

Polarisでは、

```text
早く全部作る
```

より、

```text
Analyzerの事実が正しい
↓
AIがそれを正しく説明する
↓
UIがそれを分かりやすく伝える
```

を優先する。

---

# 90. 次の作業

次は実装開始前の最終準備として、

```text
27_Sprint_2_Analyzer_Core_Plan
```

を先に設計する必要はない。

Sprint 1を実装・レビューし、その結果を受けてSprint 2の詳細を確定する方がよい。

したがって設計フェーズとしては、

> **Sprint 1を開始できる状態**

まで到達したものとする。

実際のRepository作成後は、Sprint 1の実装結果を本設計書群と照合しながら次へ進む。

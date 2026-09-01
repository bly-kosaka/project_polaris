# Project Polaris
# 31_Development_Setup_and_Third_Sprint
## Sprint 3 実装指示・受入基準

---

# 1. Sprint 3の目的

Sprint 2までで、Access LogからObservationSetを生成するAnalyzer Coreが完成した。

Sprint 3では、Analyzerの成果物を一時的なUnit Test上の値ではなく、Project / Analysis単位の永続データとして扱える基盤を作る。

今回の中心は、

```text
Domain / Persistence
↓
PostgreSQL / Prisma
↓
Project
↓
Analysis
↓
ObservationSet Persistence
↓
Repository Layer
```

である。

加えてSprint 2 Reviewで継続課題となった、

```text
Analyzer Config Validation
```

を外部Boundary接続前のEarly Hardeningとして実装する。

---

# 2. Sprint 3の位置付け

MVP Implementation Plan上の、

```text
Phase 3 Persistence
```

を主対象とする。

Sprint 3ではQueue / Worker / Upload APIまで一気に進めない。

理由：

```text
Analyzer Core
↓
Persistence Contract
↓
Queue / Worker
↓
Upload Lifecycle
```

の順に境界を固定した方が、Failure時のRaw Log削除・Retry・Status Transitionを安全に実装できるため。

---

# 3. Sprint 3 Scope

対象：

```text
Analyzer Config Validation
Prisma導入
PostgreSQL接続
Database Package
Project Persistence
Analysis Persistence
ObservationSet Persistence
Project Known Information Persistence
Analysis Lifecycle Status Persistence
Repository Interface
Transaction Boundary
Serialization / Deserialization
Persistence Integration Test
```

---

# 4. Sprint 3で実装しないもの

以下はScope外。

```text
BullMQ
Redis
Worker Job
Object Storage
Raw Access Log Upload
Raw Log Delete
Fastify Public API
Vue UI
AI Provider
AI Explanation
Authentication
Clerk
Stripe
Billing
Report Export
Production Deployment
```

Sprint 3でQueue / Worker / Upload Lifecycleを先取りしない。

---

# 5. 最重要原則

Persistence LayerはAnalyzer Coreを汚染しない。

禁止：

```text
Analyzer package
↓
Prisma import

Analyzer Domain Type
↓
Prisma Model依存

ObservationSet
↓
DB都合で構造変更
```

正：

```text
Analyzer
↓
ObservationSet
↓
Application / Repository Boundary
↓
Persistence
↓
Prisma
↓
PostgreSQL
```

ObservationSetは引き続きAnalyzer Result Source of Truthである。

---

# 6. Sprint 2との接続

Production Analyzer API：

```typescript
analyzeAccessLog()
```

結果：

```typescript
type AnalyzeAccessLogResult =
  | {
      analyzerStatus: 'success' | 'partial';
      observationSet: ObservationSet;
    }
  | {
      analyzerStatus: 'failed';
      observationSet?: never;
      errorCode: AnalyzerErrorCode;
      parseSummary?: ParseSummary;
    };
```

Sprint 3では、

```text
success / partial
↓
Valid ObservationSet
↓
Persistence
```

のみを正常保存対象とする。

```text
failed
↓
ObservationSetなし
```

の場合、ObservationSet Recordを作成しない。

---

# 7. Early Hardening — Analyzer Config Validation

Sprint 2 Review m-01をSprint 3の最初に解消する。

対象：

```text
Candidate Selection Limit
Sample Limit
Top N Limit
Total Limit
Time Bucket Limit
Aggregation Limit
その他Analyzer数値Config
```

最低条件：

```text
integer
>= 0
finite
```

Configによって0が禁止されるFieldが存在する場合のみ、

```text
> 0
```

を個別に要求する。

意味のない一律`> 0`は禁止。

---

# 8. Config Validation Failure

Invalid Config：

```text
NaN
Infinity
-Infinity
negative number
non-integer
```

を正常化して黙って受け入れない。

結果：

```text
AnalyzerStatus = failed
errorCode = ANALYZER_INVALID_CONFIGURATION
ObservationSetなし
```

Raw Config ValueをError Messageへ大量出力しない。

---

# 9. Config Validationの配置

推奨：

```text
analyzeAccessLog()
↓
validate / resolve config
↓
Streaming Parse
```

不正ConfigでRaw Log処理を開始しない。

ValidationはAnalyzer Package内部に置いてよい。

Prisma / API / Workerへ依存させない。

将来API側でもSchema Validationを行う場合でも、Analyzer Core自身の防御を残す。

---

# 10. Database Package

既存Monorepo構成に、

```text
packages/database
```

を使用する。

責務：

```text
Prisma Client
Repository Implementation
Persistence Mapping
Transaction
Database Test Helper
```

Analyzer Logicを置かない。

---

# 11. Prisma / PostgreSQL

Sprint 3では、

```text
Prisma
PostgreSQL
```

を採用する。

Local Developmentでは既存Docker ComposeのPostgreSQLを利用する。

新規依存追加前に既存RepositoryのVersion / Workspace構成を確認すること。

Package ManagerはYarnを維持する。

---

# 12. Initial Persistent Entities

最低限：

```text
Project
Analysis
ObservationSetRecord
ProjectKnownInformation
```

を実装する。

`UploadedAccessLog`はSprint 4以降のUpload / Storage Lifecycleで実装する。

`AIExplanationResult`もAI Sprintまで実装不要。

`AnalysisExecution`はLogical Modelとして設計済みだが、Sprint 3で独立Table化を必須としない。

---

# 13. Project

概念：

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  site?: {
    primaryUrl?: string;
    hostname?: string;
  };
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}
```

DB都合でDomainへ不要なFieldを増やさない。

MVPではOrganization / Account FKをまだ必須にしない。

Authentication SprintでOwner Scopeを追加する。

---

# 14. Analysis

Sprint 3で利用するTop-level Status：

```typescript
type AnalysisStatus =
  | 'created'
  | 'uploaded'
  | 'analyzing'
  | 'analyzer_result_ready'
  | 'explaining'
  | 'completed'
  | 'failed';
```

重要：

```text
partial
```

をTop-level Lifecycleへ入れない。

Sprint 2までに確定したArchitectureでは、

```text
Analysis.status
= lifecycle

AnalyzerStatus.partial
= result quality
```

である。

古い設計書中に`partial`がTop-levelへ残っていても採用しない。

---

# 15. Analyzer Status

```typescript
type AnalyzerExecutionStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'partial'
  | 'failed';
```

Sprint 3では未実行状態が必要な場合、

```text
nullable
```

等で表現してよい。

不必要な`not_started` enum追加は避ける。

---

# 16. AI Status

```typescript
type AIExecutionStatus =
  | 'not_requested'
  | 'queued'
  | 'running'
  | 'success'
  | 'failed';
```

Sprint 3ではAI自体を実装しないが、Analysis Modelとして保持可能な構造は用意してよい。

Default：

```text
not_requested
```

---

# 17. Analysis Metadata

一覧取得時にObservationSet全文を読む必要がないよう、必要なSummaryをAnalysisへ保持可能にする。

候補：

```text
originalFileName
fileSizeBytes
detectedLogFormat
firstSeen
lastSeen
totalLineCount
totalRequestCount
observationSetVersion
analyzerConfigurationVersion
knownInformationDatasetVersion
```

ただしSprint 3で値がまだ生成できないFieldを無理に埋めない。

Nullable / Optionalでよい。

ObservationSetの正本をAnalysis Metadataへ複製しない。

---

# 18. ObservationSetRecord

概念：

```typescript
interface ObservationSetRecord {
  id: string;
  analysisId: string;
  schemaVersion: string;
  data: ObservationSet;
  createdAt: string;
}
```

MVPではObservationSetをJSONとして保存する。

---

# 19. ObservationSet Immutability

原則：

```text
1 Analysis
=
1 ObservationSet
```

ObservationSet生成後にUpdateしない。

DB制約として、

```text
analysisId UNIQUE
```

等を利用して1対1を保証する。

Analyzer再実行で既存ObservationSetを書き換えない。

再解析：

```text
New Analysis
```

---

# 20. ObservationSet Validation Before Persist

DBへ保存する前に、

```text
validateObservationSet()
```

を通す。

禁止：

```text
Invalid ObservationSet
↓
JSON columnへとりあえず保存
```

Persistence LayerはAnalyzer Validatorを再利用してよいが、
Analyzerの内部処理へPrismaを逆依存させない。

---

# 21. ObservationSet Serialization

最低限確認：

```text
JSON Serialize可能
JSON Deserialize可能
schemaVersion保持
Deserialize後Validation PASS
```

`Date` Object等のJSON非互換値をObservationSetへ追加しない。

---

# 22. ProjectKnownInformation

Persistent Project Known Information：

```text
projectId
target = path
pattern / value
matchType = exact | prefix
title / label
description
enabled
createdAt
updatedAt
```

実装時はSprint 2の`KnownInformationEntry`へ変換できるMapperを持つ。

---

# 23. Known Information Source

DB上のProject Known InformationをAnalyzerへ渡すときは、

```text
source = project
```

として変換する。

Built-in Known Informationは引き続きApplication Resource。

Sprint 3ではUser Known Informationを実装しない。

---

# 24. Disabled Known Information

```text
enabled = false
```

のProject Known InformationをAnalyzer Inputへ渡さない。

DBから取得した全Recordを無条件でKnown Information Datasetへ入れない。

---

# 25. Repository Interface

Application LayerがPrisma Clientへ直接依存しすぎないよう、Repository Boundaryを置く。

ただし過剰なGeneric Repositoryは作らない。

推奨：

```typescript
interface ProjectRepository {
  create(...): Promise<Project>;
  findById(...): Promise<Project | null>;
}

interface AnalysisRepository {
  create(...): Promise<Analysis>;
  findById(...): Promise<Analysis | null>;
  listByProjectId(...): Promise<Analysis[]>;
  updateStatus(...): Promise<void>;
}

interface ObservationSetRepository {
  create(...): Promise<ObservationSetRecord>;
  findByAnalysisId(...): Promise<ObservationSetRecord | null>;
}
```

必要なUse Caseから作る。

禁止：

```text
BaseRepository<T>
GenericCRUDRepository<T>
RepositoryFactoryFactory
```

---

# 26. Persistence Mapping

Prisma Generated TypeをDomain Typeとしてそのまま公開しない。

```text
Prisma Model
↓
Mapper
↓
Domain / Application Type
```

JSON ObservationSetも、

```text
unknown
↓
Validation
↓
ObservationSet
```

として読み出す。

Type Assertionだけで信用しない。

禁止：

```typescript
return row.data as ObservationSet;
```

のみで完了すること。

---

# 27. Transaction Boundary

ObservationSet Persist時は、少なくとも、

```text
ObservationSet Record作成
Analysis.observationSetId / relation確定
Analyzer Status更新
Analysis.status = analyzer_result_ready
```

が論理的に一体となる。

Sprint 3ではこの処理をTransactionで実装する。

---

# 28. Persist Success Contract

正常：

```text
Valid ObservationSet
↓
Transaction Start
↓
ObservationSet Insert
↓
Analysis Relation / Status Update
↓
Commit
↓
analyzer_result_ready
```

Transaction失敗：

```text
Rollback
↓
AnalysisをResult Readyにしない
```

---

# 29. Partial Analyzer Persist

AnalyzerStatus：

```text
partial
```

でもValid ObservationSetなら保存する。

Top-level：

```text
Analysis.status = analyzer_result_ready
AnalyzerStatus = partial
```

とする。

禁止：

```text
Analysis.status = partial
```

---

# 30. Failed Analyzer Persist

Analyzer failed：

```text
ObservationSetなし
```

なのでObservationSetを保存しない。

必要なら、

```text
Analysis.status = failed
AnalyzerStatus = failed
```

をPersistenceする。

Sprint 3ではFailure Status Persistence Testを行う。

---

# 31. Status Transition

Sprint 3では最低限、不正TransitionをRepository / Application Service側で防ぐ。

例：

```text
created
→ analyzer_result_ready
```

を無条件に許可しない。

ただしSprint 3ではUpload Lifecycle未実装のため、
Production Lifecycle全体を無理に再現しない。

Persistence Test用の明示的Setupは許可する。

---

# 32. Database Constraint

最低候補：

```text
Project.id PK
Analysis.id PK
Analysis.projectId FK
ObservationSet.analysisId UNIQUE FK
ProjectKnownInformation.projectId FK
```

削除Policyは設計と整合させる。

MVPではProject Archiveが基本なので、
Project削除Cascadeを安易に本番Use Caseとして使わない。

---

# 33. ID

IDはApplication / DBで一貫した方式を採用する。

UUID / CUID等のPrismaで扱いやすい方式でよい。

重要なのは、

```text
Raw File Name
Client Name
Domain
```

等をIDへ埋め込まないこと。

---

# 34. Timestamp

DB TimestampはUTCで保存する。

Application境界ではISO 8601 String等、既存Domain Typeと整合させる。

Timezone依存Testを避ける。

---

# 35. Migration

Sprint 3完了時にInitial MigrationをRepositoryへ含める。

確認：

```text
Fresh Database
↓
Migration
↓
Test
```

が成立する。

手作業でTableを作らない。

---

# 36. Seed

Built-in Known InformationをDB Seedしない。

Built-in DatasetはApplication ResourceとしてVersion管理する方針を維持する。

必要ならTest用Project / Analysis Seedのみ検討可能だが、MVP必須ではない。

---

# 37. Local Development

既存Docker ComposeのPostgreSQLを利用する。

確認：

```text
docker compose up
yarn install
Prisma migration
Test
```

がClean Environmentで成立する。

READMEへ必要手順を追加する。

---

# 38. Database Test

Unit TestだけでなくPostgreSQLを利用したIntegration Testを持つ。

最低確認：

```text
Project Create / Read
Analysis Create / Read
Analysis List
Project Known Information Create / Read
ObservationSet Persist / Read
ObservationSet Validation after Read
1 Analysis = 1 ObservationSet
Transaction Rollback
Partial Analyzer Persist
Failed Analyzer no ObservationSet
```

---

# 39. SQLiteで代替しない

Production TargetがPostgreSQLなので、
Persistence Integration TestをSQLiteだけで済ませない。

Prisma + PostgreSQL固有挙動をTestする。

---

# 40. Test Isolation

Test間でDB Stateを共有しない。

推奨：

```text
beforeEach cleanup
transaction rollback
unique test IDs
```

等。

並列Testで衝突しない構成を考慮する。

---

# 41. Sensitive Logging

Prisma Query LogやTest Debug Logへ、

```text
ObservationSet全文
Known Information description全文
Raw Query Sample
IP一覧
```

等を通常出力しない。

Sprint 3でもData Sensitivityを維持する。

---

# 42. Error Handling

Persistence ErrorをDomain Resultへそのまま漏らさない。

最低分類候補：

```text
NOT_FOUND
CONFLICT
INVALID_DATA
PERSISTENCE_FAILED
```

ただしSprint 3で巨大なError Taxonomyを作らない。

Prisma Error Message全文をPublic Errorへ渡さない。

---

# 43. Concurrency

1 AnalysisへObservationSetを二重InsertできないようDB Unique Constraintで防ぐ。

Sprint 4のWorker Idempotencyの土台になる。

```text
ObservationSet.analysisId UNIQUE
```

は重要。

---

# 44. Sprint 3 Task List

```text
S3-01 Analyzer Config Validation
S3-02 Config Validation Test

S3-03 Prisma導入
S3-04 Database Package Skeleton
S3-05 Prisma Schema
S3-06 Initial Migration
S3-07 Prisma Client Setup

S3-08 Project Persistence
S3-09 Analysis Persistence
S3-10 ObservationSet Persistence
S3-11 Project Known Information Persistence

S3-12 Persistence Mapper
S3-13 ObservationSet Deserialize Validation
S3-14 Known Information Mapper

S3-15 Repository Interface
S3-16 Prisma Repository Implementation

S3-17 Analysis Status Transition
S3-18 ObservationSet Persist Transaction
S3-19 Partial Persist
S3-20 Failed Analyzer Persistence

S3-21 Database Constraint Test
S3-22 Repository Integration Test
S3-23 Transaction Rollback Test
S3-24 Serialization Round-trip Test
S3-25 PostgreSQL Integration Test

S3-26 Sensitive Logging Check
S3-27 Error Mapping
S3-28 README / Local Setup Update
S3-29 CI Database Setup
S3-30 Clean Environment Verification
```

---

# 45. Definition of Done

Sprint 3完了時：

```text
Project
↓
Analysis
↓
Analyzer success / partial
↓
ObservationSet
↓
Validation
↓
PostgreSQL Persist
↓
Read
↓
Deserialize
↓
Validation
```

が成立する。

さらに：

```text
Analyzer failed
↓
ObservationSet Persistなし
↓
Analysis failed
```

が成立する。

---

# 46. Acceptance Criteria

## Analyzer Config

```text
Invalid Config拒否                PASS
ANALYZER_INVALID_CONFIGURATION    PASS
Invalid ConfigでParse開始しない   PASS
```

## Persistence

```text
Project Persist                  PASS
Analysis Persist                 PASS
ObservationSet Persist           PASS
Project Known Information        PASS
```

## ObservationSet

```text
Persist前Validation              PASS
Read後Validation                 PASS
schemaVersion保持                PASS
Serialization Round-trip         PASS
1 Analysis = 1 ObservationSet    PASS
```

## Status

```text
Success → analyzer_result_ready  PASS
Partial → analyzer_result_ready  PASS
Failed → failed                  PASS
Top-level partialなし            PASS
```

## Transaction

```text
ObservationSet + Analysis更新     Atomic
Failure時Rollback                PASS
```

## Architecture

```text
Analyzer → Prisma依存なし        PASS
Domain → Prisma依存なし          PASS
Generic Repository過剰化なし     PASS
Queue / Worker先取りなし         PASS
```

## CI

```text
yarn typecheck
yarn lint
yarn test
yarn build
```

に加えPostgreSQL Integration TestがCI上で成功する。

---

# 47. Claude Code 実装プロンプト

以下をClaude Codeへ渡す。

```text
Project Polaris Sprint 3を実装してください。

最初に以下の設計書を必ず読んでください。

md/12_Architecture_Reconciliation.md
md/13_Analysis_Data_Model.md
md/14_Analysis_Lifecycle_API.md
md/15_Storage_Retention_Security.md
md/18_MVP_System_Architecture.md
md/19_Technology_Stack_and_Deployment.md
md/20_MVP_Implementation_Plan.md
md/25_MVP_Backlog_and_Acceptance_Criteria.md
md/28_Development_Setup_and_Second_Sprint.md
md/29_Sprint_2_Implementation_Plan_Final_Addendum.md
md/30_Sprint_2_Review.md
md/31_Development_Setup_and_Third_Sprint.md

Sprint 3の主目的はPersistenceです。

実装対象：

- Analyzer Config Validation
- Prisma / PostgreSQL
- Database Package
- Project Persistence
- Analysis Persistence
- ObservationSet Persistence
- Project Known Information Persistence
- Repository Boundary
- Persistence Mapping
- ObservationSet Deserialize Validation
- Status Persistence
- ObservationSet Persist Transaction
- PostgreSQL Integration Test
- CI Database Setup

重要なArchitecture Rule：

1. Analyzer packageからPrismaへ依存しない
2. Domain TypeをPrisma Generated Typeへ依存させない
3. ObservationSetはAnalyzer Result Source of Truth
4. ObservationSetは原則Immutable
5. 1 Analysis = 1 ObservationSet
6. Analyzer success / partialのみObservationSetを保存可能
7. Analyzer failedではObservationSetを保存しない
8. PartialでもTop-level Analysis.statusはpartialにしない
9. Analysis.statusはLifecycleのみ
10. AnalyzerStatus.partialはResult Quality
11. ObservationSet PersistとAnalysis Result Ready更新はTransaction
12. Invalid ObservationSetをJSONとして保存しない
13. DBから読み出したObservationSet JSONをType Assertionだけで信用しない
14. Project Known Informationのdisabled recordをAnalyzerへ渡さない
15. Built-in Known InformationをDBへSeedしない
16. Generic Repositoryを過剰設計しない
17. Queue / Worker / Upload / Object StorageはSprint 3で実装しない
18. Package ManagerはYarn
19. PostgreSQL Integration Testを使用し、SQLiteだけで代替しない
20. Sensitive Dataを通常Logへ出さない

Sprint 2 ReviewのMinor継続課題としてAnalyzer Config Validationを最初に実装してください。

Invalid Config：

- negative
- NaN
- Infinity
- non-integer

等を拒否し、

ANALYZER_INVALID_CONFIGURATION

へ分類してください。

実装開始前に以下を提示してください。

1. Sprint 3実装Plan
2. 作成・変更File一覧
3. 新規Dependency
4. Prisma Schema案
5. Repository Interface案
6. Transaction Boundary
7. S3-01〜S3-30との対応表
8. Status Modelの扱い
9. Test Strategy
10. 設計上不明な点

重要：

古い設計書にTop-level Analysis.status = partial等の古い記述が残っている場合、
最新Architecture Reconciliation / Sprint文書を優先してください。

実装Plan確認後に実装を開始してください。
```

---

# 48. Sprint 3 Review Prompt

実装完了後のレビューでは最低限以下を確認する。

```text
Critical
Major
Minor
```

## Critical候補

```text
Invalid ObservationSet保存
Analyzer → Prisma依存
failed AnalyzerでObservationSet保存
Transaction不整合
ObservationSet二重保存
Top-level partial復活
DB JSON無検証Cast
Sensitive Data Logging
```

## Major候補

```text
Config Validation漏れ
Known Information disabled漏れ
Status Transition不整合
PostgreSQL Integration Test不足
Migration再現不能
Repository過剰抽象化
```

最終判定：

```text
Sprint 3:
PASS / PASS WITH FIXES / FAIL

Sprint 4:
GO / FIX THEN GO
```

---

# 49. Sprint 4 Preview

Sprint 3 PASS後：

```text
Queue
Worker
Temporary Object Storage
Upload Lifecycle
Raw Log Delete
Cleanup / Retry
```

へ進む。

Sprint 3中にこれらを先取りしない。

---

# 50. 最終方針

Sprint 3は、

> **Analyzerを永続化可能なProduct Coreへ接続するSprint**

である。

最重要境界：

```text
Analyzer
↓
ObservationSet
↓
Persistence Boundary
↓
PostgreSQL
```

この境界を明確にしたまま、

```text
Project
Analysis
ObservationSet
Known Information
```

を永続化する。

Sprint 3完了後、初めてQueue / Worker / Upload Lifecycleへ安全に進む。

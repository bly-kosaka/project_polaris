# Project Polaris
# 32_Sprint_3_Plan_Review
## Sprint 3 実装プランレビュー

レビュー対象：

```text
Sprint 3: Persistence — Prisma / PostgreSQL
```

対象Repository：

```text
bly-kosaka/project_polaris
```

---

# 1. 総合判定

```text
GO WITH FIXES
```

Sprint 3の方向性そのものは正しい。

特に以下はそのまま進めてよい。

```text
Analyzer Config Validationを最初に実施
packages/dbを既存Scaffoldとして利用
PrismaをAnalyzer / Domainへ逆依存させない
ObservationSet Persist前後でValidation
1 Analysis = 1 ObservationSet
success / partialのみObservationSet Persist
failedではObservationSetなし
PartialでもTop-level status = analyzer_result_ready
ObservationSet Persist + Analysis更新をTransaction化
Project Known Information disabledをAnalyzer Inputから除外
PostgreSQL Integration Test
Queue / Worker / UploadをSprint 3へ持ち込まない
```

ただし、実装前に以下5点を修正する。

```text
F-01 Prisma Version / Setupを現行仕様へ修正
F-02 Project / Analysis Domain Typeの配置をpackages/domainへ修正
F-03 ProjectKnownInformation.targetをDBで制約
F-04 PostgreSQL Integration Testの並列競合を防止
F-05 Transaction Rollback Testを本当に「2書き目失敗」にする
```

この5点を反映後はSprint 3実装へ進んでよい。

---

# 2. F-01 Prisma Version / Setup

## 問題

現在のPlanには、

```text
current stable major-6
```

を実装時に取得する方針がある。

これは現在のPrisma ecosystemと合っていない。

またPlan内の、

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

も旧世代のSetupである。

---

# 3. Prisma採用方針

Project Polarisの現在のNode Engineは、

```text
node >= 20.19.0
```

である。

Sprint 3では安定性を優先し、

```text
Prisma ORM 7.10.x
```

を明示Pinすることを推奨する。

Prisma 8は現在の新MajorでArchitecture変更が大きく、
Project PolarisのSprint 3でPersistence基盤と同時に採用する必要はない。

Sprint 3の目的はORM Migrationではなく、

```text
Persistence Boundaryを安定させること
```

である。

---

# 4. Prisma 7 Setup

Prisma 7系の現行Setupに合わせる。

概念：

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

Connection URLは、

```text
prisma.config.ts
```

へ置く。

例：

```typescript
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

PostgreSQL ClientにはPrisma 7の推奨構成に従い、

```text
@prisma/adapter-pg
pg
@types/pg
```

も必要Dependencyとして検討する。

Versionは`prisma` / `@prisma/client` / adapterを同一7.10.x系へ揃える。

禁止：

```text
prisma@latestを無条件Install
```

Sprint中にMajor Versionが変わってBuildが変化しないようPinする。

---

# 5. F-02 Project / Analysis Typeの所有場所

## 現在案

Planでは、

```text
packages/db/src/project/types.ts
packages/db/src/analysis/types.ts
```

へ、

```text
Project
Analysis
CreateProjectInput
CreateAnalysisInput
```

を置く予定になっている。

理由：

```text
今はpackages/db以外で使わないため
```

となっている。

これは変更する。

---

# 6. Domain Typeはpackages/domainへ置く

Project / AnalysisはPersistence ModelではなくPolarisのCore Domainである。

さらに次Sprintでは、

```text
Worker
API
Upload Lifecycle
```

がこれらを利用する。

したがって今`packages/db`へ置くと、

```text
Worker / API
↓
packages/db
↓
Project / Analysis Typeを取得
```

という逆転した依存が発生する。

正：

```text
packages/domain
├─ Project
├─ ProjectStatus
├─ Analysis
├─ AnalysisMetadata
├─ AnalysisStatus
├─ AnalyzerStatus
└─ AIStatus

packages/db
↓
packages/domain
```

Prisma Generated Typeは引き続き`packages/db`内だけで扱う。

---

# 7. Persistence Input Type

以下のようなPersistence専用Inputは`packages/db`に置いてもよい。

```text
CreateProjectPersistenceInput
CreateAnalysisPersistenceInput
UpdateAnalysisPersistenceFields
ObservationSetRecord
```

ただし、

```text
Project
Analysis
ProjectStatus
AnalysisStatus
```

の正本Typeは`packages/domain`。

「後で移動する」前提の設計は採用しない。

---

# 8. F-03 ProjectKnownInformation.target

## 問題

現在案：

```prisma
target String @default("path")
```

このSchemaではDB上で、

```text
target = anything
```

を保存できる。

一方Mapperは常に、

```typescript
target: 'path'
```

としてAnalyzerへ変換する予定。

そのため不正DB値があっても、

```text
invalid DB value
↓
silently reinterpret as path
```

となる。

Persistence Boundaryとして不適切。

---

# 9. targetの修正案

推奨：

```prisma
enum KnownInformationTarget {
  PATH
}

model ProjectKnownInformation {
  ...
  target KnownInformationTarget @default(PATH)
}
```

またはMVPでTargetがPathしか存在しないなら、
DB Column自体を持たずDomain Mapperで`path`を固定してもよい。

ただし、

```text
String unrestricted
```

は採用しない。

「将来Target追加時にMigrationが必要」なのは問題ではない。

Target Type追加はSchema変更なのでMigrationされるべき。

---

# 10. F-04 PostgreSQL Integration Testの並列実行

## 問題

現在Plan：

```text
db-test-helpers.ts
resetDatabase()
```

を各Testで利用し、

```text
全Table DELETE
```

する予定。

VitestはTest Fileを並列実行できる。

その状態で、

```text
project.test.ts
analysis.test.ts
observation-set-persist.test.ts
...
```

が同時に動くと、

```text
Test AがData作成
↓
Test B beforeEach resetDatabase()
↓
Test AのData消失
```

が起きる可能性がある。

これはFlaky Testの原因になる。

---

# 11. DB Test Isolation方針

Sprint 3では簡潔さを優先し、

```text
packages/db Integration Test
= File Parallelism OFF
```

を推奨する。

例：

```text
packages/db/vitest.config.ts
```

またはDB Test専用Configで、

```typescript
test: {
  fileParallelism: false,
}
```

相当を設定する。

使用中Vitest Versionで有効なOption / CLI Flagを確認して実装する。

その上で、

```text
beforeEach resetDatabase()
```

を利用する。

将来Test量が増えた場合は、

```text
Schema per Worker
Transaction per Test
Unique Database
```

等へ拡張可能。

Sprint 3で複雑化しない。

---

# 12. F-05 Transaction Rollback Test

## 現在案の問題

PlanではTransaction Rollback Testについて、

```text
persistAnalyzerSuccessを同一analysisIdで2回実行
↓
P2002 duplicate
↓
rollback確認
```

という説明がある。

しかし2回目は、

```text
ObservationSet INSERT
```

というTransactionの最初の書き込みで失敗する。

これは、

> 1書き目成功後、2書き目失敗時に1書き目もRollbackされる

ことを証明していない。

---

# 13. 正しいRollback Test

Transactionの2つのWrite：

```text
1. ObservationSet Insert
2. Analysis Status Update
```

について、

```text
1成功
↓
2失敗
↓
1もRollback
```

をTestする。

最も簡単な方法：

```text
Analysis.status = created
↓
persistAnalyzerSuccess()
↓
ObservationSet Insertは成功可能
↓
updateStatus(created → analyzer_result_ready)
↓
Status Transition Guardで失敗
↓
Transaction Rollback
```

Test後：

```text
ObservationSetRecord = 0
Analysis.status = created
```

を確認する。

これはSprint 3 §31の、

```text
created → analyzer_result_readyを無条件に許可しない
```

とも整合する。

---

# 14. Success / Partial Test Setup

通常のPersist TestではLifecycleを壊さないよう、

```text
Analysis.status = analyzing
```

をFixture Setupする。

Sprint 3ではUpload Lifecycle未実装なので、
Test SetupとしてPrismaを直接使い`analyzing`状態を作ることは許可する。

Production Repositoryに、

```text
created → analyzing
```

等の不正Shortcutを追加してTestを通さない。

---

# 15. Status Transition Model

最低限、Sprint 3では最新Lifecycleを使う。

```text
created
uploaded
analyzing
analyzer_result_ready
explaining
completed
failed
```

Top-level：

```text
partialなし
```

Analyzer Status：

```text
queued
running
success
partial
failed
```

ここは現在Planのままでよい。

---

# 16. Config Validation

現在Planは妥当。

対象：

```text
AggregationConfig
CandidateSelectionConfig
```

Numeric Config：

```text
Number.isInteger()
>= 0
Number.isFinite()
```

を満たす。

実装上は`Number.isInteger()`で`NaN / Infinity / non-integer`をまとめて拒否できるが、
Test Caseはそれぞれ保持する。

Invalid時：

```text
ANALYZER_INVALID_CONFIGURATION
ObservationSetなし
parseSummaryなし
```

Parse開始前にFailureする。

判定：

```text
PASS
```

---

# 17. ObservationSet Persistence

以下はPlanのままでよい。

```text
Persist前 validateObservationSet()
JSON保存
Read後 unknown → Validation → ObservationSet
schemaVersion保持
analysisId UNIQUE
ObservationSet Immutable
```

特に、

```typescript
row.data as ObservationSet
```

だけで返さない方針は重要。

判定：

```text
PASS
```

---

# 18. Transaction Boundary

以下もPlanのままでよい。

```text
ObservationSet Insert
+
Analysis Status / Analyzer Status Update
=
同一Transaction
```

Partial：

```text
AnalyzerStatus = partial
Analysis.status = analyzer_result_ready
```

Failed：

```text
ObservationSetなし
Analysis.status = failed
AnalyzerStatus = failed
```

判定：

```text
PASS
```

---

# 19. Known Information

以下はPlanのままでよい。

```text
Project Known InformationはDB
Built-in Known InformationはApplication Resource
disabledはAnalyzer Datasetから除外
source = projectへMapper
```

User Known InformationはSprint 3外。

判定：

```text
PASS
```

---

# 20. Repository Boundary

Project / Analysis Domain Typeの配置をF-02の通り修正した上で、
Repository構造は妥当。

推奨：

```text
ProjectRepository
AnalysisRepository
ObservationSetRepository
ProjectKnownInformationRepository
```

禁止：

```text
BaseRepository<T>
GenericCRUDRepository<T>
RepositoryFactoryFactory
```

Planの方針を維持する。

---

# 21. Prisma Error Mapping

以下の粒度で十分。

```text
NOT_FOUND
CONFLICT
INVALID_DATA
PERSISTENCE_FAILED
```

Prisma Error Message / MetaをPublic Errorへそのまま入れない。

P2002：

```text
CONFLICT
```

等へMapping。

巨大なTaxonomyは不要。

---

# 22. ID

`cuid()`採用自体はMVP上問題ない。

ただし、

```text
time-orderedなのでIndex localityが良い
```

を主要採用理由にしない。

Sprint 3では、

```text
Prisma標準で扱いやすい
Opaque ID
Sensitive情報を含まない
```

程度の理由で十分。

性能最適化を先回りしない。

---

# 23. CI

PostgreSQL Service追加は妥当。

```text
Migration
↓
Test
```

をCIで実行する。

Localの`55432`とCIの`5432`を分ける判断も問題ない。

DB Test IsolationをF-04の通り修正する。

---

# 24. dotenv

Local Testで`.env`を読む必要がある点は妥当。

ただしPrisma 7採用時は、

```text
prisma.config.ts
```

でも`dotenv/config`を使用する。

Runtime DB Client側でも環境変数を必要とするため、
dotenvの責務を重複させすぎないよう整理する。

既存`packages/shared`のEnvironment Validationと競合する新しいEnv Architectureを作らない。

Sprint 3では、

```text
Local Test Bootstrapping
```

用途に限定してよい。

---

# 25. 修正版S3 Scope

変更後もSprint 3 Scopeは変わらない。

```text
S3-01 Analyzer Config Validation
S3-02 Config Validation Test

S3-03 Prisma 7導入
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
S3-23 Real Transaction Rollback Test
S3-24 Serialization Round-trip Test
S3-25 PostgreSQL Integration Test

S3-26 Sensitive Logging
S3-27 Error Mapping
S3-28 README
S3-29 CI
S3-30 Clean Environment Verification
```

---

# 26. Claude Codeへの修正指示

現在Planへ以下を反映する。

```text
1. Prisma major-6自動取得をやめる
2. Prisma 7.10.x系を明示Pin
3. Prisma 7現行Setup（prisma-client / output / prisma.config.ts）を使用
4. PostgreSQL Driver Adapter要否をPrisma 7公式Setupに合わせる
5. Project / Analysis / ProjectStatus / AnalysisMetadataをpackages/domainへ置く
6. packages/dbはDomain Typeを所有しない
7. ProjectKnownInformation.targetをunrestricted Stringにしない
8. DB Integration TestのFile Parallelismを無効化
9. resetDatabase()競合を防ぐ
10. Transaction Rollback Testを1書き目成功→2書き目失敗で検証
11. Success / Partial TestはAnalysisをanalyzing状態へFixture Setup
12. Test都合でProduction Lifecycleを緩めない
```

この修正後は再度Plan Approvalを待たず実装へ進んでよい。

ただしPrisma 7実装方法について公式Documentationと実際のPackage APIが食い違う場合のみ、
実装開始前に報告する。

---

# 27. 最終判定

```text
Architecture Direction      PASS
Sprint Scope                PASS
Config Validation           PASS
ObservationSet Boundary     PASS
Transaction Concept         PASS
Known Information           PASS
Status Model                PASS

Prisma Setup                FIX
Domain Type Ownership       FIX
Known Info Target Constraint FIX
DB Test Isolation           FIX
Rollback Test               FIX
```

最終：

```text
Sprint 3 Plan
GO WITH FIXES
```

上記5点反映後：

```text
GO
```

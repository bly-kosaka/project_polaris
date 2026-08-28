# Project Polaris
# 20_MVP_Implementation_Plan
## MVP実装計画

---

# 1. 目的

本書では、Project PolarisをMVPとして実装するための順序、依存関係、Milestone、Definition of Doneを定義する。

ここまでの00〜19で、Product、Analyzer、Aggregation、AI、Presentation、Urgency、Data Model、Lifecycle、Storage / Security、Product Plan、Authentication / Billing、System Architecture、Technology Stackは定義済みである。

本章では新しいArchitectureを追加するのではなく、**どの順番で実装すれば、最短で壊れにくいMVPへ到達できるか**を整理する。

---

# 2. 実装の最重要方針

最初から全機能を実装しない。

Polarisの最初のEnd-to-End Goalは、

```text
Access Log Upload
↓
Analyzer
↓
ObservationSet
↓
Aggregation UI
```

である。

AI、Authentication、Billingはこの後に接続する。

---

# 3. 実装Phase

```text
Phase 0  Repository / Foundation
Phase 1  Domain / Data Model
Phase 2  Analyzer Core
Phase 3  Persistence
Phase 4  Queue / Worker
Phase 5  Upload Lifecycle
Phase 6  Aggregation UI
Phase 7  AI Explanation
Phase 8  Authentication / Ownership
Phase 9  Product Plan / Entitlement
Phase 10 Billing
Phase 11 Security / Retention Hardening
Phase 12 Testing / Benchmark
Phase 13 Production Deployment
```

---

# 4. Phase 0 — Repository / Foundation

目的：継続開発可能なRepository構造を作る。

```text
polaris/
├─ apps/
│  ├─ app/
│  └─ worker/
├─ packages/
│  ├─ analyzer/
│  ├─ ai/
│  ├─ domain/
│  ├─ database/
│  └─ shared/
├─ prisma/
├─ docs/
└─ package.json
```

Tasks：

```text
Monorepo初期化
TypeScript設定
pnpm workspace
ESLint
Prettier
Vitest
Zod
Environment Validation
Git Ignore
README
```

Definition of Done：

```text
pnpm install
pnpm lint
pnpm test
pnpm build
```

がClean Repositoryで成功する。

---

# 5. Phase 1 — Domain / Data Model

Frameworkより先にDomain Modelを定義する。

対象：

```text
Project
Analysis
AnalysisStatus
ObservationSet
Aggregation Group
Known Information
Parse Warning
AIExplanationResult
Urgency
Entitlement
```

Domain TypeをVue、Fastify、Prisma、OpenAI SDKへ依存させない。

Zod等でRuntime Validation Schemaも作る。

対象：

```text
ObservationSet
AIExplanationResult
Known Information
Analyzer Config
Environment
```

Definition of Done：

```text
ObservationSetをTypeScript上で生成可能
Zod Validation可能
Serialization / Deserialize可能
schemaVersionを保持
```

---

# 6. Phase 2 — Analyzer Core

MVPの最重要Phase。

AnalyzerはWeb Frameworkなしで動作させる。

Input：

```text
Access Log Stream
Analyzer Config
Known Information
```

Output：

```text
ObservationSet
```

実装順：

```text
1 Parser
2 Normalizer
3 Parse Warning
4 Exclusion
5 Aggregation
6 Known Information Annotation
7 Candidate Selection
8 Redaction
9 Size Control
10 Reference Resolution
11 ObservationSet Builder
```

---

# 7. Parser / Parse Warning

最初の対応Formatは限定する。

候補：

```text
Common Log Format
Combined Log Format
Apache / Nginx標準系
```

Test Fixture：

```text
valid.log
partial.log
invalid.log
mixed.log
```

実案件LogをそのままRepositoryへCommitせずSynthetic Fixtureを使用する。

Parse Warningは最低限、

```text
totalLines
parsedLines
partialLines
failedLines
warningCodes
samples
unavailableFields
```

を保持する。

Parser失敗をSilent Ignoreしない。

---

# 8. Aggregation

実装対象：

```text
Path
Source IP
Source IP × Path
Status
Method
User-Agent
Time
```

Raw Log全件をMemoryへ保持せず、

```text
read line
↓
parse
↓
aggregate increment
↓
discard raw line
```

でStreaming Aggregationする。

---

# 9. Known Information / Selection / Redaction

Known Information Priority：

```text
user
>
project
>
built_in
```

MVP Match：

```text
exact
prefix
```

Candidate Selection軸：

```text
Known Information
Request Count
Distinct Source IP
Distinct Path
4xx
5xx
POST
Response Size
Representative
```

Global Risk Scoreは作らない。

各Selected Groupには複数の`selectionReasons`を保持する。

Redaction初期対象：

```text
password
passwd
pwd
token
access_token
refresh_token
authorization
api_key
apikey
secret
session
session_id
sid
email
mail
phone
tel
```

Redaction Failure時に生値をFallback保存しない。

---

# 10. ObservationSet Builder

最終的に、

```text
metadata
overview
groups
parseSummary
availability
truncation
redactionSummary
exclusionSummary
references
```

を構築する。

Phase 2 Definition of Done：

```text
Access Log File
↓
ObservationSet JSON
```

をCLIまたはUnit Testから生成できる。DB / UIなしでAnalyzer単体動作する。

---

# 11. Phase 3 — Persistence

Prisma / PostgreSQLを導入する。

最初に必要なTable：

```text
projects
analyses
observation_sets
project_known_information
```

ObservationSet保存条件：

```text
Analyzer Success
または
Analyzer PartialかつValid ObservationSet
```

保存完了前にRaw Log削除を実行しない。

---

# 12. Analysis Status整理

実装時はTop-level StatusをLifecycleだけにする。

```text
created
uploaded
analyzing
analyzer_result_ready
explaining
completed
failed
```

Analyzer Status：

```text
queued
running
success
partial
failed
```

AI Status：

```text
not_requested
queued
running
success
failed
```

`partial`をTop-levelへ入れると、「処理段階」と「Analyzer結果品質」が混ざるため採用しない。

つまり、

```text
Analysis.status
= lifecycle

AnalyzerStatus.partial
= result quality
```

と分離する。

Phase 3 Definition of Done：

```text
Project作成
Analysis作成
ObservationSet保存
Analysis取得
Analysis一覧取得
```

がDB経由で動作する。

---

# 13. Phase 4 — Queue / Worker

Railway Redis + BullMQを想定する。

Queueは、

```text
analyzer
ai
maintenance
```

またはMVPではSingle Queue + Job Typeでもよい。

Analyzer Job Input：

```typescript
{
  analysisId,
  rawLogStorageKey
}
```

処理：

```text
Status更新
Raw Log取得
Analyzer実行
ObservationSet Persist
Raw Log Delete
AI enqueue
```

Worker Idempotency：

```text
ObservationSet既存なら再生成しない
completed Analysisをanalyzingへ戻さない
Raw Log Deleteは複数回実行可能
```

Retry対象：

```text
Temporary Storage Error
DB Temporary Error
Infrastructure Error
```

Retryしない：

```text
Unsupported Format
All Parse Failed
Invalid Config
```

Definition of Done：QueueへTest Jobを入れるだけで`Queue → Worker → Analyzer → DB`が成立する。

---

# 14. Phase 5 — Upload Lifecycle

Backend API：

```text
POST /projects/{projectId}/analyses
POST /analyses/{analysisId}/upload
GET  /analyses/{analysisId}
GET  /analyses/{analysisId}/observations
```

Upload Validation：

```text
File Exists
Non Empty
Size Limit
Analysis Status
Ownership
```

ExtensionだけでLog Formatを判定しない。

Storage Key：

```text
raw-logs/{analysisId}/{randomId}
```

Original File NameをStorage Keyへ利用しない。

Upload Success：

```text
Raw Log Persist
↓
Analysis.status = uploaded
↓
Analyzer Job enqueue
```

enqueue成功前に`analyzing`へしない。

Raw Log削除：

```text
ObservationSet Persist Success
↓
Delete
```

Delete FailureはAnalyzer Resultを無効にせずMaintenance Jobで再削除する。

Definition of Done：API経由で`Upload → Queue → Analyzer → ObservationSet Persist → Raw Log Delete`がEnd-to-Endで成立する。

---

# 15. Milestone 1 — Analyzer MVP

```text
Access LogをUpload
↓
ObservationSetが保存
↓
Aggregation ResultをAPIから取得
```

この時点ではAI / Auth / Billingなしでよい。

---

# 16. Phase 6 — Aggregation UI

Vue Frontendを接続する。

画面：

```text
Project List
Project Detail
Upload
Analysis Status
Analysis Result
```

初期Aggregation View：

```text
Overview
Parse Warning
Path
Source IP
Status
Method
User-Agent
Time
```

Source IP × PathはDrill-down等で利用する。

Aggregation Viewで`Danger / Safe / Attack`等のAnalyzer非生成評価を勝手に表示しない。

Parse Warningは目立つ位置に出す。

例：

```text
100,000 lines
99,750 parsed
250 failed
```

Definition of Done：非技術者でも`Upload → Processing → Aggregation Result`まで画面操作できる。

---

# 17. Milestone 2 — Usable Analyzer Tool

この時点でPolarisはAccess Log Aggregation Toolとして単独利用可能になる。

ここで実Access Logを使ったUX / Performance検証を行う。

---

# 18. Phase 7 — AI Explanation

Analyzerが安定してからAIを接続する。

実装：

```text
AIExplanationInput Builder
OpenAI Adapter
Schema Validation
Reference Validation
AIExplanationResult Persistence
```

Flow：

```text
ObservationSet Persisted
↓
AI Job
↓
ObservationSet Load
↓
Prompt Build
↓
OpenAI
↓
Schema Validation
↓
Reference Validation
↓
Persist
```

Output最低限：

```text
summary
overallUrgency
findings
overallNotes
dataLimitations
```

Finding：

```text
title
observation
interpretation
limitation
nextChecks
references
```

Finding-level Urgencyは持たない。

AI Failure時もAnalyzer Resultを維持し、UIでは「解析は完了しました。AIによる説明を生成できませんでした。」と表示する。

AI RetryはObservationSetを利用しRaw Logは不要。

Definition of Done：同一Analysis画面でOverall Urgency / AI Summary / Findings / Next Check / Data Limitation / Aggregationを確認できる。

---

# 19. Milestone 3 — Polaris Core Experience

ここで、

> Analyzerが事実を整理し、AIが説明する

というPolarisのCore Product Valueが成立する。

---

# 20. Phase 8 — Authentication / Ownership

Clerk等を接続する。

実装：

```text
Sign Up
Login
Email Verification
Session
API Authentication
Project Ownership
Analysis Ownership
```

Auth導入後、`Project.ownerAccountId`を必須化する。

Authorization Test：

```text
他Account Project取得不可
他Account Analysis取得不可
他Account Known Information取得不可
```

Definition of Done：Account AからAccount BのResourceをID直指定しても取得できない。

---

# 21. Phase 9 — Product Plan / Entitlement

Free / Pro差をApplication Layerへ実装する。

対象：

```text
maxProjects
maxAnalysesPerPeriod
maxUploadBytes
maxHistoryItems
aiChat
aiRegeneration
reportExport
csvExport
```

16章方針に従い、AI Summary / Overall Urgency / Findings / Next CheckはFreeでも利用可能とする方向を維持する。

Usage Count条件：

```text
ObservationSet Persist Success
```

Concurrency対策を行う。

Definition of Done：Project Limit / Analysis Limit / Upload Limit / Feature EntitlementがServer Sideで正しく拒否される。

---

# 22. Phase 10 — Billing

Stripe等を接続する。

実装順：

```text
Customer
Checkout
Webhook
Subscription Sync
Entitlement Update
Customer Portal
Cancellation
Payment Failure
```

Billingを後にする理由は、Product成立・Cost測定・Free / Pro価値確認を先に済ませるため。

Webhook必須：

```text
Signature Verification
Idempotency
Subscription Sync
```

Card情報を保存しない。

Definition of Done：Test Modeで`Free → Checkout → Pro → Cancel → Period End → Free`が成立する。

---

# 23. Phase 11 — Security / Retention Hardening

15章の内容を実装確認する。

対象：

```text
Raw Log最大Retention
Cleanup Job
Storage Lifecycle
Redaction
Sensitive Logging
Encryption
Secret
Rate Limit
Ownership
Prompt Injection
```

Cleanup対象：

```text
expired Raw Log
orphan Raw Log
failed deletion
```

Application Logへ以下が出ていないことを確認する。

```text
Raw Log Line
Raw Query
Email
Token
ObservationSet全文
Prompt全文
```

Definition of Done：通常Flow / Failure Flow双方でRaw Logが残り続けない。

---

# 24. Phase 12 — Testing / Benchmark

Analyzer MVP時点から継続実施し、最終Benchmarkでは例として、

```text
10 MB
50 MB
100 MB
500 MB
```

を計測する。

Analyzer：

```text
Duration
Peak Memory
CPU
Parsed Lines/sec
ObservationSet Size
```

AI：

```text
Input Tokens
Output Tokens
Latency
Cost
Finding Quality
Reference Accuracy
```

Benchmark結果からFree / Pro Analysis Limit、Upload Size、AI Chat Limit、Priceを確定する。

Definition of Done：想定上限候補に対してMemory / Duration / Costを数値で説明できる。

---

# 25. Phase 13 — Production Deployment

Railway Production Environment：

```text
app
worker
postgres
redis
raw-log bucket
```

External：

```text
Clerk
Stripe
OpenAI
```

Production Checklist：

```text
Custom Domain
HTTPS
Environment Secrets
DB Backup
Storage Private
Redis Private
Webhook Secret
AI Key
Rate Limit
Cleanup
Monitoring
Error Reporting
Terms
Privacy Policy
```

Smoke Test：

```text
Sign Up
Create Project
Upload
Analyzer
AI Explanation
Delete Analysis
Upgrade
Cancel
```

Definition of Done：Productionで実ユーザーが`Account → Project → Upload → Aggregation → AI Explanation`まで完了できる。

---

# 26. MVP Feature Scope

含める：

```text
Account
Project
Access Log Upload
Analyzer
ObservationSet
Aggregation UI
AI Explanation
Overall Urgency
Findings
Next Check
Known Information
Analysis History
Free / Pro
AI Chat（Pro）
Report Export候補
Billing
Delete
```

MVPから外す：

```text
常時監視
Error Log解析
WAF Log解析
Team
Organization
Public API
Webhook Integration
Analysis Comparison
Raw Log長期保存
Raw Log Download
Graph Visualization
Automatic Blocking
Automatic Incident Response
```

---

# 27. Report Export / AI ChatのRelease判断

Report ExportがReleaseを遅らせる場合：

```text
MVP 1.0
→ AI Explanationまで

MVP 1.1
→ Report Export
```

AI Chatも初回Release時に不安定ならCore Explanation公開後へ回せる。

ただしProの主要価値として設計自体は維持する。

---

# 28. 実装優先順位

最優先：

```text
Analyzer Correctness
Parse Warning
Redaction
ObservationSet
Lifecycle
```

次：

```text
Aggregation UI
AI Explanation
```

その後：

```text
Authentication
Entitlement
Billing
```

避ける順序：

```text
最初にStripe
最初にログインUI
最初にDashboard Design
最初にAI Chat
最初にReport PDF
```

---

# 29. Branch / Commit Strategy

例：

```text
feat/domain-model
feat/analyzer-parser
feat/analyzer-aggregation
feat/observation-set
feat/worker
feat/upload
feat/aggregation-ui
feat/ai-explanation
```

巨大な一括実装を避ける。

---

# 30. Claude Codeへ渡す場合

1回のPromptで全Polarisを実装させない。

PhaseまたはMilestone単位で渡す。

各Promptに最低限含める：

```text
目的
対象Files
参照設計書
実装範囲
非対象
Acceptance Criteria
Test要件
```

各Phase終了時に、

```text
仕様逸脱
不要な設計追加
Security Regression
Analyzer / AI責務混在
Plan Logic混入
```

をReviewする。

---

# 31. Definition of MVP Done

1. Accountを作成できる。
2. Projectを作成できる。
3. Access LogをUploadできる。
4. Raw Logが一時保存される。
5. AnalyzerがQueue / Workerで動作する。
6. Parse Warningが保存・表示される。
7. ObservationSetが生成される。
8. Raw Logが削除される。
9. Aggregation UIを確認できる。
10. AI Summaryを確認できる。
11. Overall Urgencyを確認できる。
12. Findings / Next Checkを確認できる。
13. AI Failure時もAggregationを確認できる。
14. 他Account Dataへアクセスできない。
15. Free / Pro EntitlementがServer Sideで動作する。
16. Billing状態が同期される。
17. Analysisを削除できる。
18. Cleanupが動作する。
19. Sensitive Dataを通常Logへ出さない。
20. Benchmark結果から利用上限と価格を説明できる。

---

# 32. 推奨Milestone一覧

```text
M0 Repository Ready
M1 Analyzer Library Ready
M2 Upload → Analyzer → ObservationSet
M3 Aggregation UI
M4 AI Explanation
M5 Authentication / Ownership
M6 Entitlement
M7 Billing
M8 Security Hardening
M9 Benchmark / Pricing
M10 Production MVP
```

---

# 33. 次の作業

設計書として必要な主要Architectureは20まででMVP実装開始可能な状態になる。

次に進む場合は、

```text
21_MVP_Backlog_and_Acceptance_Criteria
```

を作成し、

```text
Epic
User Story
Task
Acceptance Criteria
Dependency
Priority
```

までIssue / Backlog形式へ変換する。

これによりGitHub Issues / Backlog / Claude Code実装単位としてそのまま利用できる。

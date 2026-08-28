# Project Polaris
# 25_MVP_Backlog_and_Acceptance_Criteria
## MVPバックログ・受入基準

---

# 1. 目的

本書では、00〜24で定義したProject Polarisの設計を、実装可能なBacklogへ変換する。

管理単位：

```text
Milestone
Epic
User Story
Task
Acceptance Criteria
Dependency
Priority
```

本書は、

```text
GitHub Issues
Backlog
Claude Code
実装レビュー
MVP進捗管理
```

へ利用できる粒度を目標とする。

---

# 2. Priority

```text
P0
MVP成立に必須

P1
MVP公開に必要

P2
MVP後でも成立
```

P0だけを作っても「技術デモ」ではなく、PolarisのCore Valueを体験できることを条件とする。

---

# 3. Milestone

```text
M0 Foundation
M1 Analyzer Core
M2 Upload → ObservationSet
M3 Aggregation UI
M4 AI Explanation
M5 Product UI
M6 Authentication / Ownership
M7 Entitlement / Billing
M8 Security / Retention
M9 Quality / Benchmark
M10 Production MVP
```

---

# 4. Epic一覧

```text
E01 Repository / Development Foundation
E02 Domain / Data Model
E03 Analyzer Parser / Normalizer
E04 Aggregation
E05 Known Information
E06 Candidate Selection / ObservationSet
E07 Storage / Persistence
E08 Queue / Worker
E09 Analysis Lifecycle / Upload
E10 Aggregation UI
E11 AI Explanation
E12 Analysis Result UI
E13 Project / Analysis Management UI
E14 Known Information UI
E15 Authentication / Ownership
E16 Entitlement / Usage
E17 Billing
E18 Security / Retention
E19 Responsive / Accessibility
E20 Test / Benchmark / QA
E21 Deployment / Operations
```

---

# 5. E01 Repository / Development Foundation

Priority：

```text
P0
```

Milestone：

```text
M0
```

## User Story

開発者として、Frontend / API / Worker / Shared Packageを一貫したRepositoryで開発できる。

## Tasks

```text
Monorepo作成
Vue 3 + Vite + TypeScript
Fastify API
Worker Entry
Shared Package
Analyzer Package
AI Package
ESLint
Formatter
Type Check
Environment Validation
Test Runner
Docker Compose
PostgreSQL
Redis
Local Object Storage
```

## Acceptance Criteria

- FrontendをLocal起動できる。
- APIをLocal起動できる。
- WorkerをLocal起動できる。
- PostgreSQLへ接続できる。
- Redisへ接続できる。
- Object Storage AdapterをLocalで利用できる。
- Type CheckがCIで実行される。
- Unit TestがCIで実行される。
- SecretをRepositoryへCommitしない。

---

# 6. E02 Domain / Data Model

Priority：

```text
P0
```

Milestone：

```text
M0
```

## Tasks

```text
Account
Project
Analysis
UploadedAccessLog
ObservationSet
AIExplanationResult
AnalysisExecution
KnownInformation
Subscription
Usage
Entitlement
```

のDomain Type定義。

Prisma Schema作成。

Migration作成。

## Acceptance Criteria

- ProjectとAnalysisが1:Nで関連する。
- AnalysisからObservationSetを取得できる。
- AIExplanationResultはObservationSetと分離されている。
- Raw Access LogをDB BLOBとして保存しない。
- ObservationSetはJSONBとして保存可能。
- Domain TypeがPrisma Typeへ直接依存しない。
- Analysis Lifecycle StatusとAnalyzerStatus / AIStatusが分離されている。

---

# 7. E03 Analyzer Parser / Normalizer

Priority：

```text
P0
```

Milestone：

```text
M1
```

## User Story

ユーザーとして、一般的なAccess LogをアップロードするとPolarisが読み取れる。

## Tasks

```text
Streaming File Reader
Line Parser
Normalizer
Parse Summary
Parse Warning
Unsupported Line Handling
Partial Parse Handling
Fatal Parse Handling
Synthetic Fixture
```

## Acceptance Criteria

- File全体をMemoryへ読み込まない。
- 1行単位でParseできる。
- Parsed / Partial / Failed Line Countを保持する。
- Parse失敗理由をWarning Codeとして保持できる。
- 一部行失敗でも有効なObservationSetを生成できる。
- 有効行が存在しない場合はFatalとする。
- Raw Sensitive SampleをLog出力しない。

---

# 8. E04 Aggregation

Priority：

```text
P0
```

Milestone：

```text
M1
```

## Tasks

```text
Path Aggregation
Source IP Aggregation
Source IP × Path Aggregation
Status Aggregation
Method Aggregation
User-Agent Aggregation
Time Aggregation
Response Size Summary
First / Last Seen
Distribution
```

## Acceptance Criteria

以下のViewを生成できる。

```text
Path
Source IP
Source IP × Path
Status
Method
User-Agent
Time
```

- Countは評価値として扱わない。
- CountからSeverity / Priorityを生成しない。
- 1分 / 5分Time Bucketを生成できる。
- Aggregation結果がStreaming処理と両立する。
- Synthetic Fixtureで期待値を検証できる。

---

# 9. E05 Known Information

Priority：

```text
P0
```

Milestone：

```text
M1
```

## Tasks

```text
Built-in Known Information
Project Known Information
User Known Information基盤
Exact Match
Prefix Match
Priority Resolution
Annotation
```

## Acceptance Criteria

- Sourceは`user / project / built_in`を識別できる。
- Priorityは`user > project > built_in`。
- `exact / prefix`を利用できる。
- RegexはMVPでは提供しない。
- Known InformationはAggregation後にAnnotationされる。
- Known InformationにSeverity / Priority / Attack判定を保存しない。
- Count=1でもKnown Information matchをCandidateへ残せる。

---

# 10. E06 Candidate Selection / ObservationSet

Priority：

```text
P0
```

Milestone：

```text
M1
```

## Tasks

```text
Candidate Selection
Selection Reason
Deduplication
Redaction
Size Control
Truncation Metadata
Reference Resolution
ObservationSet Schema
ObservationSet Validation
```

## Acceptance Criteria

Selection軸：

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

- Weighted Risk Scoreを使用しない。
- Selection Reasonを複数保持できる。
- Selection後にReference Resolutionを行う。
- Omitted GroupをReferenceのために復活させない。
- Truncationを明示する。
- Redaction対象Query Parameterを`[REDACTED]`へ変換する。
- Redaction不能なSampleを永続化しない。
- ObservationSetにSeverity / Priority / Risk / Intentを含めない。

---

# 11. E07 Storage / Persistence

Priority：

```text
P0
```

Milestone：

```text
M2
```

## Tasks

```text
Project Repository
Analysis Repository
ObservationSet Repository
AI Result Repository
Known Information Repository
Temporary Storage Adapter
Raw Log Metadata
```

## Acceptance Criteria

- Raw LogはObject Storageへ保存される。
- ObservationSetはDBへ永続化される。
- AI ResultはObservationSetと別Record。
- ObservationSet persist成功前にRaw Logを削除しない。
- Storage KeyをFrontendへ不用意に露出しない。
- Raw LogをBackup対象にしない設計にできる。

---

# 12. E08 Queue / Worker

Priority：

```text
P0
```

Milestone：

```text
M2
```

## Tasks

```text
BullMQ
Analyzer Queue
AI Queue
Cleanup Queue
Worker
Retry
Backoff
Idempotency
Execution Lock
Failed Job Handling
```

## Acceptance Criteria

- API Request内でAnalyzerを実行しない。
- Analyzer JobをWorkerが処理する。
- AI JobをWorkerが処理する。
- QueueがSource of Truthにならない。
- Duplicate Jobで結果を二重生成しない。
- Transient ErrorをRetryできる。
- Invalid Logは無限Retryしない。
- AI Rate LimitはBackoff Retryできる。

---

# 13. E09 Analysis Lifecycle / Upload

Priority：

```text
P0
```

Milestone：

```text
M2
```

## User Story

ユーザーとして、Access Logを選択して解析開始できる。

## Tasks

```text
Create Analysis API
Upload API
File Validation
Storage Upload
Analyzer Enqueue
Status API
Observation API
Explanation API
Analysis Delete API
AI Retry API
Polling
```

## Acceptance Criteria

Lifecycle：

```text
created
uploaded
analyzing
analyzer_result_ready
explaining
completed
failed
```

を表現できる。

- Upload成功後Analyzerを自動開始する。
- Queue enqueue失敗時に`analyzing`へ進めない。
- Analyzer partialでもObservationSetが有効ならAIへ進める。
- Analyzer fatalならAIを実行しない。
- AI失敗でもAnalysis Resultを利用できる。
- AI RetryはRaw Logなしで実行できる。
- Analyzer再解析はRaw Log削除後には行わない。

---

# 14. E10 Aggregation UI

Priority：

```text
P0
```

Milestone：

```text
M3
```

## Tasks

```text
AggregationTabs
PathTable
SourceIPTable
StatusTable
MethodTable
UserAgentTable
TimeView
Search
Sort
Basic Filter
Detail Drawer
Reference Highlight
```

## Acceptance Criteria

- Path / Source IP / Status / Method / UA / Timeを切替できる。
- TableをSortできる。
- Path / IP / UAを検索できる。
- Basic Filterを適用できる。
- Filter状態が視覚的に分かる。
- RowからDetailを開ける。
- ObservationSetに存在しないRaw Dataを表示しない。
- Countを危険度として表示しない。

---

# 15. E11 AI Explanation

Priority：

```text
P0
```

Milestone：

```text
M4
```

## Tasks

```text
AIExplanationInput Builder
OpenAI Adapter
Prompt Version
Structured Output
Schema Validation
Reference Validation
Persistence
Retry
Failure Handling
```

## Acceptance Criteria

AIへ渡すもの：

```text
ObservationSet
Parse / Truncation Summary
Known Information
Analysis Purpose
```

AIへ渡さないもの：

```text
Raw Log
Raw Storage Key
Unredacted Sensitive Value
```

Output：

```text
Summary
Overall Urgency
Findings
Limitations
Next Checks
References
```

- Finding-level Severity / Urgencyを生成しない。
- Observation ReferenceがObservationSetに存在することを検証する。
- AIがAnalyzer Countを上書きしない。
- AI FailureでもObservationSetを維持する。

---

# 16. E12 Analysis Result UI

Priority：

```text
P0
```

Milestone：

```text
M5
```

## User Story

ユーザーとして、解析結果を開いたときに今確認すべき内容を短時間で理解できる。

## Tasks

```text
Result Header
Parse Warning
Overall Urgency
AI Summary
Finding Card
Next Check
Data Limitation
Aggregation Integration
Related Data Navigation
AI Loading State
AI Failure State
```

## Acceptance Criteria

First Viewに、

```text
Metadata
Parse Warning
Overall Urgency
AI Summary
```

が視認できる。

Findingで、

```text
確認できたこと
考えられること
このログだけでは分からないこと
次に確認すること
```

を明確に区別する。

- Findingから2操作以内で関連Aggregationへ移動できる。
- ObservationとInterpretationを同じVisual Styleにしない。
- Parse WarningをFooterへ隠さない。
- AI Failure時もAggregationを閲覧できる。
- `Safe / Attack Confirmed / Risk Score`等をUIで独自生成しない。

---

# 17. E13 Project / Analysis Management UI

Priority：

```text
P0
```

Milestone：

```text
M5
```

## Tasks

```text
Project List
Project Create
Project Overview
Analysis List
Upload Screen
Processing Screen
Analysis History
Delete Analysis
Archive Project
```

## Acceptance Criteria

- 初見で新規Analysis開始場所が分かる。
- Project Listを監視Dashboard化しない。
- Latest AnalysisをProject Overviewで確認できる。
- ProcessingでUpload / Analyzer / AIのStageを区別できる。
- Fake Percentageを表示しない。
- Analysis Historyから過去Resultへ移動できる。
- Deleteは確認操作を必要とする。

---

# 18. E14 Known Information UI

Priority：

```text
P1
```

Milestone：

```text
M5
```

## Tasks

```text
Known Information List
Create
Edit
Enable / Disable
Source Display
Built-in Read Only
```

## Acceptance Criteria

- Project単位で管理できる。
- `exact / prefix`のみ選択可能。
- Built-inはRead Only。
- Sourceを表示する。
- Severity / Priority入力欄を作らない。
- Regex入力欄を作らない。

---

# 19. E15 Authentication / Ownership

Priority：

```text
P1
```

Milestone：

```text
M6
```

## Tasks

```text
Clerk Integration
Sign Up
Sign In
Email Verification
Session Validation
Account Sync
Project Ownership
Analysis Ownership
Authorization Middleware
Account Delete
```

## Acceptance Criteria

- 未認証UserはProject Dataへアクセスできない。
- 他AccountのProject IDを指定しても取得できない。
- Analysis取得時もProject Ownershipを検証する。
- Email Verification後にAnalysis利用可能とする。
- Frontend非表示だけでAuthorizationを済ませない。

---

# 20. E16 Entitlement / Usage

Priority：

```text
P1
```

Milestone：

```text
M7
```

## Tasks

```text
Plan
Entitlement Resolver
Usage Period
Usage Reservation
Project Limit
Analysis Limit
Upload Size Limit
AI Chat Gate
Export Gate
```

## Acceptance Criteria

- Analyzer CoreへPlan情報を渡さない。
- Free / Proで同一入力から同一ObservationSetを生成する。
- Limit CheckをServer-sideで行う。
- Analysis CountはObservationSet Persist Successで確定する。
- Duplicate RequestでUsageを二重消費しない。
- AI Provider/System Retryを新規AnalysisとしてCountしない。

---

# 21. E17 Billing

Priority：

```text
P1
```

Milestone：

```text
M7
```

## Tasks

```text
Stripe Customer
Checkout
Webhook
Subscription Sync
Upgrade
Cancel at Period End
Past Due
Grace Period
Billing Portal
```

## Acceptance Criteria

- FrontendのPayment SuccessだけでPro化しない。
- Stripe Webhook Signatureを検証する。
- WebhookをIdempotentに処理する。
- Subscription StateをDBへ同期する。
- Cancellation後Period EndまではProを維持できる。
- Payment FailureでProject / Analysisを削除しない。
- Card Number / CVCをPolaris DBへ保存しない。

---

# 22. E18 Security / Retention

Priority：

```text
P1
```

Milestone：

```text
M8
```

## Tasks

```text
Raw Log Delete
Delete Retry
Cleanup Job
24h Safety Cleanup
Sensitive Logging Review
Upload Safety
Tenant Isolation Test
Secret Management
AI Prompt Injection Boundary
Privacy Notice
```

## Acceptance Criteria

- ObservationSet Persist成功後Raw Log削除を開始する。
- Delete失敗をRetryできる。
- Expired Raw LogをCleanupできる。
- Raw LogをApplication Logへ出力しない。
- ObservationSet全体を通常Logへ出力しない。
- Full AI Promptを通常Logへ出力しない。
- Uploaded Fileを実行しない。
- Extension / MIMEだけを信用しない。
- Known Information / UA / Path等をAI Instructionとして扱わない。

---

# 23. E19 Responsive / Accessibility

Priority：

```text
P1
```

Milestone：

```text
M8
```

## Tasks

```text
Desktop Layout
Tablet Layout
Mobile Layout
Responsive Navigation
Responsive Aggregation
Drawer Adaptation
Touch Target
Keyboard Navigation
Focus Management
Contrast
Reduced Motion
```

## Acceptance Criteria

方針：

```text
Desktop First
Responsive Required
```

- 1440 / 1280 / 1024 / 768 / 390 / 375 / 320pxで主要画面が破綻しない。
- SmartphoneでもUrgency / Summary / Findings / Next Check / Limitationを読める。
- Desktop Tableを単純縮小しない。
- MobileではSummary Row + Detail等へ変換可能。
- Hoverなしで操作できる。
- Keyboardで主要操作が可能。
- Drawer / ModalのFocusを管理する。
- ColorだけでStatus / Urgencyを表現しない。
- WCAG AA相当のContrastを基本目標とする。

---

# 24. E20 Test / Benchmark / QA

Priority：

```text
P0 / P1
```

Milestone：

```text
M9
```

## Tasks

```text
Analyzer Unit Test
Parser Fixture
Aggregation Test
Known Info Test
Redaction Test
Selection Test
Reference Test
Lifecycle Integration Test
Worker Retry Test
Ownership Test
Entitlement Test
Billing Webhook Test
UI Test
Responsive Test
Accessibility Test
Benchmark
```

## Acceptance Criteria

Benchmark Sample：

```text
10MB
50MB
100MB
500MB
```

計測：

```text
Analyzer Duration
Peak Memory
CPU
ObservationSet Size
AI Input Token
AI Output Token
AI Latency
AI Cost
```

- Plan Limit / PricingをBenchmark前に固定しない。
- Synthetic Log FixtureをRepositoryへ保持する。
- Sensitive Real LogをTest FixtureとしてCommitしない。
- Analyzerの主要集計値を自動Testできる。

---

# 25. E21 Deployment / Operations

Priority：

```text
P1
```

Milestone：

```text
M10
```

## Tasks

```text
Railway Project
App Service
Worker Service
PostgreSQL
Redis
Storage Bucket
Environment Variables
Domain
HTTPS
Health Check
Migration
Backup
Monitoring
Cleanup Schedule
Production Deploy
```

## Acceptance Criteria

- AppとWorkerを別ProcessとしてDeployできる。
- WorkerにPublic Endpointを不要とする。
- PostgreSQL / Redis / StorageをPrivate接続できる範囲で構成する。
- HTTPSで提供する。
- Persistent DataをBackup対象にする。
- Raw LogをBackup対象にしない。
- Cleanup JobがProductionで動作する。
- API / Worker / Queue Failureを追跡できる。
- Sensitive DataをObservabilityへ送らない。

---

# 26. UI Component Backlog

共通Component：

```text
AppShell
Sidebar
PageHeader
Button
StatusBadge
UrgencyBadge
NoticeBanner
SummaryPanel
FindingCard
LimitationPanel
NextCheckList
AggregationTabs
DataTable
FilterBar
DetailDrawer
ChatDrawer
UploadDropzone
ProcessingSteps
EmptyState
ErrorState
ConfirmDialog
PlanCard
UsageMeter
```

---

# 27. Design Token Backlog

```text
Color Token
Typography Token
Spacing Token
Radius Token
Border Token
Surface Token
Breakpoint
Z-index
Motion
```

Design TokenはUI実装初期に作る。

画面ごとに個別Color / Spacingを増殖させない。

---

# 28. Vertical Slice 1
## 最初に完成させる流れ

最初の実装目標：

```text
Synthetic Access Log
↓
Analyzer
↓
ObservationSet
↓
DB Persist
↓
Aggregation UI
```

Auth / Billingより先にCore Analysis Flowを完成させる。

---

# 29. Vertical Slice 2

```text
Real File Upload
↓
Object Storage
↓
Queue
↓
Worker
↓
ObservationSet
↓
Raw Log Delete
↓
Aggregation UI
```

---

# 30. Vertical Slice 3

```text
ObservationSet
↓
AI Explanation
↓
Analysis Result
↓
Finding
↓
Aggregation Reference
```

ここでPolarisのCore Product Experienceが成立する。

---

# 31. Vertical Slice 4

```text
Authentication
↓
Project Ownership
↓
Analysis History
↓
Known Information
```

---

# 32. Vertical Slice 5

```text
Entitlement
↓
Usage
↓
Stripe
↓
Pro
↓
AI Chat / Export
```

---

# 33. Implementation Order

推奨：

```text
1 Foundation
2 Domain
3 Parser
4 Aggregation
5 Known Information
6 ObservationSet
7 Persistence
8 Worker
9 Upload Lifecycle
10 Aggregation UI
11 AI Explanation
12 Analysis Result UI
13 Project UI
14 Auth
15 Known Information UI
16 Entitlement
17 Billing
18 Security Hardening
19 Responsive / Accessibility
20 Benchmark
21 Production
```

---

# 34. UI Implementation Order

```text
1 Design Token
2 App Shell
3 Project List
4 Project Overview
5 Upload
6 Processing
7 Aggregation
8 Analysis Result
9 Finding Card
10 Drawer
11 Known Information
12 Billing
13 Responsive
14 Accessibility
```

ただしAnalysis Result / Finding CardはPrototypeを先行してよい。

---

# 35. Definition of Ready

Task着手前：

```text
目的が明確
Input / Outputが明確
Dependencyが解決
Acceptance Criteriaがある
UI Taskなら対象Wireframeがある
API TaskならContractがある
Security Boundaryが確認済み
```

---

# 36. Definition of Done

Task完了：

```text
Implementation
Type Check
Lint
Test
Error Handling
Logging Review
Acceptance Criteria確認
必要なDocumentation更新
```

UI：

```text
Desktop
Tablet
Mobile
Keyboard
Error
Loading
Empty
```

を必要範囲で確認。

---

# 37. Analyzer Definition of Done

Analyzer変更時：

```text
Synthetic Fixture
Expected Aggregation
Parse Warning
Redaction
Memory Behavior
ObservationSet Schema
```

を確認する。

---

# 38. AI Definition of Done

AI変更時：

```text
Prompt Version
Structured Output
Schema Validation
Reference Validation
Limitation
Raw Log非送信
Failure Fallback
```

を確認する。

---

# 39. Security Review Gate

Production前に必須：

```text
Tenant Isolation
Upload Safety
Raw Log Lifecycle
Sensitive Logging
AI Input
Webhook
Authorization
Secret
Deletion
Backup
```

---

# 40. UX Review Gate

Production前に必須：

```text
初見でUploadできる
Resultを10秒で理解できる
Observation / Interpretationを区別できる
Parse Warningを見落とさない
FindingからEvidenceへ辿れる
AI FailureをAnalyzer Failureと誤解しない
Pro CTAが不安を煽らない
Responsiveで主要情報を読める
```

---

# 41. MVP Scopeから外すもの

```text
Real-time Monitoring
Error Log Analysis
SIEM Integration
Incident Graph
Health Score
Risk Score
Detection Rule UI
Regex Known Information
Organization / Team
Cross-analysis Comparison
Raw Log Viewer
Raw Log Download
Graph Database
Kubernetes
Microservice分割
Complex Workflow Engine
Native Mobile App
```

---

# 42. MVP Release Criteria

MVP公開可能条件：

```text
Access LogをUploadできる
AnalyzerがObservationSetを生成できる
Parse Warningが表示される
Raw Logが削除される
Aggregationを確認できる
AI Summaryを生成できる
Overall Urgencyを確認できる
Findingsを確認できる
Next Checkを確認できる
Data Limitationを確認できる
FindingからEvidenceへ辿れる
Account / Ownershipが成立する
Free / Pro EntitlementがServer-sideで成立する
Billingが同期する
Cleanupが動く
主要Security Reviewが完了
Responsiveで主要情報が閲覧可能
Benchmarkに基づくUpload Limitが設定されている
```

---

# 43. MVPで最も重要なAcceptance Test

Scenario：

```text
Web担当者が
「昨日アクセスが増えたので確認してほしい」
という問い合わせを受ける
```

操作：

```text
Projectを開く
↓
Access LogをUpload
↓
Analysis完了を待つ
↓
Resultを開く
```

10秒以内に、

```text
今すぐ確認すべきか
何が確認されたか
何が考えられるか
何が分からないか
次に何を見るか
```

を理解できる。

さらに、

```text
関連データを見る
```

からAnalyzerの根拠へ辿れる。

これをPolaris MVPの最重要End-to-End Acceptance Testとする。

---

# 44. Backlog運用方針

Issueは可能な限り、

```text
1 Issue
=
1つの明確な成果
```

とする。

巨大な、

```text
Analyzerを作る
UIを作る
```

Issueにはしない。

---

# 45. Claude Codeへ渡す単位

推奨：

```text
Epic
↓
1〜3 Task
↓
Acceptance Criteria
↓
関連設計書
```

を1回の実装単位とする。

複数Architecture Layerを一度に変更させすぎない。

---

# 46. Documentation Update Rule

実装中に設計変更が発生した場合：

```text
Codeだけ変更
```

ではなく、

```text
Affected Design Document
↓
Update
↓
Implementation
```

を基本とする。

設計書と実装の乖離を残さない。

---

# 47. MVP Backlog確定事項

1. Analyzer CoreをAuth / Billingより先に完成させる。
2. 最初のVertical SliceはAnalyzer → ObservationSet → Aggregation UI。
3. AI ExplanationはObservationSet完成後に実装する。
4. Analysis Result UIをCore Product Experienceとして扱う。
5. Finding → Evidenceの導線をP0とする。
6. Authentication / Ownershipは公開前P1必須。
7. Entitlement / BillingはAnalyzerから分離する。
8. Security / Retentionは公開前Gateとする。
9. ResponsiveはDesktop Firstだが公開前必須。
10. AccessibilityをUI完成後の追加作業にしない。
11. Benchmark後にUpload Limit / Pricingを確定する。
12. Error Log AnalysisはMVP外。
13. Raw Log Viewer / DownloadはMVP外。
14. Real-time MonitoringはMVP外。
15. Cross-analysis ComparisonはMVP外。
16. Health Score / Risk Scoreは実装しない。
17. Detection Rule UIは実装しない。
18. Backlog IssueはAcceptance Criteriaを必須とする。
19. 設計変更時は関連Markdownを更新する。
20. End-to-Endで「10秒で今見るべきことが分かる」を最重要Acceptance Testとする。

---

# 48. 次の作業

設計から実装準備への移行として、次は、

```text
26_Development_Setup_and_First_Sprint
```

を作成する。

対象：

```text
Repository作成手順
Directory Structure
Package初期化
Local Environment
Environment Variables
Docker Compose
Database / Redis / Storage
Initial Prisma Schema
CI
Sprint 1 Task
Claude Codeへ渡す実装Prompt
```

これにより、設計書から実際のRepository作成・実装開始へ移行できる。

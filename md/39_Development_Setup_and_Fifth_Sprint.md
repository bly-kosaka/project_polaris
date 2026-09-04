# Project Polaris
# 39_Development_Setup_and_Fifth_Sprint
## Sprint 5 実装指示・受入基準

---

# 1. Sprint 5 の目的

Sprint 4では、

```text
HTTP Request
↓
Temporary Object Storage
↓
Queue
↓
Worker
↓
Analyzer
↓
ObservationSet Persist
↓
Raw Log Delete
```

という非同期解析Lifecycleが成立した。

Sprint 5では、このProduct Coreをユーザーが実際に操作・確認できるようにする。

Sprint 5の中心は：

> **ObservationSetを「読めるProduct UI」へ変換すること**

である。

---

# 2. Sprint 5 のゴール

Sprint 5完了時、ユーザーはBrowserから次を実行できる。

```text
Projectを作成
↓
Analysisを作成
↓
Access LogをUpload
↓
解析中状態を確認
↓
解析完了
↓
Analysis Resultを開く
↓
Parse Warning / Data Limitationを確認
↓
Path / Source IP / Status / Method / User-Agent / Time集計を見る
↓
Aggregation RowをDrill-downする
```

このSprintではAI Explanationをまだ実装しない。

したがって、

```text
AI Summary
Overall Urgency
Findings
Interpretation
Next Check
AI Chat
```

を偽データや固定文言で表示してはならない。

---

# 3. Sprint 5 の位置付け

Implementation Milestoneとしては：

```text
M3 Aggregation UI
+
M5 Product UIの基礎部分
```

を実装するSprintとする。

AI ExplanationはSprint 6へ分離する。

---

# 4. Sprint 5 Core Flow

```text
Browser
↓
Vue Web App
↓
Fastify API
↓
Project / Analysis
↓
Upload
↓
Queue / Worker
↓
Analyzer
↓
ObservationSet
↓
Polling
↓
Analysis Result UI
↓
Aggregation Drill-down
```

---

# 5. Sprint 5で最も重要な画面

最重要画面：

```text
S23 Analysis Result
解析結果
```

理由：

PolarisのProduct Valueは、
単にログをUploadできることではない。

ユーザーが解析結果を見て、

```text
何が確認できたか
解析品質に問題がないか
どの集計を見るべきか
根拠データは何か
```

を短時間で把握できることに価値がある。

Sprint 5ではAIがまだないため、
「今見るべきこと」はAggregation中心になるが、
将来AI Findingを上部へ追加できる情報階層を崩さない。

---

# 6. 既存Presentation設計との整合

`10_Output_Presentation.md`の基本構造：

```text
Level 1: 解析状態 / Summary
Level 2: 今見るべきこと
Level 3: Finding詳細
Level 4: 根拠Observation
Level 5: Aggregation View
```

Sprint 5ではAI部分が未実装なので：

```text
Level 1: 解析状態 / Analyzer Summary
Level 2: Parse Warning / Data Limitation
Level 3: Aggregation Summary
Level 4: Aggregation View
Level 5: Aggregation Detail
```

まで実装する。

Sprint 6で：

```text
AI Summary
Overall Urgency
Findings
Next Check
```

をLevel 1〜3へ追加する。

---

# 7. 対象画面

Sprint 5対象：

```text
S10 Project List
S11 Project Create
S12 Project Overview

S20 Analysis List
S21 Analysis Upload
S22 Analysis Processing
S23 Analysis Result
```

Sprint 5では：

```text
S30 Known Information
S40 Billing
S50 Account
```

は対象外。

---

# 8. Frontend Stack

既存方針を維持する。

```text
Vue 3
Vite
TypeScript
Vue Router
```

State管理はMVPでは、

```text
Vue Composition API
+
page-local state
```

を基本とする。

PiniaはSprint 5では必須にしない。

理由：

```text
画面数がまだ少ない
Server Stateが中心
Global Client Stateがほぼない
```

から。

---

# 9. apps/web Current State

Sprint 4完了時点で：

```text
apps/web
├─ package.json
├─ tsconfig.json
└─ src
   └─ index.ts
```

のみ。

Sprint 5ではVue Applicationとして成立させる。

推奨：

```text
apps/web
├─ index.html
├─ vite.config.ts
├─ package.json
├─ tsconfig.json
└─ src
   ├─ main.ts
   ├─ App.vue
   ├─ router/
   ├─ api/
   ├─ components/
   ├─ composables/
   ├─ layouts/
   ├─ pages/
   ├─ styles/
   └─ types/
```

---

# 10. Routing

初期Route：

```text
/
→ /projects

/projects
→ Project List

/projects/new
→ Project Create

/projects/:projectId
→ Project Overview / Analysis List

/projects/:projectId/analyses/new
→ Analysis Upload

/analyses/:analysisId/processing
→ Analysis Processing

/analyses/:analysisId
→ Analysis Result
```

RouteはBusiness StateのSource of Truthにしない。

Analysis stateはAPIから取得する。

---

# 11. API追加Scope

Sprint 4 API：

```text
POST /projects/{projectId}/analyses
POST /analyses/{analysisId}/upload
GET  /analyses/{analysisId}
GET  /analyses/{analysisId}/observations
```

のみではUIでProjectを作成・一覧表示できない。

Sprint 5では最低限以下を追加する。

```text
POST /projects
GET  /projects
GET  /projects/{projectId}
GET  /projects/{projectId}/analyses
```

必要なら：

```text
DELETE /analyses/{analysisId}
```

は後回しでもよい。

Project DeleteもSprint 5対象外。

---

# 12. API Response Model

FrontendがPrisma Modelへ依存しないよう、
API DTOを明示する。

例：

```typescript
interface ProjectSummaryDto {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface AnalysisSummaryDto {
  id: string;
  projectId: string;
  status: AnalysisStatus;
  analyzerStatus: AnalyzerStatus;
  createdAt: string;
  updatedAt: string;
  originalFileName?: string;
  fileSizeBytes?: number;
}
```

ObservationSetは既存Domain Schemaを利用してよいが、
FrontendからDB Persistence Shapeへ依存させない。

---

# 13. API Error Contract

Frontendで扱える形へ揃える。

推奨：

```typescript
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
```

例：

```text
PROJECT_NOT_FOUND
ANALYSIS_NOT_FOUND
UPLOAD_TOO_LARGE
UPLOAD_ALREADY_EXISTS
OBSERVATION_SET_NOT_READY
ANALYSIS_FAILED
INTERNAL_ERROR
```

ユーザー向け表示文言はFrontendで変換してよい。

Raw Exception Messageを返さない。

---

# 14. API Client

`apps/web/src/api/`

推奨：

```text
client.ts
projects.ts
analyses.ts
```

共通：

```typescript
async function apiFetch<T>(...)
```

で：

```text
base URL
JSON parse
HTTP Error parse
AbortSignal
```

を扱う。

Axios導入は不要。

Native `fetch()`で十分。

---

# 15. Environment

Frontend：

```text
VITE_API_BASE_URL
```

例：

```text
http://localhost:3000
```

ProductionではRailway/Vercel等へ差し替え可能にする。

Hard Codeしない。

---

# 16. CORS

FrontendとAPIが別OriginになるLocal Devを想定する。

Fastify APIで：

```text
CORS
```

を明示設定する。

MVP local：

```text
http://localhost:5173
```

等。

ProductionはEnvironment Variableから許可Originを設定できるようにする。

```text
CORS_ORIGIN
```

`*`固定は避ける。

---

# 17. Project List

表示：

```text
Project Name
Analysis Count
Latest Analysis
Updated At
```

Analysis Count / Latest AnalysisをAPIで返すか、
Analysis listからFrontend集計するかは実装時に単純な方を選ぶ。

MVPではN+1 APIにならない方を優先。

Empty：

```text
まだProjectがありません。
最初のProjectを作成してください。
```

---

# 18. Project Create

入力：

```text
Project Name
```

のみ。

Validation：

```text
必須
trim
最大長
```

Project作成後：

```text
/projects/:projectId
```

へ遷移。

---

# 19. Project Overview

最初は：

```text
Project Name
新しい解析
Analysis List
```

に集中する。

Dashboard KPI等は作らない。

Analysis List：

```text
Created At
File Name
Status
Analyzer Status
Request Count
```

ObservationSet未作成時はRequest Countを`—`にする。

---

# 20. Analysis Upload

Flow：

```text
POST /projects/:projectId/analyses
↓
analysisId
↓
POST /analyses/:analysisId/upload
↓
202
↓
/analyses/:analysisId/processing
```

File Input：

```text
single file
```

Drag & Dropは実装してよいが必須ではない。

まずNative File Inputで成立させる。

---

# 21. Upload Validation UI

Frontend Validation：

```text
file exists
size <= MAX_UPLOAD_BYTES相当
```

ただしFrontend ValidationはUX用。

Security / authoritative ValidationはAPI側。

FrontendだけでUploadを許可・拒否しない。

Extensionを信用しない。

---

# 22. Upload Error

最低限：

```text
File too large
Already uploaded
Network failure
Server error
```

を区別する。

Upload失敗時、
作成済みAnalysisが`created`で残る可能性がある。

Sprint 5ではAnalysis cleanup UIまで不要。

再Upload可能なら同じAnalysisで再試行、
不可なら新Analysis作成のどちらかをAPI Contractに合わせる。

曖昧に実装しない。

---

# 23. Processing Screen

表示：

```text
解析中
```

だけでなく、Analysis.statusに応じて表示を変える。

```text
created
→ アップロード待ち

uploaded
→ 解析待ち

analyzing
→ ログを解析しています

analyzer_result_ready
→ 解析結果を表示します

failed
→ 解析できませんでした
```

AI用Status：

```text
explaining
completed
```

はSprint 5では通常到達しないが、
将来壊れないようRoute Guardで扱える。

---

# 24. Polling

MVPではWebSocket/SSE不要。

```text
GET /analyses/:analysisId
```

をPolling。

推奨：

```text
2 sec
```

程度。

終了条件：

```text
analyzer_result_ready
failed
completed
```

Page Unmount時に停止。

Visibility API等の最適化は任意。

---

# 25. Processing → Result

```text
status = analyzer_result_ready
```

になったら：

```text
/analyses/:analysisId
```

へ遷移。

FrontendでAnalyzer成功を推測しない。

API StatusをSource of Truthにする。

---

# 26. Analysis Result — Sprint 5版

上から：

```text
1. Analysis Header
2. Analyzer Status
3. Parse Warning / Data Limitation
4. Overview
5. Aggregation Tabs
6. Aggregation Table
7. Detail Drawer
```

AIがまだないため：

```text
Overall Urgency
AI Summary
Finding
Next Check
```

は表示しない。

---

# 27. Result Header

最低限：

```text
Project Name
File Name
Analysis Date
Analyzed Period
Request Count
Analyzer Status
```

表示。

内部Enumそのままではなく：

```text
success
→ 解析完了

partial
→ 一部データに警告あり

failed
→ 解析できませんでした
```

等の日本語表示。

英語Technical Termを使う場合も日本語補足を付ける。

---

# 28. Analyzer Failed Screen

`Analysis.status = failed`

またはAnalyzer fatalのとき：

```text
解析できませんでした
```

を表示。

表示可能なら：

```text
error code
Parse Summary
```

を利用。

絶対に：

```text
問題ありません
安全です
異常なし
```

と表示しない。

ObservationSetが存在しない場合、
Aggregation Tabsを表示しない。

---

# 29. Parse Warning

必ず見える位置に置く。

例：

```text
解析上の注意

100,000行中250行を解析できませんでした。
この解析結果は99,750行を基にしています。
```

表示候補：

```text
Total Lines
Parsed Lines
Partial Lines
Failed Lines
Warning Codes
Unavailable Fields
```

常時展開でもよい。

---

# 30. Data Limitation

Sprint 5で表示：

```text
Parse Warning
Unavailable View
Truncation
Redaction Summary
Exclusion Summary
Known Information availability
```

一つのPanelにまとめてもよい。

重要：

```text
解析品質・解析条件に関する情報を
見つけにくいFooterへ隠さない。
```

---

# 31. Truncation

ObservationSetが選出済みGroupのみ含む場合：

```text
Path集計
10,000 Group中100 Groupを表示対象として保持
```

等。

表現：

```text
残り9,900件は未解析
```

ではない。

```text
Analyzer集計後、
ObservationSetへ保持されたGroup数
```

という意味を崩さない。

---

# 32. Redaction

表示：

```text
機密情報を含む可能性のある値はマスクされています。
```

Raw Sensitive Valueを表示しない。

`[REDACTED]`はそのまま表示してよい。

---

# 33. Exclusion

例：

```text
除外ルールにより
1,200 Requestを解析対象から除外
```

Exclusionは：

```text
危険でないアクセス
```

という意味ではない。

---

# 34. Aggregation Tabs

初期：

```text
Path
Source IP
Status
Method
User-Agent
Time
```

`Source IP × Path`はPrimary Tabにしない。

Drill-downで利用する。

---

# 35. Aggregation Table — Path

表示候補：

```text
Path
Request Count
Distinct Source IP
Distinct User-Agent
Method Distribution
Status Distribution
Known Information
```

必要に応じて：

```text
First Seen
Last Seen
Query Variant Count
```

を追加。

Columnを詰め込みすぎない。

---

# 36. Aggregation Table — Source IP

表示：

```text
Source IP
Request Count
Distinct Path
Distinct User-Agent
4xx
5xx
Top Paths
```

IPをDangerous badgeで表示しない。

単なる観測Dimension。

---

# 37. Aggregation Table — Status

表示：

```text
Status
Request Count
```

必要なら割合。

`404 = attack`等の意味付けをUIで行わない。

---

# 38. Aggregation Table — Method

表示：

```text
Method
Request Count
```

GET / POST等。

POSTをDanger badgeで表示しない。

---

# 39. Aggregation Table — User-Agent

表示：

```text
User-Agent
Request Count
Distinct Path
Distinct Source IP
```

User-Agent文字列が長いので：

```text
ellipsis
+
Detail Drawer
```

を利用。

---

# 40. Aggregation Table — Time

初期：

```text
1 minute
5 minute
```

切替。

表示：

```text
Bucket Start
Request Count
Distinct Source IP
Distinct Path
Status Distribution
```

GraphはSprint 5では必須にしない。

Tableで成立させる。

必要なら簡単なBarは後から追加。

---

# 41. Default Sort

UIがRisk Scoreを生成してはならない。

各TabのDefault Sort：

```text
Path
→ Request Count desc

Source IP
→ Request Count desc

Status
→ Request Count desc

Method
→ Request Count desc

User-Agent
→ Request Count desc

Time
→ bucket asc
```

これは表示上のSortingであり、
Severity / Priorityではない。

---

# 42. Filter

Sprint 5最低限：

```text
Search
Status
Method
Known Information
```

ただし全Tabに同じFilterを無理に適用しない。

例：

```text
Path
→ Search / Known Information

Source IP
→ Search

Status
→ Search

Method
→ Search
```

---

# 43. Client-side Filtering

ObservationSetのSelected Group数はboundedなので、
Sprint 5ではClient-side Filterでよい。

APIへAggregation Query Endpointを増やさない。

将来大量表示が必要になったらServer-sideへ移行。

---

# 44. Detail Drawer

Row Click：

```text
Right Drawer
```

またはDesktopならSide Panel。

Drawerで：

```text
Group ID
Primary Dimension
Request Count
Distribution
First Seen
Last Seen
Sample
Known Information
References
```

を表示。

Raw Log Viewerではない。

---

# 45. Group Reference

`Source IP × Path`等のReferenceを使い：

```text
Related Path
Related Source IP
```

へ遷移できるようにする。

Sprint 5ではGraph View不要。

リンク：

```text
関連するPathを見る
関連するSource IPを見る
```

程度で十分。

---

# 46. Known Information表示

一致Group：

```text
Known Information
既知情報
```

の補足を表示。

例：

```text
/wp-login.php
WordPress Login Path
WordPressで一般的にログインに使用されるPath
```

Danger Labelにはしない。

---

# 47. Empty Result

Group 0件：

```text
この集計軸では表示できるデータがありません。
```

Finding 0件の文言はSprint 6。

---

# 48. Availability

ObservationSetが特定Viewを生成できない場合：

```text
このログ形式では
User-Agent情報を利用できません。
```

など。

空配列とUnavailableを区別する。

---

# 49. Loading

Result取得中：

```text
解析結果を読み込んでいます
```

Aggregation Tab切替でSkeleton乱用は不要。

ObservationSetを一括取得してClient-side切替するなら、
初回Loadingだけでよい。

---

# 50. Error State

Frontend：

```text
Network Error
API 404
ObservationSet not ready
Analyzer failed
Unexpected response
```

を区別。

Unexpected JSONで画面Crashさせない。

---

# 51. Runtime Validation

API ResponseをTypeScript Typeだけで信用しない。

既存Zod方針を利用し、
Frontend向けDTOも必要に応じてValidationする。

特に：

```text
Analysis Status
ObservationSet
```

はRuntime Validation対象。

---

# 52. Visual Direction

既存Brand：

```text
Base
#101936

Accent
#7DE2FC
```

方向：

```text
Professional
Calm
Technical
Reliable
Focused
Modern
```

避ける：

```text
Hacker UI
SOC Alarm UI
赤だらけ
Cyberpunk
過度なGlow
ロマンチックな星空表現
```

星座 / 望遠鏡モチーフは、
背景装飾やBrand Accent程度。

操作UIを犠牲にしない。

---

# 53. Dark Mode

Sprint 5では：

```text
Dark Primary
```

でよい。

ただし色を意味の唯一の伝達手段にしない。

例：

```text
partial
→ 色 + 「一部データに警告あり」
```

---

# 54. Layout

Desktop：

```text
Fixed Header
Left Navigation
Main Content
Optional Right Drawer
```

最大幅：

```text
1440〜1600px程度
```

Result Tableは横幅を活かす。

---

# 55. Responsive

方針：

```text
Desktop First
not Desktop Only
```

Breakpoints初期：

```text
>= 1200px Desktop
768-1199px Tablet
< 768px Mobile
```

---

# 56. Mobile Priority

Mobileで必ず確認可能：

```text
Analysis Status
Parse Warning
Data Limitation
Overview
Aggregation Tab
主要集計値
```

Tableは：

```text
horizontal scroll
```

でもよい。

無理にCardへ変換しすぎない。

---

# 57. Accessibility

最低限：

```text
WCAG AAを意識
Keyboard操作
Visible Focus
Button / Link semantics
aria-label必要箇所
Table header
Drawer close
No hover-only interaction
Reduced Motion
```

---

# 58. Component Design

過剰なDesign System構築はしない。

共通化候補：

```text
AppShell
PageHeader
StatusBadge
NoticePanel
EmptyState
ErrorState
LoadingState
DataTable
TabNav
DetailDrawer
KeyValueList
DistributionList
KnownInformationBadge
```

---

# 59. CSS

Sprint 5でUI Framework導入は必須にしない。

候補：

```text
Plain CSS
CSS Modules
Vue scoped CSS
```

のいずれか。

Tailwind等を入れる場合も、
導入自体を目的にしない。

既存依存を増やしすぎない。

---

# 60. API — Project Repository

既存`PrismaProjectRepository`を利用。

API HandlerからPrismaを直接操作せず、
Repository Boundaryを維持。

---

# 61. API — Analysis List

既存：

```text
AnalysisRepository.listByProjectId()
```

を利用できる。

Project ownershipはSprint 6/7 Auth導入前なので、
現在はProject存在確認まで。

Auth導入時に：

```text
Account
→ Project
→ Analysis
```

Ownershipへ拡張する。

---

# 62. No Auth in Sprint 5

対象外：

```text
Clerk
Login
Signup
Account ownership
```

UIへFake Userを作らない。

NavigationにもAccount Menuを無理に作らない。

---

# 63. No Billing in Sprint 5

対象外：

```text
Stripe
Plan
Entitlement
Paywall
```

Free/Pro表示も実装しない。

---

# 64. No AI in Sprint 5

対象外：

```text
OpenAI SDK
AI Queue
Prompt Builder
AIExplanationResult
Urgency
Findings
Chat
```

Result上部に：

```text
AI分析準備中
Coming soon
```

のようなProduct表示も不要。

Sprint 6で実装する。

---

# 65. No Health Score

Health Scoreを作らない。

Risk Scoreを作らない。

Severityを作らない。

Priorityを作らない。

Analyzer Countから独自評価を作らない。

---

# 66. UI Explainability

Sprint 5で保証する最小Explainability：

```text
Aggregation Row
↓
Group Detail
↓
Known Information
↓
Related References
```

Sprint 6で：

```text
Finding
↓
Observation Reference
↓
Aggregation Row
```

を上に接続する。

---

# 67. Security

Frontendへ送らない：

```text
storageKey
S3 credentials
Redis details
raw server errors
raw access log
```

必要なPresentation DataだけAPIから返す。

---

# 68. Original File Name

Original File NameはUI表示用として使用可能。

Storage Keyへは使わない。

Sprint 4のInvariant維持。

---

# 69. Raw Log

Sprint 5でも：

```text
Raw Log Viewer
Raw Log Download
```

を実装しない。

ObservationSetのみ表示。

---

# 70. Sensitive Values

Sample Query等がObservationSetに含まれる場合、
既にRedaction済みであることが前提。

Frontendで、

```text
[REDACTED]
```

を復元しようとしない。

---

# 71. Testing — Frontend

最低限：

```text
API Client Unit Test
Status Mapping Test
Data Limitation Rendering
Aggregation Tab Rendering
Empty State
Unavailable State
Filter
Drawer
Processing Polling
Polling Stop
Route Transition
```

Vue Test Utils導入可。

---

# 72. Testing — API

追加Endpoint：

```text
POST /projects
GET /projects
GET /projects/:id
GET /projects/:id/analyses
```

についてIntegration Test。

---

# 73. Testing — E2E

Sprint 5最重要E2E：

```text
Project Create
↓
Analysis Create
↓
Upload
↓
Worker Analyze
↓
Polling
↓
Result Page
↓
Path Aggregation visible
↓
Row Click
↓
Detail Drawer visible
```

Playwright導入は可能。

ただしSprint 5で依存が増えすぎる場合、
Fastify inject + Vue component integrationを優先してもよい。

最低1本はBrowser相当Flowを自動化する。

---

# 74. Acceptance A-01

```text
ProjectをBrowserから作成できる
```

---

# 75. Acceptance A-02

```text
Project内でAnalysisを作成できる
```

---

# 76. Acceptance A-03

```text
Access LogをUploadできる
```

---

# 77. Acceptance A-04

```text
Upload後にProcessing画面へ遷移する
```

---

# 78. Acceptance A-05

```text
Processing画面がAPIをPollingする
```

---

# 79. Acceptance A-06

```text
analyzer_result_ready後
Resultへ遷移する
```

---

# 80. Acceptance A-07

```text
Parse Warningが確認できる
```

---

# 81. Acceptance A-08

```text
Data Limitationが確認できる
```

---

# 82. Acceptance A-09

```text
Path Aggregationを表示できる
```

---

# 83. Acceptance A-10

```text
Source IP Aggregationを表示できる
```

---

# 84. Acceptance A-11

```text
Status Aggregationを表示できる
```

---

# 85. Acceptance A-12

```text
Method Aggregationを表示できる
```

---

# 86. Acceptance A-13

```text
User-Agent Aggregationを表示できる
```

---

# 87. Acceptance A-14

```text
Time Aggregationを表示できる
```

---

# 88. Acceptance A-15

```text
Unavailable ViewとEmpty Viewを区別できる
```

---

# 89. Acceptance A-16

```text
Known Information Matchが補足情報として表示される
```

Danger Labelではない。

---

# 90. Acceptance A-17

```text
Aggregation RowからDetail Drawerを開ける
```

---

# 91. Acceptance A-18

```text
UIがRisk / Severity / Priorityを独自生成しない
```

---

# 92. Acceptance A-19

```text
Analyzer Failed時に
安全・問題なし等の誤解を招く文言を表示しない
```

---

# 93. Acceptance A-20

```text
Raw Log / storageKey / credentialsがFrontendへ出ない
```

---

# 94. Acceptance A-21

```text
Desktop / Tablet / Mobileで
主要情報へアクセス可能
```

---

# 95. Acceptance A-22

```text
Keyboardで主要操作可能
```

---

# 96. Acceptance A-23

```text
CIでFrontend Typecheck / Test / Build PASS
```

---

# 97. Acceptance A-24

```text
Project → Upload → Analyze → Result
のE2EがPASS
```

---

# 98. Sprint 5 Task List

```text
S5-01  apps/web Vue 3 / Vite setup
S5-02  Vue Router setup
S5-03  Global CSS / Design Tokens
S5-04  AppShell
S5-05  Frontend API Client
S5-06  API Error Contract
S5-07  CORS Configuration
S5-08  POST /projects
S5-09  GET /projects
S5-10  GET /projects/:projectId
S5-11  GET /projects/:projectId/analyses
S5-12  Project DTO
S5-13  Analysis DTO
S5-14  Project List
S5-15  Project Create
S5-16  Project Overview
S5-17  Analysis List
S5-18  Analysis Upload Page
S5-19  File Validation UX
S5-20  Upload Error UI
S5-21  Analysis Processing Page
S5-22  Polling Composable
S5-23  Polling Stop / Cleanup
S5-24  Processing Status Mapping
S5-25  Result Page Shell
S5-26  Analyzer Status Panel
S5-27  Parse Warning Panel
S5-28  Data Limitation Panel
S5-29  Overview Panel
S5-30  Aggregation Tab Navigation
S5-31  Path Table
S5-32  Source IP Table
S5-33  Status Table
S5-34  Method Table
S5-35  User-Agent Table
S5-36  Time Table
S5-37  1m / 5m Time Toggle
S5-38  Search Filter
S5-39  Known Information Filter
S5-40  Unavailable State
S5-41  Empty State
S5-42  Detail Drawer
S5-43  Known Information Display
S5-44  Group Reference Navigation
S5-45  Responsive Layout
S5-46  Accessibility
S5-47  Frontend Unit Tests
S5-48  API Integration Tests
S5-49  Product E2E Test
S5-50  CI Frontend Build/Test
```

---

# 99. Out of Scope

Sprint 5では実装しない：

```text
AI Explanation
OpenAI API
AI Queue
AI Retry
Overall Urgency
Findings
Interpretation
Next Check
AI Chat

Authentication
Clerk
Account
Ownership

Billing
Stripe
Entitlement
Plan UI

Known Information Management UI

Report Export
CSV Export

Comparison
Health Score
Risk Score
Severity
Priority

WebSocket
SSE

Raw Log Viewer
Raw Log Download

Graph View
SIEM
Realtime Monitoring
```

---

# 100. Sprint 5 Completion Definition

次が成立すればSprint 5 COMPLETE。

```text
Browser
↓
Project Create
↓
Analysis Create
↓
Upload
↓
Processing
↓
Analyzer Result
↓
ObservationSet
↓
Aggregation UI
↓
Drill-down
```

かつ：

```text
Parse Warning visible
Data Limitation visible
No fake AI output
No Risk/Severity generation
No Raw Log exposure
Responsive
Accessible
CI PASS
```

---

# 101. Sprint 6 Preview

Sprint 6：

```text
ObservationSet
↓
AI Explanation Queue
↓
OpenAI Responses API
↓
AIExplanationResult Persist
↓
Overall Urgency
↓
AI Summary
↓
Findings
↓
Next Check
↓
Finding → Aggregation Drill-down
```

Sprint 5で作るResult UIの上部へ、
このAI Layerを追加する。

つまりSprint 5 UIを捨てずに、

```text
Analyzer Result UI
+
AI Explanation UI
```

へ拡張する。

---

# 102. Claude Codeへの実装依頼

以下をClaude Codeへ渡す。

```text
Project Polaris Sprint 5を実装してください。

必ず以下を最初に読んでください。

- md/10_Output_Presentation.md
- md/39_Development_Setup_and_Fifth_Sprint.md
- md/38_Sprint_4_Final_Review.md
- 現在のapps/api
- 現在のapps/web
- packages/domain
- packages/db

Sprint 5の目的は、
Sprint 4で完成した非同期Analyzer Lifecycleを
ユーザーがBrowserから操作・確認できるProduct UIへ接続することです。

重要：

- AI ExplanationはSprint 5では実装しない
- Fake AI Summary / Finding / Urgencyを作らない
- Analyzer CountからRisk / Severity / Priorityを作らない
- ObservationSetを表示する
- Parse Warning / Data Limitationを必ず見える位置に出す
- Raw Log Viewerは作らない
- storageKey / secretsをFrontendへ返さない
- UIはProfessional / Calm / Technical
- #101936 / #7DE2FCをBrand基準にする
- Desktop FirstだがMobileでも主要情報を確認可能にする
- Vue 3 + Vite + TypeScript
- Yarnを使用する
- 既存Architectureを壊さない
- Repository / Domain Boundaryを維持する
- 過剰な抽象化を追加しない

まずRepositoryの現状を確認し、
Sprint 5 Implementation Planを作成してください。

Planには最低限以下を含めてください。

1. 現在のRepository状態
2. 追加・変更File一覧
3. API追加内容
4. Frontend Architecture
5. Routing
6. Component構成
7. ObservationSet → UI mapping
8. Processing Polling
9. Aggregation Tables
10. Detail Drawer
11. Error / Empty / Unavailable State
12. Responsive / Accessibility
13. Test Plan
14. E2E Plan
15. CI変更
16. Security確認
17. Sprint 5 Scope外確認
18. 実装順序
19. Acceptance Criteria対応表
20. Risk / Open Questions

この段階では実装を開始しないでください。

Implementation Planを提示した時点で停止し、
レビューを待ってください。
```

---

# 103. 最終方針

Sprint 5では、

```text
「画面を作る」
```

こと自体を目的にしない。

目的は：

> **Analyzerが整理した観測事実を、Web運用担当者が迷わず確認できるProduct UIにすること**

である。

AIがない状態でも、

```text
解析が成功したか
解析品質に注意があるか
どの集計が存在するか
何件あるか
どのPath / IP / Statusが多いか
Known Informationが付いているか
詳細は何か
```

を把握できる状態をSprint 5の完成形とする。

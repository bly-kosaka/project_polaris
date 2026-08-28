# Project Polaris
# 22_UI_Interaction_Design
## UI・インタラクション設計

---

# 1. 目的

本書では、21_Screen_Architectureで定義した画面構成を、実際に操作できるUIへ落とし込む。

対象：

```text
Navigation Behavior
Layout
Visual Hierarchy
Component
Finding Card
Aggregation Table
Filter
Drill-down
Upload Interaction
Processing State
AI Chat
Warning
Error
Empty State
CTA
Responsive
Accessibility
```

最重要目標：

> **Analysis Resultを見た瞬間に、ユーザーが「今何を見るべきか」を理解できること。**

---

# 2. UI設計の最重要原則

PolarisはDashboard Toolではなく、

```text
判断支援ツール
```

である。

したがって、UIは「大量の情報を一覧すること」より、

```text
優先順位
理解
根拠確認
次Action
```

を支援する。

---

# 3. Visual Hierarchy

情報階層：

```text
Level 1
今見るべきこと

Level 2
なぜそう考えられるか

Level 3
何が分からないか

Level 4
次に何を確認するか

Level 5
詳細なAggregation
```

---

# 4. Global Layout

Desktop推奨：

```text
┌────────────────────────────────────────────┐
│ Top Header                                 │
├─────────────┬──────────────────────────────┤
│ Sidebar     │ Main Content                 │
│             │                              │
│             │                              │
│             │                              │
└─────────────┴──────────────────────────────┘
```

Analysis Resultでは必要に応じて、

```text
Right Drawer
```

を追加する。

---

# 5. Sidebar

表示：

```text
Project Switcher
Overview
Analyses
Known Information

---
Billing
Account
```

Sidebarは固定またはSticky。

現在地を明確に表示する。

---

# 6. Sidebarで避けること

避ける：

```text
大量IconだけNavigation
折りたたみ過多
多階層Menu
Security Dashboard項目
```

Navigationは短く保つ。

---

# 7. Top Header

用途：

```text
Breadcrumb
Page Title
Primary Action
Account Menu
```

例：

```text
Project A / Analysis / 2026-08-28
```

---

# 8. Analysis Result Layout

推奨：

```text
┌────────────────────────────────────────────┐
│ Header / Metadata                          │
├────────────────────────────────────────────┤
│ Parse Warning / Important Notice           │
├────────────────────────────────────────────┤
│ Overall Urgency                            │
├────────────────────────────────────────────┤
│ AI Summary                                 │
├────────────────────────────────────────────┤
│ Findings                                   │
├────────────────────────────────────────────┤
│ Next Check / Limitation                    │
├────────────────────────────────────────────┤
│ Aggregation Detail                         │
└────────────────────────────────────────────┘
```

---

# 9. Header Metadata

Compactな1行または2行表示。

例：

```text
2026-08-28 12:20
Log: 10:00–12:00
125,482 requests
Analyzer: Completed
AI: Completed
```

File Name等はSecondary表示。

---

# 10. Parse Warning Banner

Parse Warningがある場合：

```text
⚠ 250行を解析できませんでした
```

Secondary：

```text
100,000行中99,750行を解析しました
```

CTA：

```text
詳細を見る
```

---

# 11. Parse Warning Expand

展開時：

```text
Failed Lines
Warning Codes
Unavailable Fields
Redacted Sample
```

ただしRaw Sensitive Valueは表示しない。

---

# 12. Overall Urgency Component

例：

```text
High
早めの確認をおすすめします

/wp-login.phpへのアクセスと
複数IPからの404集中が確認されています。
```

---

# 13. Urgency Componentで避けること

避ける：

```text
85 / 100
危険度 92%
赤く巨大表示
点滅
```

Urgencyは判断の補助でありScoreではない。

---

# 14. AI Summary Component

推奨：

```text
今回の解析概要

このログでは、WordPressログインパスへのアクセスと、
短時間に複数の404レスポンスが集中しています。

ただしAccess Logだけでは、実際に侵入が成功したかは確認できません。
```

---

# 15. Summary Length

初期表示は短く。

長い場合：

```text
続きを表示
```

で展開する。

---

# 16. Findings Section

Section Title：

```text
今確認したいこと
```

または

```text
確認ポイント
```

Technicalな`Findings`をそのままUI Labelにしなくてもよい。

---

# 17. Finding Card Structure

推奨：

```text
┌───────────────────────────────┐
│ Title                         │
│                               │
│ 確認できたこと                │
│ Observation                   │
│                               │
│ 考えられること                │
│ Interpretation                │
│                               │
│ このログだけでは分からないこと│
│ Limitation                    │
│                               │
│ 次に確認すること              │
│ Next Check                    │
│                               │
│ [関連データを見る]            │
└───────────────────────────────┘
```

---

# 18. Finding Card Visual Separation

Observation：

```text
Neutral / Fact
```

Interpretation：

```text
AI Explanation
```

Limitation：

```text
Muted Warning
```

Next Check：

```text
Action
```

色だけではなくLabel / Icon / Border等も利用する。

---

# 19. Finding Card Collapse

Finding数が多い場合：

```text
Top Findings
```

を展開状態。

下位FindingはCollapseしてもよい。

ただし重要Findingを初期Collapseしない。

---

# 20. Finding Order

AIが返した順序を維持する。

UI側で、

```text
Severity Sort
```

等を追加しない。

---

# 21. Related Data CTA

Finding Card下部：

```text
関連データを見る
```

クリック：

```text
Aggregation SectionへScroll
↓
該当Tabへ切替
↓
対象Row Highlight
```

---

# 22. Row Highlight

Highlightは一時的に行う。

例：

```text
2〜3秒程度
```

またはUserがCloseするまでSubtle Highlight。

Flash Animationは避ける。

---

# 23. Aggregation Tabs

推奨：

```text
Path
Source IP
Status
Method
User-Agent
Time
```

Horizontal Tab。

---

# 24. Aggregation Table Header

Sticky Headerを推奨。

大量RowでもColumn意味を失わない。

---

# 25. Table Density

Desktop業務Toolとして、

```text
Compact
Comfortable
```

の中間。

巨大なRow Heightは避ける。

---

# 26. Path Table

例：

```text
Path
Requests
IPs
Status
Method
First
Last
Known
```

---

# 27. Source IP Table

例：

```text
IP
Requests
Paths
Top Status
Top Path
First
Last
```

---

# 28. Status Table

例：

```text
Status
Requests
Rate
Top Paths
```

---

# 29. Sorting

Table HeaderからSort可能。

初期Sort：

```text
Requests desc
```

等はViewごとに設定。

ただしFindingとの関連表示時はReference優先。

---

# 30. Filtering

MVP Filter：

```text
Search
Status
Method
Known Information
```

大量Filter Panelを最初から作らない。

---

# 31. Search

Path / IP / User-AgentはText Search可能。

SearchはClient-sideかServer-sideかはData Sizeで決定。

ObservationSet Selected GroupsのみならClient-sideでも成立しやすい。

---

# 32. Filter UX

Filter適用中は、

```text
Filter Chips
```

等で状態を明示。

```text
Clear All
```

を用意する。

---

# 33. Table Drill-down

Rowクリック：

```text
Side Panel
```

を推奨。

Page遷移しない。

---

# 34. Path Detail Drawer

表示候補：

```text
Path
Known Information
Request Count
Distinct IP
Status Distribution
Method Distribution
Time Distribution
Sample Queries
Related Findings
```

---

# 35. Source IP Detail Drawer

表示候補：

```text
IP
Request Count
Distinct Paths
Top Paths
Status Distribution
Time Distribution
Related Findings
```

---

# 36. Drawerの利点

```text
Contextを失わない
Tableへ戻りやすい
Findingとの往復が簡単
```

---

# 37. Drawer Width

Desktop：

```text
35〜45%程度
```

を目安。

全画面を覆わない。

---

# 38. AI Chat Layout

Desktop推奨：

```text
Right Drawer
```

Result Contentを残したまま質問できる。

---

# 39. AI Chat Entry

CTA：

```text
この解析について質問する
```

HeaderまたはAI Summary付近。

---

# 40. AI Chat Context Banner

Drawer上部：

```text
このAnalysisのObservationSetと
AI Explanationをもとに回答します
```

と明示する。

---

# 41. AI Chat Question Examples

Empty Chat時：

```text
この404は何を確認すればいい？
このIPのアクセスについて詳しく説明して
500エラーの次の確認先は？
```

例を表示してよい。

---

# 42. AI Chat Restrictions

UI上で、

```text
Raw Log全件をAIが読んでいる
```

ような表現はしない。

---

# 43. AI Chat Citation

可能であればChat回答にも、

```text
関連データ
```

Referenceを表示する。

ObservationSet GroupへのLink。

---

# 44. Free User AI Chat

Freeの場合：

```text
この解析についてさらに質問できます
ProでAI Chatを利用
```

程度のCTA。

Finding内容をBlurして隠す等はしない。

---

# 45. Upload Interaction

Drop Area：

```text
Drag & Drop
または
ファイルを選択
```

---

# 46. File Selected State

表示：

```text
File Name
File Size
Detected / Estimated Format
Remove
```

Format Confidence等は見せなくてもよい。

---

# 47. Upload Validation Error

例：

```text
このファイルは空です
ファイルサイズ上限を超えています
対応形式として読み取れませんでした
```

原因を明確にする。

---

# 48. Analyze Button

File選択前：

```text
Disabled
```

File Valid：

```text
解析を開始
```

---

# 49. Upload Progress

Upload自体：

```text
Uploading
```

Analyzer開始後：

```text
Analysis Processing
```

を分離する。

同じProgress Barで混ぜない。

---

# 50. Processing Screen

Stage表示：

```text
✓ アップロード完了
● ログを解析しています
○ 解析結果を整理
○ AIによる説明を生成
```

---

# 51. Analyzer Partial State

例：

```text
解析は完了しましたが、一部行を読み取れませんでした
```

Resultへ進める。

---

# 52. AI Processing State

Analyzer ResultがReadyなら、

```text
集計結果を見る
```

を先に利用可能にしてもよい。

AI完了まで画面全体をBlockしない。

---

# 53. Empty Analysis State

Project Overview：

```text
まだ解析結果がありません

Access Logをアップロードすると、
確認すべきポイントを整理します。

[Access Logを解析する]
```

---

# 54. Empty Known Information

```text
このProject固有の既知情報はまだありません

例：
/admin
/member/login
/api/internal
```

---

# 55. Error Message Structure

基本：

```text
何が失敗したか
なぜ起きた可能性があるか
何が維持されているか
次にできること
```

---

# 56. Analyzer Fatal Error

例：

```text
ログを解析できませんでした

このファイルから有効なAccess Log行を読み取れませんでした。

ファイル形式を確認して再アップロードしてください。
```

---

# 57. AI Failure

例：

```text
ログ解析は完了しています

AIによる説明を生成できませんでした。
集計結果はそのまま確認できます。

[再試行]
```

---

# 58. Billing Failure

Data Accessを突然失わせない。

例：

```text
お支払い情報を確認できませんでした

現在のProject / Analysis Dataは保持されています。
Billing情報を更新してください。
```

---

# 59. Destructive Action

Delete Buttonは通常CTAと視覚的に分離。

Confirmation Modal：

```text
削除対象
削除されるもの
復元不可
```

を明示する。

---

# 60. Project Delete

より強い確認。

候補：

```text
Project Name入力
```

はMVPでは必須ではないが検討可能。

---

# 61. CTA Hierarchy

Primary：

```text
Access Logを解析する
```

Secondary：

```text
関連データを見る
この解析について質問する
```

Tertiary：

```text
Export
Settings
```

---

# 62. CTA数

1 ScreenにPrimary CTAを複数置きすぎない。

---

# 63. Visual Design Direction

Base：

```text
#101936
```

Accent：

```text
#7DE2FC
```

ただし本文領域は十分なContrastを確保する。

---

# 64. Surface Design

Dark Baseで、

```text
Background
Panel
Raised Panel
Border
```

の3〜4段階程度に抑える。

大量のCard Shadowを使わない。

---

# 65. Borders

Dark UIではShadowよりBorderでGroupを示す方が安定する。

Subtle Borderを活用する。

---

# 66. Typography

役割：

```text
Page Title
Section Title
Body
Metadata
Code / Path / IP
```

Path / IP / UA等はMonospace利用を検討する。

---

# 67. Font Size

巨大Titleを避ける。

業務ToolとしてInformation Densityを優先。

---

# 68. Icon

Iconだけで意味を伝えない。

例：

```text
⚠ + 解析上の注意
```

Label併用。

---

# 69. Animation

使用：

```text
Drawer
Collapse
Loading
Highlight
```

程度。

避ける：

```text
Page Transition Effect
Particle
Star Animation常時
Blink
```

---

# 70. Polaris Motif

星座 / Telescope Motifは、

```text
Loading
Empty State
Logo
Background Detail
```

で使う。

Analysis Resultの核心情報へ装飾を被せない。

---

# 71. Loading Motif

例：

```text
星を結ぶようにStageが進む
```

程度の控えめなBrand表現は可能。

ただしProcessing Stateが分かることを優先。

---

# 72. Accessibility

必須：

```text
Tab Navigation
Visible Focus
Semantic Button
Semantic Table
ARIA Label
Contrast
No Color-only Meaning
Reduced Motion
```

---

# 73. Keyboard Interaction

Desktop：

```text
Tab
Shift + Tab
Enter
Escape
```

で主要操作可能。

Drawer / ModalはEscapeでClose。

---

# 74. Focus Management

Modal / Drawer Open時：

```text
Focus move
Focus trap
Close後return
```

を実装する。

---

# 75. Table Accessibility

```text
thead
th scope
caption / accessible label
sort state
```

を付与する。

---

# 76. Responsive Behavior

Desktop：

```text
Sidebar + Main + Drawer
```

Tablet：

```text
Collapsible Sidebar
Main
Overlay Drawer
```

Mobile：

```text
Top Navigation
Single Column
Bottom Sheet / Fullscreen Detail
```

---

# 77. Mobile Finding

Finding CardはSingle Columnでそのまま読める。

Aggregationは横Scrollまたは簡略View。

---

# 78. Mobile Aggregation

大量Columnは、

```text
Row Summary
↓
Tap
↓
Detail
```

へ変換してよい。

Desktop Tableを無理に縮小しない。

---

# 79. Result Page First View

ユーザーがResultを開いた直後に見える範囲には、

```text
Parse Warning有無
Overall Urgency
AI Summary冒頭
```

を含める。

Aggregation TableをFirst Viewに置かない。

---

# 80. 10秒理解テスト

Result画面を10秒見たユーザーが、

```text
今すぐ確認すべきか
何が起きていそうか
何が確定していないか
```

を説明できることを目標とする。

---

# 81. Finding理解テスト

Finding Cardを見て、

```text
事実
AIの解釈
限界
次Action
```

の違いを説明できること。

---

# 82. Evidence理解テスト

Findingから、

```text
なぜこの説明になったのか
```

をAggregationへ辿れること。

---

# 83. UX Review Checklist

```text
Primary CTAが明確か
Information Hierarchyが崩れていないか
Warningを見落とさないか
AIとAnalyzerの責務がUIでも分かれているか
Pro誘導が不安を煽っていないか
Tableが読めるか
MobileでSummaryが崩れないか
Colorだけに依存していないか
```

---

# 84. UI Component候補

```text
AppShell
Sidebar
PageHeader
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

# 85. MVPで作りすぎないComponent

避ける：

```text
Generic Dashboard Widget System
Generic Card Builder
Generic Workflow Renderer
Generic Graph Engine
Generic Rule UI
```

Polaris固有UIを優先する。

---

# 86. UI State Management

主要State：

```text
currentProject
analysis
analysisStatus
observationSet
aiExplanation
filters
selectedAggregation
drawerState
chatState
```

UI StateとServer Stateを混同しない。

---

# 87. Server State

Serverから取得：

```text
Project
Analysis
ObservationSet
AIExplanation
Subscription
Entitlement
```

Clientで勝手に再判定しない。

---

# 88. Optimistic UI

Billing / Delete / Analysis Start等では慎重にする。

Analyzer開始を成功前提で表示しない。

---

# 89. Polling UX

Processing中：

```text
数秒間隔Polling
```

でStage更新。

Tab非表示時はPolling頻度を落とすことを検討。

---

# 90. AI Streaming

AI Explanation初回生成はStreaming必須ではない。

Structured Resultとして完成後表示でもよい。

AI Chatは将来Streamingを採用可能。

---

# 91. Report Export CTA

Result Header Secondary Action候補：

```text
Export
```

Proのみ。

MVP 1.0でExportを後回しにする場合は非表示。

---

# 92. UI Copy Principle

Avoid：

```text
Threat detected
Attack confirmed
Danger score
Safe
```

Prefer：

```text
確認されています
考えられます
このログだけでは判断できません
次に確認してください
```

---

# 93. Technical Label

Path / IP / Status等はTechnical用語を維持してよい。

ただし補助Labelを付ける。

例：

```text
Source IP
アクセス元IP
```

---

# 94. Japanese First

MVP UIは日本語をPrimaryとする。

English technical labelはSecondaryとして併記可能。

---

# 95. Design Review Order

UI Reviewは、

```text
1 Information Priority
2 Copy
3 Interaction
4 Accessibility
5 Visual Polish
```

の順で行う。

色や装飾から決めない。

---

# 96. Wireframe優先

Visual Design実装前に、

```text
Project List
Project Overview
Upload
Processing
Analysis Result
Known Information
Billing
```

のLow / Mid Fidelity Wireframeを作る。

特にAnalysis Resultは複数案比較する。

---

# 97. Analysis Result比較案

最低でも、

```text
A: Linear Report型
B: Summary + Finding + Detail型
C: Split Pane型
```

を比較し、

```text
理解速度
情報量
根拠確認
AI Chatとの相性
```

で評価する。

---

# 98. 推奨方向

現時点では、

```text
Summary + Finding + Detail
```

型を推奨する。

理由：

```text
判断情報
↓
説明
↓
根拠
```

が自然だからである。

---

# 99. MVP確定事項

1. UIは判断支援を最優先する。
2. Analysis ResultのFirst ViewにParse Warning / Urgency / Summaryを置く。
3. Finding CardでObservation / Interpretation / Limitation / Next Checkを分離する。
4. FindingからAggregationへDrill-downできる。
5. AggregationはTab + Tableを基本とする。
6. Chartは補助とする。
7. Row DetailはDrawerを推奨する。
8. AI ChatはRight Drawerを推奨する。
9. UploadとAnalyzer Processingを同じProgressとして扱わない。
10. AI Processing中でもAnalyzer Resultを利用可能にする。
11. Freeで重要情報を隠さない。
12. Pro CTAは深掘り機能として見せる。
13. Errorは失敗対象ごとに分離する。
14. Dark UIでも可読性を最優先する。
15. 星座モチーフを核心情報へ過剰に使わない。
16. DesktopをPrimaryとする。
17. MobileではSummary / Findings中心に再構成する。
18. Accessibilityを初期設計から含める。
19. UI Copyで断定表現を避ける。
20. Visual Design前にAnalysis Result Wireframeを比較検証する。

---

# 100. 次の設計対象

次は、

```text
23_MVP_Backlog_and_Acceptance_Criteria
```

へ進む前に、

```text
23_Wireframe_Specification
```

を挟むことを推奨する。

理由：

Screen ArchitectureとInteraction Designは定義できたが、

> **実際にどの位置・幅・順序でComponentを配置するか**

を固定してからBacklog化した方が、UI実装時の解釈差を減らせるため。

対象：

```text
Project List Wireframe
Project Overview Wireframe
Upload Wireframe
Processing Wireframe
Analysis Result Wireframe
Known Information Wireframe
Billing Wireframe
Responsive Wireframe
```

特にAnalysis Resultは詳細Wireframeを作る。

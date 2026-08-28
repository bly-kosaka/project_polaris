# Project Polaris
# 21_Screen_Architecture
## 画面構成・情報設計

# 1. 目的

Project PolarisのInformation Architecture、Screen List、Navigation、Project / Analysis Hierarchy、Analysis Result Layout、Information Priority、Loading / Empty / Error State、Free / Pro Boundary、Responsive Policyを定義する。

画面設計は見た目の装飾ではなく、ユーザーがAnalyzer / AIの価値を正しく理解し、判断できるためのProduct Architectureとして扱う。

# 2. 最重要原則

Polarisは「情報量が多いから全部見せる」のではなく、ユーザーの判断順に必要な情報を並べる。

最重要画面はAnalysis Result。価値は「解析したこと」ではなく「今見るべきことが分かったこと」にある。

# 3. Product Information Architecture

```text
Account
├─ Projects
│  ├─ Project
│  │  ├─ Overview
│  │  ├─ Analyses
│  │  └─ Known Information
│  └─ ...
├─ Billing
└─ Account Settings
```

Global Navigationは`Projects / Billing / Account`程度に抑える。

# 4. MVP Screen List

```text
S01 Sign Up
S02 Login
S10 Project List
S11 Project Create
S12 Project Overview
S20 Analysis List
S21 Analysis Upload
S22 Analysis Processing
S23 Analysis Result
S30 Known Information List
S31 Known Information Edit
S40 Billing / Plan
S50 Account Settings
```

AI Chatは独立画面ではなくAnalysis Result内に置く方向を推奨する。

# 5. Project List

目的は案件選択。

表示候補：

```text
Project Name
Last Analysis
Latest Overall Urgency
Latest Analysis Status
Analysis Count
```

Project Listを常時監視Dashboard化しない。Health Score、Security Score、大量Chartは置かない。

# 6. Project Overview

表示候補：

```text
Project Name
Latest Analysis
Latest Overall Urgency
Recent Analyses
Known Information Count
```

主CTAは明確に`Access Logを解析する`とする。

# 7. Analysis List

表示：

```text
Analysis Date
Log Period
Request Count
Analyzer Status
AI Status
Overall Urgency
Parse Warning有無
```

一覧で「どれを見るべきか」「Warningがあるか」「AI Explanationがあるか」が分かることを優先する。

# 8. Analysis Upload

基本UI：

```text
Drop Area
File Select
Supported Log説明
File Size Limit
Privacy Notice
Analyze Button
```

Upload前に短く、

```text
Access Logのみ対応
Raw Logは解析後削除
AIにはRaw Logを送信しない
```

を示す。

Log Format選択、Detection Rule、Security Level等をユーザーへ要求しない。

# 9. Analysis Processing

Percentを無理に出さずStage表示とする。

```text
アップロード完了
↓
ログ解析中
↓
解析結果を整理中
↓
AIによる説明を生成中
↓
完了
```

表示候補：File Name / File Size / Started At / Current Stage。

# 10. Analysis Resultの情報順

基本：

```text
1. 解析状態
2. Parse Warning / Data Limitation
3. Overall Urgency
4. AI Summary
5. Findings
6. Next Check
7. Aggregation Detail
```

重大なParse Warningがある場合はAI Summaryより前に出す。

# 11. Result Header

Compactに表示：

```text
Project Name
Analysis Date
Log Period
Request Count
File Name
Analyzer Status
AI Status
```

Metadataを主役にしない。

# 12. Overall Urgency

`Immediate / High / Normal / Low`をLabel + Icon + Short Description + Reasonで示す。

巨大なScore Cardにはしない。色だけで意味を伝えない。

# 13. AI Summary

「このAnalysisで何が起きているように見えるか」を短時間で理解できる要約にする。

Report全文のような長文を最初から展開しない。

# 14. Findings

最重要コンテンツ。

Finding Cardは、

```text
Title
確認できたこと / Observation
考えられること / Interpretation
このログだけでは分からないこと / Limitation
次に確認すること / Next Check
```

を明確に分ける。

事実と推測を視覚的に混ぜない。

Finding-level Urgencyは持たせず、AIが返した順番を確認優先順として扱う。

# 15. Finding References

Findingから`関連データを見る`でAggregationへ移動できるようにする。

例：

```text
Finding
↓
関連データを見る
↓
Path / Source IP / Status等の該当Row
```

AI ExplanationとAggregationを別世界にしない。

# 16. Next Check

FindingごとのNext Checkに加え、全体として次に確認すべき内容をまとめてもよい。

例：

```text
PHP Error Log
WAF Event
CDN Request
```

# 17. Data Limitation

Technicalな名称だけでなく、UIでは`この解析で分からないこと`や`解析上の注意`も候補とする。

例：

```text
Access Logだけでは500エラーの内部原因は確認できません
250行を解析できなかったため一部Requestが含まれていません
AIには選択されたObservationのみ渡されています
```

# 18. Aggregation Detail

Evidence Layerとして配置する。

主要Tab：

```text
Path
Source IP
Status
Method
User-Agent
Time
```

Source IP × PathはDrill-downでよい。

# 19. Aggregation UI

基本はTable。比較・件数・並び替え・詳細確認に向いているため。

Chartは補助としてTime DistributionやStatus Distribution等に使用する。数値確認手段も残す。

# 20. Path View

```text
Path
Request Count
Distinct IP
Status Distribution
Method Distribution
First Seen
Last Seen
Known Information
```

# 21. Source IP View

```text
Source IP
Request Count
Distinct Path
Status Distribution
Top Paths
First Seen
Last Seen
```

`Attacker / Bot / Human`等の断定分類を表示しない。

# 22. Status / Method / UA / Time

Status：

```text
Status Code
Count
Rate
Top Paths
```

Method：

```text
Method
Count
Top Paths
```

User-Agent：

```text
User-Agent
Count
Distinct IP
Top Paths
```

Timeは1分 / 5分Bucket切替候補。Time SeriesはChart利用可。

# 23. Known Information UI

Project配下で管理。

```text
Path
Match Type
Label
Description
Source
Enabled
```

非技術者向け説明は「このProjectで既知のPathや用途をPolarisに教える設定」とする。

Built-inはRead Only、Project/Userは編集可能。

# 24. AI Chat

Analysis Result内に置く。

候補：

```text
Right Drawer
Bottom Panel
Dedicated Panel
```

独立したChatアプリにはしない。

CTA例：

```text
この解析について質問する
```

Freeでは重要情報を隠さず、AI Chatという深掘り機能の価値としてUpgradeへ繋げる。

# 25. Paywall

避ける：

```text
危険な可能性があります
詳細はProへ
```

Pro CTAは`深掘り / Export / 継続利用`として表示する。

# 26. Billing Screen

```text
Current Plan
Usage
Plan Difference
Upgrade
Cancellation
Billing Portal
```

UsageはTokenではなくAnalysis数、AI Chat使用数、Project数等で見せる。

# 27. Empty State

Project List Empty：

```text
最初のProjectを作成
```

Project Analysis Empty：

```text
Access Logをアップロードして最初の解析を開始
```

# 28. Error State

一括Errorにしない。

```text
Upload Error
Analyzer Error
AI Error
Billing Error
Authentication Error
```

Analyzer Errorでは理由と次Actionを示す。

AI Errorでは`ログ解析は完了しています`を明確にし、Aggregationをそのまま見せる。

# 29. Loading State

`Loading...`だけにせず、Skeleton / Stage表示を使う。

# 30. Information Density

Desktop業務ツールとして一定の情報密度を保つ。

Cardの乱用、余白過多、巨大Typographyで情報を分断しない。

# 31. Visual Direction

既存Brand：

```text
Base #101936
Accent #7DE2FC
星座 / 望遠鏡モチーフ
```

は維持する。

ただし装飾より可読性を優先する。

星座モチーフはBackground Detail / Empty State / Loading / Brand Icon等に限定し、Finding重要度を星の数で表す等は行わない。

# 32. Dark Theme

Dark Baseはブランドと相性がよいが、Table可読性を最優先する。

Contrast、Row、Border、Muted Text、Warning表示を必ず検証する。

# 33. Responsive Policy

Primary Target：

```text
Desktop
↓
Tablet
↓
Mobile
```

MobileはSummary / Urgency / Findings / Next Check閲覧を優先し、大量Aggregation Table編集はDesktop推奨でもよい。

# 34. Desktop Layout

```text
Sidebar
Main Content
Optional Right Panel
```

AI ChatをRight Panelへ出しやすい構成。

# 35. Accessibility

最低限：

```text
Keyboard Navigation
Focus State
Contrast
Semantic Heading
Table Header
必要なARIA
Color-independent Status
```

# 36. Screen Transition

```text
Login
↓
Project List
↓
Project Overview
↓
Upload
↓
Processing
↓
Analysis Result
```

Historyは`Project → Analyses → Past Analysis → Result`。

Known InformationはProject単位で管理する。

# 37. URL候補

```text
/projects
/projects/:projectId
/projects/:projectId/analyses
/projects/:projectId/analyses/new
/projects/:projectId/analyses/:analysisId
/projects/:projectId/known-information
/billing
/account
```

Analysis ResultはDeep Link可能とする。

# 38. Delete / Archive

Analysis Deleteは確認を要求する。

ProjectはArchiveとDeleteを分け、Archived Projectでは新規Analysis不可とする。

# 39. Screen Priority

P0：

```text
Project List
Project Overview
Upload
Processing
Analysis Result
Aggregation
```

P1：

```text
Known Information
Authentication
Billing
Account
```

P2：

```text
AI Chat advanced interaction
Report Export UI
Advanced Filters
```

# 40. 最重要UX検証

実装後に必ず確認する。

```text
初見でUpload開始場所が分かるか
結果画面を10秒見て「今見るべきもの」が分かるか
ObservationとInterpretationの違いが分かるか
Parse Warningを見落とさないか
Aggregationへ根拠確認できるか
AI Failureでも解析結果を理解できるか
Pro CTAが不安を煽っていないか
```

# 41. MVP確定事項

1. 画面設計を機能設計と同等の重要度で扱う。
2. Analysis Resultを最重要画面とする。
3. 情報順はUserの判断順で設計する。
4. Aggregationを最初から主役にしない。
5. AI FindingsをPrimary Contentとする。
6. Observation / Interpretation / Limitation / Next Checkを視覚的に区別する。
7. Parse Warningを目立つ位置へ表示する。
8. Data Limitationを隠さない。
9. AggregationはEvidence Layerとして配置する。
10. FindingからAggregationへDrill-down可能にする方向とする。
11. AI ChatはAnalysis Result内に置く。
12. Proで重要Findingを隠さない。
13. Project ListをMonitoring Dashboard化しない。
14. Upload画面で設定項目を増やしすぎない。
15. ProcessingはStage表示とする。
16. ErrorをAnalyzer / AI / Upload等で分離する。
17. DesktopをPrimary Targetとする。
18. MobileではSummary / Findings閲覧を優先する。
19. Brand表現より可読性を優先する。
20. UI実装前にResult ScreenのWireframe検証を行う。

# 42. 次の設計対象

次は、

```text
22_UI_Interaction_Design
```

を作成する。

21では「何をどこに置くか」を定義した。22ではNavigation Behavior、Layout、Component、Table、Filter、Drawer、Modal、Upload Interaction、Finding Interaction、Aggregation Drill-down、AI Chat Interaction、Warning / Error / CTA / Accessibilityを具体化する。

最重要目標は、

> Analysis Resultを見た瞬間に、何を見るべきか分かること。

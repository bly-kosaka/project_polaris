# Project Polaris
# 12_Architecture_Reconciliation_v2
## 00〜11 全体整合レビュー・MVP仕様確定状況

---

# 1. 目的

本書は、00〜11までの最新版を横断し、Project PolarisのMVP Architectureに残る矛盾・旧概念・未確定事項を整理する。

対象：

```text
00 Product Vision
01 Product Value
02 User Context
03 Incident Workflow
04 Analyzer Architecture（Product Level）
05 Report Structure
06 AI Architecture
07 Analyzer Architecture（Technical）
08 Analyzer Aggregation / ObservationSet
09 AI Explanation
10 Output Presentation
11 Urgency Assessment
```

---

# 2. 現在の正式Pipeline

```text
Access Log
↓
Parser / Normalizer
↓
Exclusion
↓
Aggregation
↓
Known Information Annotation
↓
Candidate Selection
↓
Redaction / Size Control
↓
Reference Resolution
↓
ObservationSet
├─→ Basic UI / Aggregation View
└─→ AI Explanation
      ├─ Summary
      ├─ Findings
      ├─ Interpretation
      ├─ Limitation
      ├─ Next Check
      └─ Overall Urgency
    ↓
Presentation / Report
```

---

# 3. MVP Input Scope

MVPでPolarisが直接解析するInputは**Access Logのみ**とする。

```text
Input
= Access Log
```

MVP解析対象外：

```text
PHP Error Log
Application Log
WordPress Debug Log
Authentication Log
WAF / CDN Event Log
Server Error Log
```

これらはAIが必要に応じて`Next Check`として確認を促す外部情報とする。

異種ログをAccess Log用`ObservationSet`へ混在させない。

---

# 4. Analyzerの正式責務

Analyzerが行う：

```text
Parse
Normalize
Exclusion
Group
Aggregate
Known Information Annotation
Candidate Selection
Redaction
Size Control
Reference Resolution
ObservationSet生成
Parse Warning / Truncation保持
```

Analyzerが行わない：

```text
Attack Detection
Bot Detection
Intent
Severity
Priority
Risk Score
Health Score
Urgency
Incident Pattern判定
Likely Safe判定
Recommendation
Next Action生成
```

---

# 5. AIの正式責務

AIが行う：

```text
Observationの説明
Finding生成
Interpretation
Limitation
Next Check
Overall Urgency
クライアント向け説明
Report文章
保存済みObservationSetに対するChat
```

AIが行わない：

```text
生Access Logの再解析
新しいAggregation
Analyzer Countの補正
見えていないRequestの検出
Error Logを確認済みとする説明
```

---

# 6. Presentationの正式責務

PresentationはAnalyzer / AIの結果を表示する。

UI側で新しく、

```text
Severity
Priority
Risk Score
Health Score
Danger Score
Incident Pattern
```

等を生成しない。

FindingからObservation Referenceへ辿れる構造を維持する。

---

# 7. Overall Urgency

Health Scoreは初期実装では採用しない。

代わりにAIが解析全体について、

```text
Low
Normal
High
Immediate
```

の`Overall Urgency`を生成できる。

意味：

> この解析結果をどの程度早く人が確認した方がよいか

意味しないもの：

```text
攻撃確率
侵害確率
Security Risk
Severity
Priority Score
```

Finding単位Urgencyは持たない。

---

# 8. Known Information

Known InformationはAnalyzer / AI双方で利用できる。

初期Target：

```text
Path
```

Source：

```text
built_in
project
user
```

Priority：

```text
user > project > built_in
```

初期Match：

```text
exact
prefix
```

Known Informationは技術的意味の補助であり、危険度判定ではない。

CMS固有情報はここで保持する。

Analyzer CoreをWordPress専用にしない。

---

# 9. Candidate Selection

AIへ全Aggregation Groupを送らない。

Selection候補：

```text
Known Information一致
Request Count上位
Distinct Source IP上位
Distinct Path上位
4xx件数上位
5xx件数上位
POST件数上位
Response Size上位
Representative Group
```

Selection ReasonはPriorityではない。

総合Weight Scoreを作らない。

Count単独Thresholdによる危険判定を行わない。

---

# 10. 廃止された旧概念

以下は最新版文書内に「不採用・旧設計」として言及される場合があるが、MVPの有効なArchitecture要素ではない。

```text
Detection Rule
DetectionResult
AnalysisResult
AnalysisPriority
AnalysisDisplayGroup
AI Pattern Layer
Health Score
HealthScoreInput
Finding Severity
Finding Priority
Finding Urgency
Immediate Action固定Section
Incident Pattern固定分類
Likely Safe固定分類
Heavy Asset Detection Rule
PromptContextBuilder
Recommendation Engine
```

実装時にこれらを復活させない。

---

# 11. 旧用語が文書内に残っている理由

横断検索では、

```text
Health Score
Priority
Severity
Detection Rule
AnalysisResult
Incident Pattern
Likely Safe
```

等の語が最新版にも存在する。

ただし、その多くは、

```text
旧設計の説明
不採用理由
禁止事項
移行説明
```

として残している。

したがって「文字列が存在すること」自体は矛盾ではない。

今後実装仕様へ落とす際は、現役の型名・Interface名として使用しない。

---

# 12. Parse Warning / Data Limitation

Parse Warningは必須。

ユーザーへ最低限次を開示する。

```text
Total Lines
Parsed Lines
Partial Lines
Failed Lines
Failure Reason
Redacted Sample
```

さらに、

```text
Truncation
Unavailable View
Known Information Failure
Exclusion
Redaction
```

もData Limitationとして確認可能にする。

AIはこれらを無視して断定しない。

---

# 13. Free / Pro

ArchitectureではAI機能の具体的Entitlementを固定しない。

確定している原則：

1. PlanでAnalyzer精度を変えない。
2. 同じInput / Config / Known Informationなら同じObservationSetを生成する。
3. Parse Warning等の解析品質情報をPaywallで隠さない。
4. AIが失敗・未利用でもAnalyzer基本結果を確認できる。
5. AI Summary / Overall Urgency / Findings / Chat / Report ExportのPlan境界はProduct Planで決定する。

---

# 14. 現在の文書間役割

```text
00
Product Vision
なぜ作るか

01
Product Value
何を価値として提供するか

02
User Context
誰がどの状況で使うか

03
Incident Workflow
実務のどこで使うか

04
Analyzer Architecture
Product視点のAnalyzer方針

05
Report Structure
ユーザーへどう見せるか

06
AI Architecture
AI Layer全体設計

07
Analyzer Architecture
Technical Architecture

08
Analyzer Aggregation
ObservationSet / Aggregation詳細

09
AI Explanation
AI Output詳細

10
Output Presentation
UI / Presentation詳細

11
Urgency Assessment
Overall Urgency詳細
```

04と07は重複ではなく、

```text
04 = Product / Concept Level
07 = Technical / Implementation Architecture Level
```

として維持する。

---

# 15. ここまでで確定したMVP Core

```text
Access Log Upload
↓
Deterministic Analyzer
↓
ObservationSet
↓
Basic Aggregation UI

Optional AI
↓
Findings
Overall Urgency
Next Check
```

これがMVPの中心である。

---

# 16. まだ未確定の主要領域

Architecture Coreの次に設計が必要なのは以下。

## A. Product Plan / Entitlement

```text
FreeでAIを何回使えるか
Overall UrgencyをFreeへ出すか
FindingsをFreeへ出すか
AI Chat
履歴
Report Export
```

## B. Project / Analysis Data Model

```text
User
Project / Site
Analysis
Uploaded Log
ObservationSet
AIExplanationResult
Known Information
Analysis History
```

## C. API / Job Architecture

```text
Upload
Analysis Job
Analyzer Execution
AI Execution
Result Retrieval
Retry
Timeout
Status
```

## D. Storage / Retention

```text
Raw Logを保存するか
保存期間
ObservationSet保存期間
AI Result保存期間
削除
再解析
```

## E. Security / Privacy

```text
Access Logの個人情報
IP Address
Query Parameter
Retention
Encryption
Redaction
AI Provider送信範囲
```

## F. Authentication / Billing

```text
Account
Plan
Usage
Payment
Entitlement
```

---

# 17. 次に設計すべきもの

次章では**Product Planから先に決めるより、Data Model / Analysis Lifecycleを先に設計する**ことを推奨する。

理由：

- Free / Proを決めるには何を保存するかが必要
- AI ChatにはAnalysis History / ObservationSet保存が必要
- Report Exportにも保存単位が必要
- 課金単位を決めるにもAnalysisの単位が必要
- Raw Log retentionはSecurity / Costへ直結する

したがって次の設計対象を、

```text
13_Analysis_Data_Model
```

とする。

---

# 18. 13で決めること

```text
Projectとは何か
Analysisとは何か
Uploadとは何か
ObservationSetをどこへ保存するか
AIExplanationResultをどこへ保存するか
Raw Access Logを保存するか
Analysis Status
Analyzer / AIの実行状態
再解析
削除
履歴
Known Informationとの関連
```

このData Modelを決めた後、

```text
14_Analysis_Lifecycle_API
15_Storage_Retention_Security
16_Product_Plan
17_Authentication_Billing
```

へ進む。

---

# 19. 現時点の結論

00〜11のMVP Core Architectureは、以下の原則で整合した。

> **AnalyzerはAccess Logの観測事実を整理する。**

> **AIはそのObservationを説明する。**

> **Presentationは新しい判断を追加せず、根拠とともに表示する。**

> **Error Log等は解析対象ではなく、必要に応じてNext Checkとして案内する。**

> **最終判断はユーザーが行う。**

次は、このArchitectureを実際に永続化・実行できる形へ落とすため、Analysis Data Modelを設計する。

# Project Polaris
# 16_Product_Plan
## プラン・課金境界・利用制限設計

---

# 1. 目的

本書ではProject PolarisのFree / Proにおいて、何を無料で提供し、何を有料価値とし、どこに利用制限を置くかを定義する。

最重要原則：

> **PlanによってAnalyzerの解析精度を変えない。**

Freeだから解析精度を落とす、ProだからDetectionを増やす、という設計にはしない。

---

# 2. Product Planの基本思想

Polarisの入口は、

```text
困ったときにAccess Logを入れる
↓
まず状況を把握する
```

ことである。

FreeでもPolarisのCore Experienceが成立する必要がある。

有料価値は「正しい解析を見られること」ではなく、

```text
より多く使える
継続して使える
深掘りできる
成果物として使える
```

ことに置く。

---

# 3. AnalyzerをPaywallにしない

同じInput / Configuration / Known InformationならFree / Proで同じObservationSetを生成する。

Planで変えてはならないもの：

```text
Parser精度
Aggregation精度
Parse Warning
Data Limitation
Redaction
Observation Selection Logic
Known Information Annotation
```

Analyzer CoreはPlanを知らない。

---

# 4. Freeでも必ず確認できるもの

```text
Analyzer Status
Parse Warning
Data Limitation
Basic Aggregation View
```

Aggregation View例：

```text
Request Count
Status Distribution
Top Paths
Top Source IPs
Method Distribution
User-Agent Distribution
Time Distribution
```

解析品質に関する情報をPaywallで隠さない。

---

# 5. AIを完全Paidにしない

Polarisの差別化は、

> Analyzerが整理した情報をAIが「今見るべきこと」に変換する

ことにある。

AIを完全にProへ閉じると、Freeでは単なるLog Aggregation Toolとしてしか評価できない。

そのためFreeでも一定範囲のAI Explanationを利用可能にする。

---

# 6. Free AI

Freeでも、

```text
AI Summary
Overall Urgency
主要Findings
Next Check
```

を提供する方向とする。

これにより、

```text
Log Upload
↓
Aggregation
↓
AI Explanation
↓
今見るべきことが分かる
```

というCore Experienceを無料で成立させる。

---

# 7. Pro AI

Proでは一度の説明から、その後の調査・報告へ進む機能を中心とする。

```text
AI Chat
追加質問
Finding深掘り
AI Explanation再生成
Report生成
履歴活用
将来のComparison
```

---

# 8. Plan構成

MVPでは増やしすぎず、

```text
Free
Pro
```

の2段階を基本とする。

Business / Teamは利用実績確認後に検討する。

---

# 9. Free Plan

目的：

```text
初回利用
価値理解
軽いインシデント調査
```

提供候補：

```text
Project作成
Access Log Upload
Analyzer
Aggregation View
Parse Warning
Data Limitation
AI Summary
Overall Urgency
主要Findings
Next Check
限定的なAnalysis History
Built-in Known Information
Project Known Information
```

---

# 10. Pro Plan

目的：

```text
継続的なWeb運用
複数案件
深掘り調査
報告
```

提供候補：

```text
Free全機能
Analysis上限拡大
Upload Size上限拡大
Project上限拡大
History拡大
AI Chat
AI Explanation再生成
Report Export
CSV Export
Known Information管理拡張
将来Comparison
```

---

# 11. AI Summary / Overall Urgency

AI SummaryとOverall UrgencyはFreeへ含めることを推奨する。

特にOverall Urgencyは、

> この解析結果をどの程度早く人が確認した方がよいか

を示し、Polarisのターゲットに分かりやすい価値となる。

```text
Low
Normal
High
Immediate
```

Health ScoreやRisk Scoreではない。

---

# 12. Findingsを人工的に分割しない

Freeでも主要Findingsを隠さない。

避ける例：

```text
Finding 1だけ表示
Finding 2以降はPro
```

理由：

- Incident Toolとして不自然
- 重要情報を意図的に隠す
- User Trustを損なう

特にHigh / Immediate相当の内容やData LimitationをPaywallで隠さない。

---

# 13. AI Chat

AI ChatはProの中心機能候補とする。

例：

```text
このIPは何をしていますか？
この404は問題ですか？
この時間帯に何が起きていますか？
次に何を確認すればいいですか？
クライアント向けに説明してください
```

保存済みObservationSet / AIExplanationResultをContextとして利用し、Raw Logは利用しない。

初回Explanationは「Polarisからの説明」、AI Chatは「ユーザー自身の疑問の深掘り」という違いがあり、自然なFree / Pro境界になる。

---

# 14. Report / CSV Export

Report ExportはPro候補。

```text
Markdown
PDF
```

将来：

```text
Client Report
Internal Incident Memo
Maintenance Report
```

へ展開できる。

CSV ExportもPro候補とする。

---

# 15. Analysis History

履歴は継続利用価値になる。

```text
Free
= 最近の少数Analysis

Pro
= より長いHistory
```

ただし極端に短いFree Historyは避ける。

Free上限を超えた場合も、古いAnalysisを勝手に自動削除せず、新規作成制限またはユーザー自身の削除を基本とする。

---

# 16. Raw Log RetentionとPlan

Free / Proとも、

```text
Raw LogはAnalyzer完了後削除
```

を維持する。

PaidだからRaw Logを長期保存する機能はMVPでは追加しない。

Security ScopeとStorage Costを増やす割に、Polarisの中心価値ではないため。

---

# 17. Project Limit

FreeではProject数に上限を持たせられる。

初期候補：

```text
Free: 1〜3 Projects
Pro: 実用上十分な複数Projects
```

具体値はPricing検討で決定する。

---

# 18. Analysis Limit

主要な課金境界候補は、

```text
月間Analysis回数
```

とする。

Analyzer Cost、AI Cost、Storage、利用頻度と比較的連動する。

---

# 19. 「1 Analysis」の定義

課金上、

> **1回のAccess Log UploadからObservationSetを生成する処理**

を1 Analysisとする。

AI Retryは新しいAnalysisとして数えない。

Analyzer再解析は新Upload + 新Analysisなので1回として数える。

---

# 20. Failed AnalysisのCount

Unsupported FormatやEmpty Fileまで課金Usageへ含めるとUXが悪い。

基本的に、

```text
ObservationSetが生成されたAnalysis
```

をUsage Count対象とする。

失敗Uploadには別途Rate Limitを持つ。

---

# 21. AI Usage

Analysisとは別に、

```text
AI Chat
AI Regeneration
```

をAI Usageとして管理できる。

MVPではToken従量課金をUserへ見せない。

内部ではToken Costを計測しても、Product上はAnalysis / AI Chat等の理解しやすい単位を利用する。

---

# 22. Upload Size Limit

Free / ProでUpload Sizeを分けることは可能。

これは解析精度差ではなくInput Size上限である。

具体値はAnalyzer Benchmark / Hosting Cost確認後に決める。

Unlimited Uploadにはしない。

---

# 23. Known Information

Built-in Known Informationは全Planで利用可能。

Project Known Informationも基本利用可能とする方向を推奨する。

Proでは将来、

```text
登録件数上限拡大
Import / Export
共有
Template
```

などを拡張価値にできる。

---

# 24. Comparison / Team / API

ComparisonはMVP Core外。将来Pro候補。

Team機能：

```text
Organization
Team Member
Role
Shared Project
Approval
```

はMVP外。

Public APIもMVP外。

常時監視もPlanに関係なくMVPでは提供しない。

Paid化のためにMonitoring ProductへScopeを広げない。

---

# 25. Feature Matrix

| Feature | Free | Pro |
|---|---:|---:|
| Access Log Analyzer | ○ | ○ |
| Aggregation View | ○ | ○ |
| Parse Warning | ○ | ○ |
| Data Limitation | ○ | ○ |
| AI Summary | ○ | ○ |
| Overall Urgency | ○ | ○ |
| Findings | ○ | ○ |
| Next Check | ○ | ○ |
| Project Known Information | ○ | ○ |
| AI Chat | - | ○ |
| AI Regeneration | Limited / - | ○ |
| Report Export | - | ○ |
| CSV Export | - | ○ |
| Extended History | - | ○ |
| Higher Analysis Limit | - | ○ |
| Higher Upload Limit | - | ○ |
| Comparison | Future | Future / Pro |
| Team | - | Future |
| API | - | Future |

---

# 26. Freeで制限するもの

Freeでは主に「量」を制限する。

```text
Project数
月間Analysis数
Upload Size
History件数
AI再生成
```

解析内容を意図的に欠落させない。

---

# 27. Proで増やすもの

```text
量
継続性
深掘り
成果物
```

具体的には、

```text
Analysis数
Project数
Upload Size
History
AI Chat
Report Export
CSV Export
```

を増やす。

---

# 28. Pricing Model

MVPではMonthly Subscriptionが最も管理しやすい。

ただしPolarisは毎日使うToolではなく、Incident発生時に使う性質が強い。

そのため将来、

```text
Analysis Credit
5 Analysis Pack
20 Analysis Pack
```

等のOne-Time / Credit Modelとの相性も検証する。

MVP公開時はSubscriptionを基本にし、実利用頻度を見てCredit方式を検討する案を推奨する。

---

# 29. Free TrialではなくFree Plan

期間限定Trialにはしない。

Polarisは毎日使うとは限らず、14日Trial中にIncidentが発生しない可能性がある。

継続Free Planを置き、

```text
困った時に思い出して使える
```

状態を維持する。

---

# 30. Free AI Cost Control

FreeでもAI Explanationを提供するためCost Controlが必要。

```text
月間Analysis Limit
ObservationSet Size Limit
AI Output Length Limit
AI Regeneration Limit
AI ChatをPro限定
```

Analyzer精度を落とす必要はない。

---

# 31. Abuse Control

Freeでは特に、

```text
大量Account作成
大量Upload
AI大量実行
```

への対策が必要。

Rate Limit、Email Verification、Usage Counter等を利用する。

---

# 32. Upgrade Trigger

自然なUpgrade Trigger：

```text
もっと解析したい
複数案件で使いたい
AIへ質問したい
履歴を残したい
レポートとして出したい
大きなLogを解析したい
```

避ける：

```text
重要Findingを見るには課金
Immediateの内容を見るには課金
Parse Warningを見るには課金
```

---

# 33. Paywall UI

不安を利用したPaywallを設けない。

避ける例：

```text
危険かもしれません
続きはProで
```

Paid CTAは機能価値を明示する。

```text
この解析についてAIに質問する
Reportとして出力する
より多くのAnalysisを保存する
```

---

# 34. Usage Data Model

```typescript
interface UsageCounter {
  accountId: string;
  period: string;

  analysesCompleted: number;
  aiChatsUsed: number;
  aiRegenerationsUsed: number;
}
```

File SizeやToken等は内部Cost Analysis用に記録可能。

---

# 35. Entitlement Model

Feature判定をUIへHard Codeしない。

```typescript
interface Entitlement {
  maxProjects: number;
  maxAnalysesPerPeriod: number;
  maxUploadBytes: number;
  maxHistoryItems: number;

  aiSummary: boolean;
  aiChat: boolean;
  aiRegeneration: boolean;

  reportExport: boolean;
  csvExport: boolean;
}
```

PlanからEntitlementへ変換する。

---

# 36. Architectureとの分離

Analyzer内部で、

```text
if plan == free
```

を使わない。

Plan判定はApplication / Entitlement Layerで行う。

```text
Upload前
→ File Size Entitlement確認

Analysis作成前
→ Usage確認

AI Chat前
→ AI Chat Entitlement確認
```

---

# 37. Upgrade / Downgrade

Upgrade時に既存Analysisを再解析する必要はない。

ObservationSetは同じなので、既存AnalysisへAI Chat / Report Export等を即時開放できる。

Downgrade時に過去Analysisを突然削除しない。

閲覧範囲や新規作成制限の詳細はBilling設計で決める。

---

# 38. Initial Limit Values

具体的数値は現時点では確定しない。

理由：

```text
Analyzer Benchmark未実施
AI Cost実測不足
Hosting Cost未確定
User利用頻度未検証
```

本章では「何を制限するか」まで確定し、「いくつまで」はBenchmark / Pricing後に決める。

---

# 39. MVP確定事項

1. MVP PlanはFree / Proの2段階を基本とする。
2. Analyzer精度をPlanで変えない。
3. Parse Warning / Data LimitationをPaywallで隠さない。
4. FreeでもAggregation Viewを利用可能とする。
5. FreeでもAI Summaryを提供する方向とする。
6. FreeでもOverall Urgencyを提供する方向とする。
7. Freeでも主要Findings / Next Checkを隠さない。
8. AI ChatをProの中心価値とする。
9. Report ExportをPro候補とする。
10. CSV ExportをPro候補とする。
11. Free / Pro差は主に量・継続性・深掘り・成果物で作る。
12. 月間Analysis数を主要Usage Limit候補とする。
13. ObservationSet生成済みAnalysisをUsage Countの基本単位とする。
14. AI Retryを新Analysisとして数えない。
15. Token数をUser向け課金単位にしない。
16. Upload Size LimitをPlan別に設定可能とする。
17. Built-in Known Informationは全Planで利用可能とする。
18. Project Known Informationも基本機能として扱う方向とする。
19. Raw Log RetentionをPaid特典にしない。
20. 常時監視をPaid化のために追加しない。
21. Freeは期間限定Trialではなく継続Free Planとする。
22. 重要情報を隠してUpgradeを促さない。
23. Entitlement判定をAnalyzer Coreへ入れない。
24. 具体的な回数・容量・価格はBenchmark / Cost確認後に決定する。

---

# 40. Product Position

```text
Free
= 困った時にPolarisのCore Experienceを使える

Pro
= Polarisを実務の調査・保守・報告Toolとして継続利用できる
```

FreeをDemoにしない。

Proを「正しい解析を見るための課金」にしない。

---

# 41. 次の設計対象

次は、

```text
17_Authentication_Billing
```

を設計する。

対象：

```text
Account
Authentication
Email Verification
Session
Project Ownership
Plan
Subscription
Entitlement
Usage Counter
Upgrade
Downgrade
Cancellation
Payment Failure
Account Delete
```

16でProduct Planの境界を定義したため、17ではこれをAccount / Billing Modelへ落とし込む。

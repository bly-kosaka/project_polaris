# Project Polaris
# 10_Output_Presentation
## ユーザー向け出力・表示設計

---

# 1. 目的

本章では、Analyzerが生成した`ObservationSet`と、AIが生成した`AIExplanationResult`を、ユーザーへどのように提示するかを定義する。

Presentation層は解析や意味判断を行わず、解析・説明結果をユーザーが判断しやすい形へ構成する。

```text
Raw Log
  ↓
Analyzer
  ↓
ObservationSet
  ↓
AI
  ↓
AIExplanationResult
  ↓
Presentation
```

---

# 2. 基本思想

最初からIP・Path・Statusの大量一覧を見せるのではなく、まず「今見るべきこと」を提示する。

一方、AI説明だけをブラックボックスとして表示せず、必要に応じて次まで辿れるようにする。

```text
AI Finding
↓
Observation
↓
Aggregation Group / 集計値
```

情報階層は次を基本とする。

```text
Level 1: 解析状態 / Summary
Level 2: 今見るべきこと（Findings）
Level 3: Finding詳細
Level 4: 根拠Observation
Level 5: Aggregation View
```

---

# 3. Top Summary

画面上部では最低限次を表示する。

- 解析期間
- 解析Request数
- Analyzer状態
- 確認の緊急性（Overall Urgency）
- AI Summary
- Data Limitation有無

`success / partial / failed`は内部Enumをそのまま表示せず、例えば次のように表現できる。

```text
success → 解析完了
partial → 一部データに警告あり
failed  → 解析できませんでした
```

`partial`を正常完了と同じ見た目にしない。

---

# 4. Failed Result

Analyzerが`failed`の場合、AI Findingは表示しない。

代わりに解析できなかった理由と確認可能な対処を表示する。

失敗結果から「問題は検出されませんでした」と表示してはならない。

---

# 5. 今見るべきこと

AI Findingを主要コンテンツとして表示する。

Finding Cardの初期表示：

```text
Title
Observation概要
Interpretation概要
Next Check
```

詳細表示：

```text
確認できたこと
考えられること
断定できないこと
次に確認すること
Known Information
根拠Observation
```

Severity / Priority / Critical等のラベルは初期実装では持たせない。

---



# 5.1 確認の緊急性

OverviewではAIが生成した`overallUrgency`を表示する。

```text
確認の緊急性

High
早めの確認を推奨

理由
/api/orderで500レスポンスが集中しており、
サービス処理への影響が考えられるため。
```

Urgencyは危険度ではない。

```text
High = 攻撃の可能性が高い
```

という意味ではなく、

```text
High = 早めに人が確認した方がよい
```

ことを表す。

初期実装では数値Scoreを表示しない。

色だけでLevelを伝えず、必ず「早めに確認」等のText Labelを併用する。

AI Explanationを生成できない場合はUrgencyも`unavailable`として扱い、Analyzer側のCountから代替Scoreを生成しない。

# 6. Findingの順序

FindingにはSeverity / Priorityがないため、UI側でRisk Scoreを生成して並べ替えない。

基本的にはAIが返した順を表示順とする。

AIには「ユーザーが先に確認すべきものから説明する」ことを要求できるが、これは数値Priorityではなく説明上の順序である。

---

# 7. 確認できたこと

`observation`のみを表示する。

例：

```text
同一IPから240件のアクセスがあり、
218種類のPathへアクセスしています。
そのうち220件が404でした。
```

推測を混ぜない。

---

# 8. 考えられること

`interpretation`を表示する。

例：

```text
短時間に多数の異なるPathへアクセスしているため、
自動化されたPath探索のようなアクセスである可能性があります。
```

可能性と断定を区別する。

---

# 9. 断定できないこと

`limitation`を表示する。

例：

```text
アクセスログだけでは、使用されたツールやアクセス目的までは特定できません。
```

この情報は説明可能性を支えるため、単なる小さな注意書きとして隠さない。

---

# 10. 次に確認すること

`nextChecks`を具体的な確認行動として表示する。

基本順序：

```text
確認
↓
追加情報取得
↓
判断
↓
必要なら対応
```

根拠なくIP Block等の強い対応を先頭へ置かない。

---

# 11. Observation Drill-down

Findingの`references`から根拠Groupへ移動できるようにする。

例：

```text
根拠を見る

Path: /wp-login.php
Request Count: 5
Distinct Source IP: 1
Method: GET 1 / POST 4
Status: 200 5
```

ユーザーがAI文章だけを信頼する必要がない構造にする。

---

# 12. Aggregation View

AI Findingとは別にAnalyzer集計を閲覧できる。

初期View：

```text
Path
Source IP
Status
Method
User-Agent
Time
```

`Source IP × Path`は主にDrill-downで使用する。

Aggregation Viewは「異常一覧」ではなく観測データ一覧である。

Request Count、Distinct Path、Distinct IP、4xx、5xx、POST等の集計軸で確認できる。

---

# 13. Known Information表示

Known Information一致Groupには補足情報を表示できる。

```text
/wp-login.php

Known Information
WordPress Login Path
WordPressで一般的にログイン処理に使用されるPath
```

Known InformationをDangerous Labelとして扱わない。

---

# 14. Parse Warning

Parse Warningは必ず確認可能にする。

例：

```text
解析上の注意

100,000行中250行を解析できませんでした。
解析結果は99,750行を基にしています。
```

必要に応じてWarning CodeやRedacted Sampleへ展開できる。

---

# 15. Truncation

ObservationSetが全Groupを含まない場合、その事実を表示する。

```text
Path集計:
10,000 Group中100 GroupをAI説明用に抽出
```

これはAnalyzerが残り9,900 Groupを解析していないという意味ではない。

「集計済みだがAI入力へは100 Groupを選出した」と分かる表現にする。

---

# 16. Data Limitation Panel

次を一か所で確認できるようにする。

```text
Parse Warning
Unavailable View
Known Information Source Failure
Truncation
Redaction Summary
Exclusion Summary
```

目的は、解析結果がどの条件で生成されたかをユーザーが把握できること。

---

# 17. Exclusion / Redaction

Exclusionが存在する場合は除外Request数を確認可能にする。

例：

```text
Health Check Pathによる1,200件を解析対象から除外
```

Redactionについては、

```text
機密情報を含む可能性のあるQuery Parameter値はマスクされています。
```

と説明できる。

Raw Sensitive Valueは表示しない。

---

# 18. Findingが0件の場合

Findingが0件でもAggregation Viewは利用可能にする。

```text
AI Finding: 0
解析Request: 50,000
Path / IP / Status等の集計を見る
```

避ける：

```text
問題ありません
安全です
攻撃はありません
```

代わりに、

```text
今回の解析範囲では、優先して確認すべきFindingは生成されませんでした。
```

とする。

---

# 19. Negative Evidence

ObservationSetに存在しないことを根拠に安全を断定しない。

特にTruncationがある場合、AIは全Groupを見ていない。

必要なら、

```text
今回AnalyzerがAI説明用に選出した範囲では...
```

と限定する。

---

# 20. Health Scoreの扱い

Health Scoreは初期実装では採用しない。

代わりに11_Urgency_Assessmentで定義した`Urgency Assessment`を使用する。

理由：

- Health Scoreは何を測る数値なのかが曖昧
- Severity / Risk Scoreの再導入につながりやすい
- Polarisのターゲットには「今確認すべきか」の方が直接的
- Urgencyならサービス障害とSecurity確認の両方を同じ「確認優先度」として扱える

将来、Urgencyとは異なる目的のHealth指標が必要になった場合のみ独立して再設計する。

# 21. 無料 / 有料

既存Product方針を踏まえ、基本境界は次とする。

無料 / 有料の具体的な機能境界はProduct Plan側で最終決定する。

Presentation設計として保証するのは次の2点である。

```text
PlanによってAnalyzerの解析精度を変えない
解析品質・安全性に関する情報をPaywallで隠さない
```

Overall UrgencyはAI生成情報であるため、無料版へ提供するかどうかはAI利用コストとProduct Planを踏まえて別途決定する。

本章ではArchitecture上の必須Free機能とは定義しない。

同じログ・設定なら同じObservationSetを生成する。

---

# 22. Paywallで隠さない情報

次は解析品質・安全性に関わるためPlanに関係なく表示する。

```text
Parse失敗
解析不能
Data Limitation
Redaction
Exclusion
Truncation
```

---

# 23. AI Explanation Failure

AI API障害等でExplanationを生成できなくても、Analyzerが成功していればAggregation Viewを表示できる。

```text
Analyzer Success
AI Explanation Failed
```

を分離する。

「解析に失敗しました」と一括表示しない。

---

# 24. Presentation State

概念的には次を区別する。

```typescript
type PresentationState =
  | 'analyzer_failed'
  | 'analyzer_partial'
  | 'analyzer_success_ai_failed'
  | 'ready';
```

実装ではAnalyzer StatusとAI Statusを別々に保持してもよい。

---

# 25. Empty / Loading State

解析前：

```text
アクセスログをアップロードすると、
Path・IP・Status等を集計し、
確認すべきポイントを整理します。
```

「AIが攻撃を検出します」とは表現しない。

解析中は必要に応じて、

```text
ログを読み込んでいます
集計しています
説明を生成しています
```

等を表示する。

---

# 26. Explainability

最低限次へ到達できることを要件とする。

```text
Finding
↓
Observation
↓
Group ID / 集計値
```

「なぜこのFindingが表示されたか」を確認できる。

---

# 27. AI文とObservationの不整合

AI文に書かれた数値とReference先Observationが異なる場合、UI側でAI文を正として補正しない。

AI Explanation Errorとして扱う。

将来的にOutput Validationで、

```text
Reference GroupとFinding内数値の整合
```

を検証する。

---

# 28. Report Export

Report Exportを提供する場合も画面と同じ情報構造を使用する。

```text
解析概要
AI Summary
Findings
確認できたこと
考えられること
断定できないこと
次に確認すること
Data Limitation
```

Report専用の解析ロジックを作らない。

Metadataとして、

```text
ObservationSet Version
解析期間
解析Request数
生成日時
```

等を保持できる。

---

# 29. 初期画面構成案

```text
[ Header ]

Project / Analysis

[ Analysis Status ]
解析期間 / Request数 / Warning

[ AI Summary ]

[ 今見るべきこと ]
Finding Card
Finding Card
Finding Card

[ Data Limitation ]
Warning / Truncation

[ 集計を見る ]
Path | IP | Status | Method | UA | Time
```

Finding詳細：

```text
Title

確認できたこと
考えられること
断定できないこと
次に確認すること

[ 根拠を見る ]

Known Information
Aggregation Detail
```

---

# 30. 初期Navigation

候補：

```text
Overview
Findings
Aggregation
Details
```

名称はUI設計時に変更可能。

重要なのは、

```text
AI Explanation
Analyzer Data
Analysis Metadata
```

を混同しないこと。

---

# 31. Presentationで生成しないもの

Presentation層では次を新規生成しない。

```text
Severity
Priority
Risk Score
Attack Type
Intent
Known Information
Aggregation
AI Interpretation
```

既存データを表示構造へ変換するだけとする。

---

# 32. Accessibility / Readability

状態を色だけで伝えない。

例：

```text
一部データに警告あり
```

のText Labelを併用する。

大量の数値を横長Tableだけで提示しない。

---

# 33. Presentation Testing

## Status

- success / partial / failedを正しく表示する
- failedでFindingを表示しない
- AI失敗とAnalyzer失敗を分離する

## Finding

- AI返却順を維持する
- Observation / Interpretation / Limitationを混同しない
- ReferenceからObservationへ辿れる

## Limitation

- Parse Warningを隠さない
- Truncationを表示する
- Unavailable Viewを0件として表示しない
- Exclusion件数を確認できる

## Free / Paid

- Analyzer結果自体をPlanで変更しない
- 解析品質情報をPaywallで隠さない
- Entitlementによる表示制御がAnalyzer結果を変更しない

## Empty / Error

- Finding 0件をアクセス0件と誤表示しない
- failedを「問題なし」と表示しない
- AI障害時にもAggregationを利用できる

---

# 34. 10_Output_Presentation 確定事項

1. Presentationは解析・意味判断を行わない。
2. 最初に「今見るべきこと」を提示する。
3. AI Findingから根拠ObservationへDrill-downできる。
4. Observation / Interpretation / Limitation / Next Checkを分離表示する。
5. Severity / Priority / Risk ScoreをUI側で生成しない。
6. Finding順は基本的にAI返却順を利用する。
7. Aggregation ViewをAI Findingとは別に提供する。
8. Known Informationを危険ラベルとして表示しない。
9. Parse Warningを必ず確認可能にする。
10. Truncationを隠さない。
11. Exclusion / Redaction等の解析条件を確認可能にする。
12. Finding 0件を安全と断定しない。
13. Health Scoreは初期実装では採用せず、Overall Urgencyを使用する。
14. Analyzer失敗とAI失敗を分離する。
15. PlanによってAnalyzerの解析精度を変えない。
16. 解析品質・安全性情報をPaywallで隠さない。
17. Report Exportも同じObservation / Explanation構造を使用する。
18. Presentation層で新しい意味情報を生成しない。

---

# 35. 次の設計対象

10までで、

```text
Analyzer
↓
ObservationSet
↓
AI Explanation
↓
Presentation
```

の主要Pipelineがつながった。

次は既存Product Visionとの整合を確認するため、**Health Scoreの扱いを再検討する**。

現在の設計ではSeverity / Priority / Risk Scoreを意図的に排除しているため、従来構想のHealth Scoreをそのまま残すと思想が衝突する可能性がある。

次章候補：

```text
11_Health_Score
```

まず、

- Health Scoreは本当に必要か
- 何を測るScoreなのか
- Analyzer / AIのどちらが算出するのか
- 危険度Scoreにしない場合、何を表すのか
- 無料版の価値として残すべきか

を実装方法より先に再検討する。

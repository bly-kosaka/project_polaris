# 05. Report Structure

## 1. このドキュメントの目的

このドキュメントでは、Project Polarisにおける解析結果の表示構造、ユーザーが最初に見る情報、AI ExplanationとAnalyzer Aggregationの関係、Data Limitation、無料 / 有料表示の原則、PDF / Markdown出力の考え方を整理する。

詳細なPresentation仕様は`10_Output_Presentation`を正とする。

Project Polarisのレポートは、単なるログ集計一覧ではない。

一方で、Analyzerが判断していない危険度やPatternをUIが新たに生成してもならない。

---

## 2. レポート設計の基本思想

### 2.1 最初に「今見るべきか」を伝える

ユーザーが最初に知りたいのは数値Scoreではない。

AI Explanationを利用できる場合は、

- Overall Urgency
- AI Summary
- Findings

によって、まず確認の緊急性と主要な確認対象を伝える。

AIを利用できない場合でも、

- 解析状態
- Request数
- Parse Warning
- Aggregation View

から調査を進められる構造とする。

---

### 2.2 Health Scoreは採用しない

初期実装ではHealth Scoreを表示しない。

数値Scoreではなく、

```text
Low
Normal
High
Immediate
```

の`Overall Urgency`をAI Explanationとして利用できる。

Overall UrgencyはRisk Scoreではなく、

> この解析結果をどの程度早く人が確認した方がよいか

を示す。

---

### 2.3 AI ExplanationとAnalyzer Dataを分ける

```text
AI Explanation
= Summary / Findings / Overall Urgency / Interpretation / Limitation / Next Check

Analyzer Data
= ObservationSet / Aggregation / Parse / Truncation / Known Information
```

UIは両者を混同しない。

Findingから根拠ObservationへDrill-downできる構造とする。

---

### 2.4 「問題なさそう」は限定表現にする

旧`Likely Safe`のような固定分類はAnalyzerでは生成しない。

AIは必要に応じて、

> 今回Analyzerが選出した範囲では、急ぎの確認要素は少なそうです。

と説明できる。

避ける：

```text
安全です
問題ありません
攻撃はありません
```

---

## 3. MVPの画面階層

```text
Level 1
解析状態 / Overall Urgency / Summary

Level 2
Findings（今見るべきこと）

Level 3
Finding Detail

Level 4
根拠Observation

Level 5
Aggregation View / Analysis Metadata
```

---

## 4. Overview

初期表示候補：

```text
解析期間
解析Request数
Analyzer Status
Overall Urgency（AI利用時）
AI Summary（AI利用時）
Data Limitation有無
```

例：

```text
解析期間
2026/08/21 10:00 - 11:00

解析Request
12,500

解析状態
一部データに警告あり

確認の緊急性
High - 早めの確認を推奨
```

---

## 5. Analyzer Status

```text
success → 解析完了
partial → 一部データに警告あり
failed  → 解析できませんでした
```

`partial`を正常完了と同じ扱いにしない。

`failed`の場合に「問題なし」と表示しない。

---

## 6. Overall Urgency

AIが生成する解析全体の確認緊急性。

```text
Low
Normal
High
Immediate
```

必ずReasonとObservation Referenceを持つ。

Finding単位Urgencyは初期実装では表示しない。

---

## 7. Findings（今見るべきこと）

AI Findingはユーザーが最初に読む主要コンテンツとする。

Finding Card：

```text
Title
Observation概要
Interpretation概要
Next Check
```

Detail：

```text
確認できたこと
考えられること
断定できないこと
次に確認すること
Known Information
根拠Observation
```

Severity / Priority / Critical LabelをUI側で生成しない。

---

## 8. 確認できたこと

ObservationSetから直接確認できるFactだけを表示する。

例：

```text
同一IPから240件のアクセスがあり、
218種類のPathへアクセスしています。
そのうち220件が404でした。
```

---

## 9. 考えられること

AI Interpretationを表示する。

例：

```text
短時間に多数の異なるPathへアクセスしているため、
自動化されたPath探索のようなアクセスである可能性があります。
```

断定と可能性を分離する。

---

## 10. 断定できないこと

AI Limitationを明示する。

例：

```text
Access Logだけでは、
使用されたツールやアクセス目的までは特定できません。
```

これは小さな注意書きとして隠さない。

---

## 11. Next Check

AIがObservationを根拠に、次に確認するものを提示する。

基本順：

```text
同じログ内の関連Observation
Application / CMS Log
Authentication Log
Server Error Log
WAF / CDN / Firewall Log
公開状態・設定
必要なら対処
```

いきなりIP Block等の強い対応を先頭にしない。

---

## 12. Observation Drill-down

FindingのReferenceから、根拠Groupを表示できる。

例：

```text
Path: /wp-login.php
Request Count: 5
Distinct Source IP: 1
Method: GET 1 / POST 4
Status: 200 5
Known Information: WordPress Login Path
```

---

## 13. Aggregation View

AI Findingとは別にAnalyzerのObservationを確認できる。

標準View：

- Path
- Source IP
- Status
- Method
- User-Agent
- Time

`Source IP × Path`は主にDetail / Drill-downで利用する。

Aggregation Viewは異常一覧ではない。

---

## 14. Time / Timeline

旧`Incident Timeline`のようにAnalyzerが「異常開始」を固定判定しない。

Time Viewでは、

- Time Bucket
- Request Count
- Path / IP分布
- Status / Method分布

を表示できる。

AIはFinding説明の中で、

```text
10:00〜10:05に集中
```

などの時系列Contextを説明できる。

必要であればUI上でTimeline表示してよいが、AnalyzerのIncident判定を意味しない。

---

## 15. Known Information

Known Information一致Groupには補足を表示できる。

```text
/wp-login.php

WordPress Login Path
WordPressで一般的にログイン処理に使用されるPath
```

Known InformationをDanger / Warning Labelとして表示しない。

---

## 16. Parse Warning

必ず確認可能にする。

例：

```text
100,000行中250行を解析できませんでした。
解析結果は99,750行を基にしています。
```

Redacted SampleをDetailとして確認できる。

---

## 17. Truncation

AI入力用に省略されたGroup数を表示可能にする。

例：

```text
Path Group:
10,000件を集計
100件をAI説明用ObservationSetへ選出
```

これは残り9,900件をAnalyzerが解析していないという意味ではない。

---

## 18. Exclusion / Redaction

Exclusion：

```text
/healthcheckによる1,200Requestを解析対象から除外
```

Redaction：

```text
Query Parameter内の機密値をマスク済み
```

解析条件として確認可能にする。

---

## 19. Data Limitation Panel

1か所で以下を確認できる。

- Parse Warning
- Partial Parse
- Unavailable / Failed View
- Truncation
- Known Information Source Failure
- Exclusion
- Redaction

ユーザーがExplanationの確実性を判断できるようにする。

---

## 20. Findingが0件の場合

```text
今回の解析範囲では、
AIが優先して説明するFindingは生成されませんでした。
```

と表示できる。

これは、

```text
安全
アクセス0件
異常なし
```

を意味しない。

Aggregation Viewは引き続き確認可能にする。

---

## 21. 旧Sectionの扱い

### Overall Status

固定Status Enum：

```text
Normal / Watch / Warning / Critical
```

は初期実装では採用しない。

Overall Urgencyへ統合する。

### Immediate Action

固定セクション名として必須にしない。

AI Findings + Next Checkで「今見るべきこと」を表現する。

### Incident Pattern

Analyzerの固定Pattern一覧としては廃止する。

AI FindingsでObservationを意味のあるまとまりに説明する。

### Health Score

廃止。

### Category Breakdown

Security / Availability / Performance / SEO / Operationの固定分類は初期必須にしない。

必要性が確認された場合にPresentation上の分類として再検討する。

### Suspicious IP / User-Agent

「Suspicious」という判定名は使わない。

Aggregation Viewとして`Source IP` / `User-Agent`を表示する。

### Heavy Asset Detection

固定Detection SectionではなくPath / Response SizeのAggregationで表現する。

### Likely Safe

固定分類は廃止する。

限定されたAI説明として扱う。

---

## 22. 無料 / 有料

Architectureとして保証するもの：

1. PlanでAnalyzerのObservationSetを変更しない。
2. Parse Warning / Truncation / Exclusion / Redaction等をPaywallで隠さない。
3. AIが利用できなくてもAnalyzer基本結果を表示できる。

AI Summary、Overall Urgency、Findings、Chat、Report Export等をどこまで無料提供するかはProduct Planで確定する。

---

## 23. AI Explanation Failure

AI API等が失敗しても、

```text
Analyzer Success
AI Explanation Failed
```

を分離する。

Aggregation Viewは利用可能。

Analyzer Countから代替Urgency Scoreを生成しない。

---

## 24. Empty / Loading

Empty：

```text
アクセスログをアップロードすると、
Path・IP・Status等を集計し、
確認しやすい形に整理します。
```

Loading：

```text
ログを読み込んでいます
集計しています
説明を生成しています
```

等。

---

## 25. Report Export

PDF / Markdownも画面と同じ構造を利用する。

候補：

1. 解析対象
2. Analyzer Status
3. Overall Urgency（AI利用時）
4. AI Summary（AI利用時）
5. Findings
6. Next Check
7. Data Limitation
8. 主要Aggregation
9. Metadata

Report専用Detectionを作らない。

---

## 26. Client Explanation

AIは同じObservationSet / Findingsを根拠にクライアント向け文章へ言い換える。

重視する内容：

- 観測されたこと
- 考えられること
- 確認できないこと
- サイト影響の可能性
- 次に確認・対応すること

ObservationSetにない事実を追加しない。

---

## 27. Maintenance Hints

インシデント後の保守・改善につなげる機能はProduct Vision上維持する。

ただしAnalyzer固定Recommendationではなく、AI Explanationまたは履歴・比較機能を基に生成する。

例：

- 404の定期確認
- ログイン周辺の保護確認
- 画像配信の改善検討
- エラーログ監視の運用見直し

断定的な自動Recommendationにしない。

---

## 28. UI表示上の注意

- 色だけでUrgencyを伝えない
- English Labelには日本語補足を付けてよい
- AI ExplanationとAnalyzer Dataを視覚的に分離する
- Data Limitationを小さく隠さない
- Countの多さだけを強調色に結びつけない
- Known Information一致を警告アイコン固定にしない

---

## 29. Testing

- Analyzer failedでFindingを表示しない
- AI failedでもAggregationを表示する
- Partial / Truncationを隠さない
- FindingからReferenceへ辿れる
- Observation / Interpretation / Limitationを混同しない
- UIがSeverity / Priority / Health Scoreを生成しない
- Finding 0件を安全と表示しない
- Plan変更でObservationSet内容が変わらない

---

## 30. 確定事項

1. Health Scoreを初期Reportから削除する。
2. Overall Status固定EnumをOverall Urgencyへ置き換える。
3. Immediate ActionはFindings / Next Checkへ統合する。
4. Incident Pattern固定Sectionは廃止する。
5. Likely Safe固定分類は廃止する。
6. Suspicious IP / UAをAggregation Viewへ置き換える。
7. Heavy AssetはDetectionではなくAggregationで扱う。
8. FindingからObservationへDrill-downできる。
9. Data Limitationを必ず確認可能にする。
10. AI失敗とAnalyzer失敗を分離する。
11. 無料 / 有料でAnalyzer精度を変えない。
12. AI機能のEntitlementはProduct Planで確定する。
13. Report Exportも同じObservation / Explanation契約を使用する。

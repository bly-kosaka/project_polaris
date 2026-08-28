# 04. Analyzer Architecture

## 1. このドキュメントの目的

このドキュメントでは、Project PolarisにおけるAnalyzerのProductレベルの設計方針、MVPで扱う集計軸、Known Information、AIとの責務分離、将来拡張を整理する。

詳細な実装Architectureは`07_Analyzer_Architecture`、Aggregation / ObservationSetの詳細は`08_Analyzer_Aggregation`を正とする。

Project PolarisのAnalyzerは、アクセスログから攻撃や危険度を判定するエンジンではない。

大量ログを、

> **人とAIが確認できる、構造化された観測情報へ変換するエンジン**

として設計する。

---

## 2. Analyzer の基本思想

### 2.1 Analyzerは集計し、AIが意味を説明する

正式な責務分離は次とする。

```text
Analyzer
= Parse / Normalize / Group / Aggregate / Compress

AI
= Observationの意味・可能性・限界・Next Checkを説明

User
= 最終判断
```

Analyzerは、

- 何件あったか
- どのPathだったか
- どのIPだったか
- どのStatusだったか
- どのMethodだったか
- どの時間帯だったか
- どのKnown Informationに一致したか

を整理する。

Analyzerは、

- 攻撃である
- Botである
- WordPress探索である
- ブルートフォースである
- 安全である
- High Priorityである

とは判断しない。

---

### 2.2 Countは評価値ではない

単純な件数だけで異常・危険度を決めない。

```text
/.git/config
Count: 1
```

でも確認価値がある可能性がある。

一方、

```text
/assets/main.css
Count: 12,000
```

でも正常アクセスの可能性がある。

CountはObservationの一部としてAIへ渡す。

---

### 2.3 Health Scoreを中心にしない

初期実装ではHealth Scoreを採用しない。

Polarisのターゲットユーザーに必要なのは、精密に見える数値Scoreより、

- 今確認した方がよいか
- 何が観測されているか
- なぜそう考えられるか
- 何がログだけでは分からないか
- 次に何を確認するか

である。

AIを利用する場合は、解析全体に対する`Overall Urgency`を提供できる。

これはRisk Scoreではなく、

> **どの程度早く人が確認した方がよいか**

を示す。

---

### 2.4 専門家向けではなく一次切り分け担当者向け

対象は、

- 中小制作会社のエンジニア兼ディレクター
- Webディレクター
- WordPress運用担当
- 社内Web担当
- 一人情シス
- クライアント対応も行うWeb制作者

などである。

専門監視ツールの代替は目指さない。

---

## 3. Analyzer 全体構成

```text
Uploaded Log
↓
Parser
↓
Normalizer
↓
Exclusion
↓
Aggregation Engine
↓
AggregationSet
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
├─→ Basic UI / Report
└─→ AI Explanation
```

MVPではDetection Rule、Scoring、Recommendation EngineをAnalyzer内部に設けない。

## 3.1 MVPの入力スコープ

MVPでAnalyzerが直接解析するのは**Access Logのみ**とする。

対象例：

```text
Apache access log
Nginx access log
レンタルサーバのAccess Log
必要Fieldを取得できるCDN / Proxy経由Access Log
```

次はMVPのAnalyzer対象外とする。

```text
PHP Error Log
Application Log
WordPress Debug Log
Authentication Log
WAF / CDN独自Event Log
Server Error Log
```

これらはAIが`Next Check`として確認を促す対象になり得るが、Analyzerへ同じInputとして投入しない。

これによりAccess Log用の`ObservationSet`へ異なる意味構造のログを混在させない。


---

## 4. Parser / Normalizer

### 4.1 Parserの役割

Parserはログ行から取得可能な情報を抽出する。

代表Field：

```ts
type ParsedLogEntry = {
  timestamp: string | null;
  sourceIp: string | null;
  method: string | null;
  path: string | null;
  query: string | null;
  status: number | null;
  responseSize: number | null;
  referrer: string | null;
  userAgent: string | null;
  duration?: number | null;
  parseStatus: 'parsed' | 'partial' | 'failed';
};
```

### 4.2 MVPで優先するログ形式

- Apache combined
- Apache common
- Nginx access log
- 一般的なレンタルサーバのアクセスログ
- CDN / Proxy経由ログのうち必要Fieldを取得できる形式

完全な自動判別を目標にしない。

一部行が読めない場合は`partial`として解析可能な範囲を返し、Parse Warningを必ず保持する。

### 4.3 Parser / Normalizerが行わないこと

- 攻撃判定
- Bot判定
- Severity
- Priority
- Scoring
- Recommendation
- AI Explanation

---

## 5. MVPで実装するAggregation View

標準Viewは次の7種類とする。

### 5.1 Path

保持候補：

- Request Count
- Distinct Source IP Count
- Method Distribution
- Status Distribution
- Query Variant Count
- Distinct User-Agent Count
- Response Size
- Time Distribution
- Sample Query / Referrer / UA / IP
- Known Information

### 5.2 Source IP

- Request Count
- Distinct Path Count
- Method Distribution
- Status Distribution
- Distinct User-Agent Count
- Top Paths
- Time Distribution

### 5.3 Source IP × Path

- Request Count
- Query Variant Count
- Method Distribution
- Status Distribution
- Time Distribution
- Path Group Reference
- Source IP Group Reference

### 5.4 Status

- Request Count
- Distinct Path Count
- Distinct Source IP Count
- Top Paths
- Top Source IPs
- Time Distribution

### 5.5 Method

- Request Count
- Distinct Path Count
- Distinct Source IP Count
- Top Paths
- Top Source IPs
- Status Distribution

### 5.6 User-Agent

- Request Count
- Distinct Path Count
- Distinct Source IP Count
- Top Paths
- Status Distribution

### 5.7 Time

- Request Count
- Distinct Path Count
- Distinct Source IP Count
- Method Distribution
- Status Distribution
- Top Paths
- Top Source IPs

初期Time Bucketは1分 / 5分を候補とする。

---

## 6. 「Incident Timeline」はAnalyzerの検出結果にしない

旧設計では、

- 404が増え始めた時刻
- POSTが急増した時刻
- wp-login.phpへの集中開始

などをAnalyzerがIncident Timelineとして検出する想定だった。

現設計では、AnalyzerはTime Bucket / First Seen / Last Seenを保持する。

それらを「何が起きた時系列」として説明するのはAI / Presentation側の責務とする。

---

## 7. 「Incident Pattern」はAnalyzerのRuleにしない

旧設計で想定していた、

- WordPress探索
- wp-login集中
- API探索
- 不審Bot
- Heavy Asset Detection
- SEO異常
- Operation異常

等の固定Pattern Ruleは初期Analyzerに持たせない。

AnalyzerはPath / IP / Status / Method / UA / 時間等を集計する。

意味付けはAIが行う。

---

## 8. Known Information Store

### 8.1 目的

Known Informationは、AnalyzerとAI双方で利用できる既知情報である。

例：

```text
/wp-login.php
/.git/config
/.env
/xmlrpc.php
```

### 8.2 Source

```text
built_in
project
user
```

優先順位：

```text
user > project > built_in
```

### 8.3 初期Match

```text
exact
prefix
```

### 8.4 役割

Known Informationは、

> そのPathが一般的・案件固有に何であるか

を補足する。

危険度、Severity、Priorityを持たない。

### 8.5 初期Dataset

少数の意味が安定した情報から開始する。

大量のExploit URL、CVE辞書、IP Reputation等は初期実装へ入れない。

---

## 9. Candidate Selection

大量のAggregation GroupすべてをAIへ渡さない。

次の観点で候補を選出する。

- Known Information一致
- Request Count
- Distinct Source IP
- Distinct Path
- 4xx Count
- 5xx Count
- POST Count
- Response Size
- Representative

これは重要度Scoreではない。

Selection ReasonをObservationSetに保持する。

---

## 10. 「問題なさそう」の扱い

Analyzerは`Likely Safe`を分類しない。

例えば、

```text
favicon.icoの404が少量
GooglebotらしいUA
GET中心
```

であっても、AnalyzerはObservationを整理するだけである。

AIはObservationSetの範囲で、

```text
今回の観測範囲では急ぎの確認要素は少なそうです
```

と説明できる。

「安全です」と断定しない。

---

## 11. Heavy Asset

旧`Heavy Asset Detection`を独立Ruleにはしない。

Response Sizeがログに存在する場合、

- PathごとのTotal / Average / Max Response Size
- Request Count
- 時間分布

をObservationとして保持できる。

AIはKnown InformationやPath拡張子等を補助に負荷可能性を説明する。

Response Sizeがログに存在しない場合、0として扱わない。

---

## 12. HTTP Method

AnalyzerはMethod Distributionを集計する。

GET / POST / HEAD / OPTIONS / PUT / DELETEの一般的な意味説明はAIまたはKnown Information側で行う。

Analyzerは、

```text
POSTが多い = スパム
OPTIONSが多い = 不審
```

とは判定しない。

---

## 13. Recommendation / Next Check

Recommendation Engineは初期Analyzerに持たせない。

Next CheckはAI Explanationの責務とする。

例：

- Application Error Logを確認
- 認証ログを確認
- WAF / CDNログを確認
- 公開状態を確認
- 不要なアクセスなら制限を検討

AIはObservation / Known Information / Limitationを根拠に提案する。

---

## 14. Overall Urgency

AnalyzerはUrgencyを生成しない。

AIは解析全体に対し、

```text
Low
Normal
High
Immediate
```

のOverall Urgencyを生成できる。

Urgencyは危険度ではなく、人がどの程度早く確認した方がよいかを示す。

Finding単位Urgencyは初期実装では持たない。

---

## 15. ObservationSet

Analyzerの最終成果物は`ObservationSet`である。

主要構造：

```text
Source Summary
Parse Summary
Availability
Path / IP / IP×Path / Status / Method / UA / Time Groups
Known Information
Selection Reasons
References
Truncation
Redaction
Exclusion
```

Analyzerが生成した意味的結論は含めない。

---

## 16. Error Handling

実行状態：

```text
success
partial
failed
```

Partial例：

- 一部Parse失敗
- Known Information Source unavailable
- 一部View生成失敗

Fatal例：

- 全行Parse失敗
- Unsupported Format
- Invalid Configuration
- Redaction Safety Failure
- Aggregation全体失敗

結果の不完全さをユーザーから隠さない。

---

## 17. Performance

MVPではStreaming / Incremental Aggregationを基本とする。

全Parsed Logをメモリへ保持しない。

High Cardinalityに注意するView：

- Path
- Source IP
- Source IP × Path
- User-Agent

Group Guardを持つ。

Guard超過時にSilent Dropしない。

---

## 18. 無料版 / 有料版

Analyzer自体はプランによって精度を変えない。

同じInput / Configuration / Known Informationなら同じObservationSetを生成する。

AI Summary、Overall Urgency、Chat、Report Export等をどのPlanへ提供するかはProduct Planで決定する。

Parse Warning、Truncation、Exclusion、Redaction等の解析品質情報はPaywallで隠さない。

---

## 19. 将来拡張

必要性を確認してから追加する候補：

- Baseline / 過去比較
- WAF Log
- Application Error Log
- Server Error Log
- Cloudflare / CDN固有情報
- ASN / GeoIP
- IP Reputation
- Threat Intelligence
- Known Information対象のUA等への拡張
- Approximate Distinct Count
- Parallel Aggregation

これらをMVPのKnown Information / Analyzer Coreへ先行実装しない。

---

## 20. 確定事項

1. Analyzerは集計・圧縮エンジンとする。
2. Detection Rule層を初期実装では持たない。
3. Health Scoreを初期実装では持たない。
4. Severity / Priority / Risk Scoreを生成しない。
5. ObservationSetを唯一のAnalyzer公開成果物とする。
6. Known InformationをAnalyzer / AI双方で利用可能にする。
7. Known Informationは意味補助であり危険判定ではない。
8. Countは評価値ではない。
9. Incident Pattern / Likely Safe / RecommendationはAnalyzer固定分類にしない。
10. AIがObservationの意味・可能性・Limitation・Next Checkを説明する。
11. Overall UrgencyはAIが生成する。
12. AnalyzerはAI停止時も基本結果を提供できる。
13. PlanでAnalyzer精度を変えない。
14. MVPのAnalyzer入力はAccess Logに限定する。
15. Error Log等はNext Check対象とし、同一ObservationSetへ混在させない。

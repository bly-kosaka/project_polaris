# 03_Incident_Workflow.md

# Incident Workflow

## このドキュメントの目的

Project Polaris は、普段からログを監視するためのツールではありません。

主な利用シーンは、Web制作・運用の現場でトラブルが発生し、担当者が一次切り分けを行う場面です。

このドキュメントでは、インシデント発生から修正・報告までの業務フローを整理し、Project Polaris がどこを支援するのかを定義します。

---

# 前提となるユーザー

対象ユーザーは、Web制作会社や社内Web担当者です。

- 本業は制作・更新・改修
- ログ解析は専門ではない
- ただし、404や500、Botらしきアクセスなどはある程度読める
- トラブル時には自分で一次調査を行う必要がある
- できるだけ早く通常業務へ戻りたい

---

# インシデントの発生例

Project Polaris が想定する入口は、以下のような問い合わせです。

- フォームから大量のスパムが届く
- サイトが妙に重い
- サイトが一時的に落ちた
- 特定ページが404になる
- サーバ会社から負荷の連絡が来た
- 管理画面が重い
- 海外からの不審アクセスが増えている
- PHPエラーが発生している

これらはユーザーがPolarisを利用する「きっかけ」の例であり、Access Logだけで原因を特定できることを意味しません。

---

# 現在の一般的な対応フロー

1. クライアントや社内から連絡が来る
2. サイトの状態を確認する
3. サーバへログインする
4. access.log / error.log を取得する
5. エディタやコマンドでログを確認する
6. IP、ステータス、URL、User-Agentなどを目視で探す
7. 怪しい箇所をChatGPTへ貼り付ける
8. 追加質問をする
9. 原因候補を考える
10. WordPress / PHP / Cloudflare / サーバ設定などを確認する
11. 修正またはブロック対応を行う
12. クライアントへ報告する

このフローでは、調査に時間がかかり、本来の制作業務が止まりやすい。

---

# Project Polaris を使った対応フロー

1. クライアントや社内から連絡が来る
2. サーバから対象ログを取得する
3. Project Polaris で対象サイトを選択する
4. Access Logをアップロードする
5. Parser / Normalizer がログを構造化する
6. Analyzer がPath / IP / Status / Method / User-Agent / 時間帯などを集計する
7. Known Informationを付与し、AIへ渡すObservationを整理する
8. ObservationSetを生成する
9. AIを利用する場合は、ObservationSetからExplanationを生成する
10. Overall UrgencyとFindingsを確認する
11. 必要な追加ログ・設定・サイト状態を確認する
12. 必要な修正・制限・運用対応を行う
13. 必要に応じて報告書やメモへ展開する

重要なのは、

```text
Analyzer
= 観測事実を整理する

AI
= 観測事実の意味・可能性・限界・次の確認事項を説明する

User
= 最終判断する
```

という責務分離です。

---

# Project Polaris が担う範囲

Project Polaris が担うのは、主に以下の範囲です。

## Analyzer

- 大量ログをParse / Normalizeする
- Path / IP / Status / Method / User-Agent / 時間帯などで集計する
- 同一IP × Pathなどの関係を集計する
- Known Informationを付与する
- AIへ渡すObservationを選出・圧縮する
- Parse Warning / Truncation / Exclusion / Redactionを保持する
- ObservationSetを生成する

## AI

- Observationの意味を説明する
- 複数ObservationをFindingとして整理する
- 考えられる状況を説明する
- Access Logだけでは断定できないことを説明する
- 次に確認すべき箇所を提示する
- Overall Urgencyを提示する
- 必要に応じて保守・改善につながるヒントを提示する

Analyzer自身は、攻撃・Bot・異常・安全・Priority・Severityを判定しません。

---

# Project Polaris が担わない範囲

MVPでは以下を行わない。

- SSH / FTP によるログ自動取得
- 常時監視
- リアルタイムアラート
- サーバ設定の自動変更
- Cloudflare / WAF の自動設定
- WordPressやPHPファイルの自動修正
- CPU / メモリなどのサーバ監視
- セッション解析
- ヒートマップ解析
- Access Logだけでは確認できない事実の断定
- 自動IPブロック
- 自動復旧

ユーザーがログを取得し、都度アップロードする前提とする。

---

# レポートで最初に表示すべきもの

AI Explanationを利用できる場合、レポート上部では数値やグラフより先に以下を表示します。

```text
Analyzer Status
Overall Urgency
AI Summary
Findings
Data Limitation
```

Overall Urgencyは、

> この解析結果をどの程度早く人が確認した方がよいか

を示します。

```text
Low
Normal
High
Immediate
```

これはRisk Scoreや攻撃確率ではありません。

AIを利用できない場合でも、AnalyzerのAggregation ViewとData Limitationは確認可能にします。

---

# 「今見るべきこと」の表現

旧設計の`Immediate Action`という固定Sectionは使用しません。

代わりに、

```text
Overall Urgency
+
Findings
+
Next Check
```

によって、「今見るべきこと」と「次に何を確認するか」を表現します。

例：

```text
確認できたこと
14:23〜14:28に404レスポンスが集中しています。

考えられること
同時間帯に1つのSource IPから多数の異なるPathへのアクセスがあり、
自動化されたPath探索のようなアクセスである可能性があります。

断定できないこと
Access Logだけではアクセス目的や使用ツールまでは特定できません。

次に確認すること
該当Source IPとアクセス先Pathを確認し、
必要であればWAF / CDNログと照合してください。
```

---

# Timeline の扱い

時系列情報は重要ですが、Analyzerが「異常が始まった時刻」を意味判断して検出する構造にはしません。

Analyzerは、

- Time Bucket
- Request Count
- Status Distribution
- Method Distribution
- Top Paths
- Top Source IPs
- First Seen
- Last Seen

などをObservationとして保持します。

AIはこれらを基に、

```text
14:23頃から404が増えている
その直前から同一IPによるPathアクセスが増えている
```

などの時系列Contextを説明できます。

UI上でTimelineとして表示しても構いませんが、それはAnalyzerによるIncident判定を意味しません。

---

# Incident Pattern の扱い

旧設計ではAnalyzerが、

```text
WordPress探索
Botアクセス
404急増
500エラー
Heavy Asset
```

などのIncident Patternへ分類する想定でした。

この固定Pattern Layerは初期実装では採用しません。

AnalyzerはObservationを生成し、AIが必要に応じて複数Observationを意味のあるFindingとして説明します。

例えば、

```text
/wp-login.php
/xmlrpc.php
複数の存在しないPHP Path
同一Source IP
404中心
短時間に集中
```

というObservationがあった場合でも、Analyzerは`WordPress探索`とは判定しません。

Known InformationとObservationを受け取ったAIが、

> WordPress関連Pathを含む複数Pathへの自動探索のようなアクセスである可能性があります。

などと説明します。

---

# Known Information

CMSやサービス固有の既知情報は、AnalyzerのDetection RuleではなくKnown Informationとして保持します。

例：

```text
/wp-login.php
WordPressで一般的にログイン処理に使用されるPath

/xmlrpc.php
WordPressでXML-RPC Endpointとして使用されるPath
```

初期Source：

```text
built_in
project
user
```

優先順位：

```text
user > project > built_in
```

Known Informationは、

```text
危険
攻撃
High Priority
```

という判定を持ちません。

CMS固有情報は必要に応じて追加できますが、Analyzer CoreをWordPress専用にはしません。

---

# 「問題なさそう」の扱い

Project Polarisでは、ユーザーが調査対象を絞れることは重要です。

ただしAnalyzerが、

```text
Googlebotだから安全
favicon.icoだから問題なし
少量404だから安全
```

と分類する構造にはしません。

AIはObservationSetの範囲で、

> 今回確認できた範囲では、急ぎの確認を必要とする要素は少なそうです。

などの限定的な説明を行えます。

「安全です」「問題ありません」と断定しません。

---

# Method Explanation

HTTP Methodは初心者にとって読み取りづらいため、PresentationまたはAI Explanationで補足できます。

## GET

通常のページ閲覧や画像取得等で使われます。

## POST

フォーム送信やAPI通信等で使われます。

ただし、

```text
POSTが多い
= フォームスパム
```

とは判定しません。

## HEAD

Header情報のみを取得するRequestです。

## OPTIONS / PUT / DELETE

API等でも利用されるため、存在だけで不審とは判断しません。

AnalyzerはMethod DistributionをObservationとして保持し、その意味説明はAI / Presentation側で行います。

---

# Heavy Asset の扱い

旧`Heavy Asset Detection`は独立Detection Ruleとして実装しません。

Response Sizeを取得できるログでは、

- Path
- Request Count
- Total Response Size
- Average Response Size
- Max Response Size
- Time Distribution

等をAggregationできます。

AIはそのObservationから、配信負荷の可能性や確認事項を説明できます。

Response Sizeがログに存在しない場合は、0として扱わずData Limitationとして扱います。

---

# Report Categories の扱い

旧設計では、

```text
Security
Availability
Performance
SEO
Operation
```

へFindingを固定分類する想定でした。

初期実装では必須分類にしません。

理由：

- 1つのFindingが複数カテゴリへまたがる
- AI Explanationに不要な分類判断を増やす
- Category別Score等へ発展しやすい
- ユーザーが必要としているのは分類より「今見るべきこと」

将来、UI整理上の必要性が確認された場合にPresentation Layerの分類として再検討します。

---

# Free と Pro の関係

PlanによってAnalyzerの解析精度を変えません。

また、

- Parse Warning
- Truncation
- Exclusion
- Redaction
- 利用できなかったAggregation View

などの解析品質情報をPaywallで隠しません。

AI Summary、Overall Urgency、Findings、AI Chat、Report Export、履歴比較などをFree / Proのどちらへ提供するかは、Architectureでは固定せずProduct Planで決定します。

---

# MVPの解析対象

MVPでPolarisが直接解析するログは**Access Logのみ**とする。

```text
Input
= Access Log
```

次のログはMVPの解析対象には含めない。

- PHP Error Log
- Application Log
- WordPress Debug Log
- Authentication Log
- WAF / CDN Log
- Server Error Log

これらは`Next Check`としてユーザーに確認を促す外部情報として扱う。

例えばAccess Logで特定Pathへの500集中が確認された場合、

```text
同時間帯のPHP / Application Error Logを確認してください
```

と案内する。

PolarisがこれらのError Log自体を解析するわけではない。

---

# Design Principle

Project Polaris は、情報を増やすのではなく、不要な情報を減らす。

ユーザーが見たいのは大量のログではなく、

- 今見るべきこと
- 後回しでよいこと
- 何が観測されているか
- 何が断定できないか
- 次に何を確認するか

です。

ただし、これらをAnalyzerが意味判断するのではなく、

```text
Analyzer
→ 観測情報を整理

AI
→ 説明

Presentation
→ 分かりやすく表示
```

という責務分離を維持します。

---

# Core Principle

入口はインシデント対応。

出口は保守・改善。

Project Polaris は、困った時に最初に開き、その後の改善活動につながるツールとして設計します。

そのために、

> **AIがログを解析するのではなく、Analyzerが整理した解析結果をAIが説明する**

という原則を全体Architectureで維持します。

---

# 確定事項

1. Analyzer Coreによる異常判定を行わない。
2. AI Pattern Layerを独立Layerとして持たない。
3. Immediate Action固定Sectionを廃止し、Overall Urgency + Findings + Next Checkへ統合する。
4. Incident TimelineはTime Observationを基にAI / Presentationが説明する。
5. Incident Pattern固定分類を廃止する。
6. Likely Safe固定分類を廃止する。
7. Heavy Asset DetectionをAggregationへ変更する。
8. Report Category固定分類を初期必須にしない。
9. CMS固有情報はKnown Informationで扱う。
10. Analyzer CoreをWordPress専用にしない。
11. PlanによってAnalyzerの解析精度を変えない。
12. AI機能のFree / Pro境界はProduct Planで決定する。
13. Access Logだけで確認できない事実を断定しない。
14. MVPの解析対象はAccess Logのみとし、Error Log等はNext Check対象とする。

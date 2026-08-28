# 08_Analyzer_Aggregation
## Analyzer集計・既知情報付与設計

---

# 1. 目的

本書は、Project Polaris の Analyzer がアクセスログをどのように正規化・グルーピング・集計・圧縮し、AIへ受け渡すかを定義する。

Analyzerはアクセスの意味、危険性、攻撃手法、優先度を判断しない。

Analyzerの目的は、大量のアクセスログを、人間およびAIが確認可能な集計情報へ変換することである。

```text
Access Log
    ↓
Parse / Normalize
    ↓
Grouping / Aggregation
    ↓
Known Information Annotation
    ↓
ObservationSet
    ↓
AI Explanation
```

本設計では、従来検討していたDetection Rule、Observation Rule、Intent、Action、Severity、Priorityによる判定層を設けない。

---

# 2. 基本方針

## 2.1 Analyzerは集計する

Analyzerが行う処理は次に限定する。

- ログのParse
- 値のNormalize
- 複数軸でのGrouping
- Count、Distinct Count、分布などのAggregation
- AIへ渡すデータ量の制御
- Known Informationの付与
- Parse Warningの記録

Analyzerは、集計結果が正常か異常かを判断しない。

---

## 2.2 AIが意味を説明する

AIは、Analyzerが生成した集計結果とKnown Informationを用いて、次を説明する。

- 何が起きているように見えるか
- 一般的にそのPathやUser-Agentが何を意味するか
- 件数が少なくても確認すべき理由
- 件数が多くても正常である可能性
- ログだけでは断定できない事項
- 次に確認すべきログ、設定、画面

AIは生ログ全体を直接解析せず、原則としてObservationSetを入力とする。

---

## 2.3 Countは評価値ではない

Countは観測事実であり、危険度ではない。

```text
/.git/config   Count: 1
```

は1件でも確認対象になり得る。

```text
/assets/main.css   Count: 10,000
```

は件数が多くても正常な可能性がある。

したがって、次の処理は行わない。

- CountによるSeverity決定
- CountによるPriority決定
- CountによるLow / Medium / High分類
- 一律の件数閾値による異常判定

Countは、Path、IP、Method、Status、時間帯、Known Informationなどと合わせてAIが解釈する。

---

# 3. 責務境界

## 3.1 Analyzerの責務

Analyzerはアクセスログから直接確認できる情報を保持する。

- Request Count
- Distinct Source IP Count
- Distinct Path Count
- Distinct User-Agent Count
- Method Distribution
- Status Distribution
- Response Size集計
- Query Variant Count
- Referrer Distribution
- First Seen
- Last Seen
- Time Bucket Distribution
- Parse Warning
- Known Information Match

---

## 3.2 Analyzerが行わないこと

Analyzerは以下を判断しない。

- 認証ポイントであるか
- 管理画面であるか
- 機密ファイルであるか
- WordPressを狙ったアクセスであるか
- ブルートフォースであるか
- スキャンであるか
- 攻撃であるか
- 正常であるか
- 対応優先度

`/wp-login.php` が入力された場合も、AnalyzerはそのPathのアクセス状況を集計するだけである。

ただしKnown Informationに一致する場合、登録済みの説明情報を結果へ付与する。

---

## 3.3 AIの責務

AIは次の順序で説明を生成する。

1. 集計結果から確認できる事実を示す
2. Known Informationを参照して対象の一般的な意味を説明する
3. 考えられる状況を可能性として示す
4. 断定できない内容を明示する
5. 次に確認すべき項目を提示する

AIは、Known Informationに存在しない独自Pathについて断定しない。

---

# 4. Pipeline

```text
Raw Log
    ↓
Log Parser
    ↓
ParsedLogEntry[]
    ↓
Normalizer
    ↓
NormalizedLogEntry[]
    ↓
Aggregation Engine
    ↓
AggregationSet
    ↓
Known Information Annotator
    ↓
ObservationSet
    ↓
AI Explanation
```

---

# 5. ParsedLogEntry

```typescript
interface ParsedLogEntry {
  timestamp: Date | null;
  sourceIp: string | null;
  method: string | null;
  path: string | null;
  query: string | null;
  protocol: string | null;
  status: number | null;
  responseSize: number | null;
  referrer: string | null;
  userAgent: string | null;
  host: string | null;
  requestTimeMs: number | null;
  parseWarnings: ParseWarning[];
}
```

Parserは取得できない項目を推測しない。

欠損値は`null`として保持し、Parse Warningへ理由を記録する。

---

# 6. Normalization

## 6.1 Path Normalization

Path集計ではQuery Stringを分離する。

```text
/search?q=apple
/search?q=orange
```

はPath別集計では次の1Pathとして扱う。

```text
/search
```

Queryの違いは`queryVariantCount`および代表Queryとして保持する。

初期実装では次を行う。

- Query String分離
- Fragment除外
- 空Pathを`/`として補正しない
- URL Decode失敗時は元値保持とWarning記録
- 連続スラッシュは原則として保持
- 大文字小文字を自動統一しない
- 末尾スラッシュを自動統一しない

サーバやアプリケーションによって意味が変わる可能性がある値を、Analyzerが勝手に同一化しないためである。

---

## 6.2 Source IP Normalization

Source IPの取得元はParser設定で明示する。

例：

- Remote Address
- X-Forwarded-Forの先頭
- X-Forwarded-Forの末尾
- CDN固有ヘッダー

複数のIP取得方式を実行時に混在させない。

Source IPを取得できない行を、空文字や`unknown`という単一IPへまとめてはならない。

---

## 6.3 User-Agent Normalization

初期実装ではUser-Agent文字列を原文のまま集計キーとする。

Browser、Bot、Libraryなどへの分類はAnalyzerでは行わない。

Known Informationに一致した場合のみ、登録済み情報を注釈として付与する。

---

# 7. Aggregation Engine

Aggregation Engineは、複数の観点から同じログを集計する。

各集計結果は独立したViewであり、正常・異常の判定結果ではない。

初期実装では次のAggregation Viewを生成する。

```text
Overview
Path Groups
Source IP Groups
Source IP × Path Groups
Status Groups
Method Groups
User-Agent Groups
Time Groups
Parse Summary
```

---

# 8. Overview Aggregation

ログ全体の概要を保持する。

```typescript
interface OverviewAggregation {
  totalRequests: number;
  parsedRequests: number;
  partiallyParsedRequests: number;
  failedRequests: number;
  distinctSourceIps: number;
  distinctPaths: number;
  distinctUserAgents: number;
  firstSeen: Date | null;
  lastSeen: Date | null;
  totalResponseSize: number | null;
  statusDistribution: CountMap<number>;
  methodDistribution: CountMap<string>;
}
```

Overviewはサイト全体の状態を説明する基礎情報であり、Overview単体で異常判定を行わない。

---

# 9. Path Groups

## 9.1 目的

Path別のアクセス状況を集約する。

件数の大小に関係なく、Known Informationに一致するPathをAIへ渡せる構造とする。

---

## 9.2 Group Key

```text
Normalized Path
```

---

## 9.3 Data Structure

```typescript
interface PathAggregation {
  path: string;
  requestCount: number;
  distinctSourceIpCount: number;
  distinctUserAgentCount: number;
  queryVariantCount: number;
  methodDistribution: CountMap<string>;
  statusDistribution: CountMap<number>;
  referrerDistribution: CountMap<string>;
  responseSize: ResponseSizeSummary;
  firstSeen: Date;
  lastSeen: Date;
  timeDistribution: TimeBucketCount[];
  sampleSourceIps: string[];
  sampleQueries: string[];
  knownInformation: KnownInformationMatch[];
}
```

---

## 9.4 AIへの受け渡し

すべてのPathを無制限にAIへ渡さない。

Path Groupは次の集合に分けて抽出する。

- Known Information一致Path
- Request Count上位Path
- Distinct Source IP Count上位Path
- 4xx件数上位Path
- 5xx件数上位Path
- POST件数上位Path
- Response Size合計上位Path
- 初出Pathの代表

同一Pathが複数条件に該当した場合は1件へ統合し、選出理由を複数保持する。

```typescript
interface SelectionReason {
  type:
    | 'known_information'
    | 'request_count'
    | 'distinct_source_ip'
    | 'client_error_count'
    | 'server_error_count'
    | 'post_count'
    | 'response_size'
    | 'first_seen_sample';
  rank?: number;
}
```

ここでの選出は危険度判定ではなく、AI入力へ含めるためのデータ選択である。

---

# 10. Source IP Groups

## 10.1 Group Key

```text
Normalized Source IP
```

## 10.2 Data Structure

```typescript
interface SourceIpAggregation {
  sourceIp: string;
  requestCount: number;
  distinctPathCount: number;
  distinctUserAgentCount: number;
  methodDistribution: CountMap<string>;
  statusDistribution: CountMap<number>;
  responseSize: ResponseSizeSummary;
  firstSeen: Date;
  lastSeen: Date;
  timeDistribution: TimeBucketCount[];
  topPaths: RankedCount<string>[];
  sampleUserAgents: string[];
}
```

Source IP Groupは送信元単位の状況把握に使用する。

Request Countだけで選別せず、次の複数観点からAI入力候補を作成する。

- Request Count上位
- Distinct Path Count上位
- 4xx件数上位
- 5xx件数上位
- POST件数上位
- Known Information一致Pathへのアクセスを含むIP

---

# 11. Source IP × Path Groups

## 11.1 目的

特定の送信元が特定Pathへどの程度アクセスしたかを保持する。

これは、従来の`Concentrated Repeated Path Access Rule`に相当する材料だが、閾値判定やPriority付与は行わない。

---

## 11.2 Group Key

```text
Normalized Source IP × Normalized Path
```

---

## 11.3 Data Structure

```typescript
interface SourceIpPathAggregation {
  sourceIp: string;
  path: string;
  requestCount: number;
  queryVariantCount: number;
  methodDistribution: CountMap<string>;
  statusDistribution: CountMap<number>;
  distinctUserAgentCount: number;
  firstSeen: Date;
  lastSeen: Date;
  timeDistribution: TimeBucketCount[];
  sampleQueries: string[];
  knownInformation: KnownInformationMatch[];
}
```

---

## 11.4 AI入力候補

次の観点ごとに上位を抽出する。

- 同一IP・同一PathのRequest Count
- POST Request Count
- 4xx Request Count
- 5xx Request Count
- Known Information一致

Known Information一致は、Countが1件でも候補から除外しない。

---

# 12. Status Groups

```typescript
interface StatusAggregation {
  status: number;
  requestCount: number;
  distinctPathCount: number;
  distinctSourceIpCount: number;
  topPaths: RankedCount<string>[];
  topSourceIps: RankedCount<string>[];
  firstSeen: Date;
  lastSeen: Date;
  timeDistribution: TimeBucketCount[];
}
```

Status Groupは、404や500などの件数および分布を示す。

404が多いことや500が少ないこと自体を、Analyzerは評価しない。

---

# 13. Method Groups

```typescript
interface MethodAggregation {
  method: string;
  requestCount: number;
  distinctPathCount: number;
  distinctSourceIpCount: number;
  topPaths: RankedCount<string>[];
  statusDistribution: CountMap<number>;
  firstSeen: Date;
  lastSeen: Date;
}
```

未知Methodも削除せず、そのまま集計する。

---

# 14. User-Agent Groups

```typescript
interface UserAgentAggregation {
  userAgent: string;
  requestCount: number;
  distinctSourceIpCount: number;
  distinctPathCount: number;
  methodDistribution: CountMap<string>;
  statusDistribution: CountMap<number>;
  topPaths: RankedCount<string>[];
  firstSeen: Date;
  lastSeen: Date;
  knownInformation: KnownInformationMatch[];
}
```

User-Agentの意味分類はAIが行う。

Known Informationに一般的なBotやLibraryを登録し、補助説明として利用できる。

---

# 15. Time Groups

初期実装では固定時間Bucketを使用する。

```typescript
interface TimeBucketAggregation {
  start: Date;
  end: Date;
  requestCount: number;
  distinctSourceIpCount: number;
  distinctPathCount: number;
  methodDistribution: CountMap<string>;
  statusDistribution: CountMap<number>;
  topPaths: RankedCount<string>[];
  topSourceIps: RankedCount<string>[];
}
```

初期Bucketは次の2種類とする。

- 1分
- 5分

1分は瞬間的な変化、5分は周辺状況の説明に使用する。

Bucket件数による異常判定は行わない。

---

# 16. Known Information Store

## 16.1 目的

Known Information Storeは、Analyzerがログから取得できない既知情報を保持し、AnalyzerとAIの双方へ提供する。

主な目的は次のとおり。

- 一般的なPathの説明を毎回AIに推測させない
- 既知のUser-Agent情報を再利用する
- サイト固有のPath情報を保持する
- AIの推論負荷と入力Tokenを減らす
- 説明の一貫性を高める

Known Informationは判定Ruleではなく、集計結果への注釈である。

---

## 16.2 Scope

```typescript
interface KnownInformationEntry {
  id: string;
  targetType: 'path' | 'path_prefix' | 'user_agent' | 'ip' | 'host';
  matcher: KnownInformationMatcher;
  label: string;
  description: string;
  technology?: string;
  commonPurpose?: string;
  notes?: string[];
  source: 'built_in' | 'project' | 'user';
  enabled: boolean;
  updatedAt: Date;
}
```

初期実装では次を対象とする。

- Exact Path
- Path Prefix
- User-Agent文字列または部分一致

IPとHostはデータ構造上対応可能にするが、Built-inデータは原則として持たない。

---

## 16.3 Matcher

```typescript
interface KnownInformationMatcher {
  matchType: 'exact' | 'prefix' | 'contains';
  value: string;
  caseSensitive: boolean;
}
```

初期実装ではRegexを採用しない。

設定ミス、処理負荷、ReDoS、説明困難性を避けるためである。

---

## 16.4 Built-in例

```yaml
- id: path.wordpress.login
  targetType: path
  matcher:
    matchType: exact
    value: /wp-login.php
    caseSensitive: true
  label: WordPress Login Path
  description: WordPressで一般的にログイン処理に使用されるPathです。
  technology: WordPress
  commonPurpose: Authentication
  source: built_in

- id: path.wordpress.xmlrpc
  targetType: path
  matcher:
    matchType: exact
    value: /xmlrpc.php
    caseSensitive: true
  label: WordPress XML-RPC Path
  description: WordPressのXML-RPC機能で使用されるPathです。
  technology: WordPress
  commonPurpose: Remote API
  source: built_in

- id: path.git.directory
  targetType: path_prefix
  matcher:
    matchType: prefix
    value: /.git/
    caseSensitive: true
  label: Git Metadata Path
  description: Gitの管理情報が配置されることがあるPathです。
  technology: Git
  commonPurpose: Repository Metadata
  source: built_in

- id: path.env.file
  targetType: path
  matcher:
    matchType: exact
    value: /.env
    caseSensitive: true
  label: Environment Configuration File
  description: アプリケーションの環境設定に使用されることがあるファイル名です。
  commonPurpose: Application Configuration
  source: built_in
```

説明は事実に限定し、`危険`、`攻撃`、`悪性`などの評価語を保存しない。

---

## 16.5 Project / User Information

案件固有のPath情報を登録できる。

```yaml
- id: project.customer.login
  targetType: path
  matcher:
    matchType: exact
    value: /members/signin
    caseSensitive: true
  label: 会員ログイン
  description: このサイトの会員ログイン処理で使用するPathです。
  commonPurpose: Authentication
  source: project
```

これにより、AIがサイト固有Pathの意味を推測する必要がなくなる。

---

## 16.6 Priority of Sources

同一対象へ複数情報が一致した場合の優先順位は次とする。

```text
user
    ↓
project
    ↓
built_in
```

下位情報を削除せず、すべての一致を保持できる構造とする。

AI Contextでは最も優先度の高い説明をprimaryとして扱い、その他をsupplementalとして渡す。

---

## 16.7 Analyzerでの利用範囲

AnalyzerはKnown Informationを次にのみ利用する。

- Aggregation結果への注釈
- AI入力候補への選出
- 同一情報の重複排除

AnalyzerはKnown Informationを次に利用しない。

- Severity算出
- Priority算出
- 異常判定
- Count加点
- Rule成立条件

---

# 17. ObservationSet

ObservationSetはAnalyzerからAIへ直接渡す最終成果物であり、AI入力契約そのものである。

ObservationSet生成後に、別の判定・分類・再選別を行う層は設けない。

`AnalysisResult`という名称は、すでに意味判断が完了している印象を与えるため、本設計では`ObservationSet`へ変更する。

```typescript
interface ObservationSet {
  metadata: ObservationMetadata;
  overview: OverviewAggregation;
  pathGroups: SelectedGroup<PathAggregation>[];
  sourceIpGroups: SelectedGroup<SourceIpAggregation>[];
  sourceIpPathGroups: SelectedGroup<SourceIpPathAggregation>[];
  statusGroups: SelectedGroup<StatusAggregation>[];
  methodGroups: SelectedGroup<MethodAggregation>[];
  userAgentGroups: SelectedGroup<UserAgentAggregation>[];
  timeGroups: TimeBucketAggregation[];
  parseSummary: ParseSummary;
  truncation: TruncationSummary;
}
```

---

## 17.1 SelectedGroup

```typescript
interface SelectedGroup<T> {
  value: T;
  selectionReasons: SelectionReason[];
}
```

`selectionReasons`は、なぜAI入力へ含まれたかを示す。

これは重要度や危険度ではない。

---

## 17.2 Metadata

```typescript
interface ObservationMetadata {
  analyzerVersion: string;
  generatedAt: Date;
  logPeriodStart: Date | null;
  logPeriodEnd: Date | null;
  projectId?: string;
  normalizationProfileId: string;
  knownInformationVersion: string;
}
```

---

# 18. ObservationSet Selection / Size Control

## 18.1 目的

ObservationSet Selectionは、集計結果を重要度で評価する処理ではない。

目的は次の2点に限定する。

- AIへ渡す情報量を制御する
- 特定の観点だけに偏らず、異なる特徴を持つGroupを残す

したがって、SelectionではSeverity、Priority、Risk Score、Anomaly Scoreを算出しない。

---

## 18.2 基本原則

Selectionは、各Aggregation Viewから複数の観点で候補を抽出し、重複を統合してObservationSetを構成する。

```text
AggregationSet
    ↓
Viewごとに複数観点で候補抽出
    ↓
同一Groupの重複統合
    ↓
Known Information一致を追加
    ↓
Total Limit適用
    ↓
Truncation Summary生成
    ↓
ObservationSet
```

単一の総合Scoreで全Groupを並べ替える方式は採用しない。

理由は、Count、4xx、5xx、POST、Distinct IPなどを1つの数値へ合成すると、重み付け自体が意味判断になり、Analyzerの責務を越えるためである。

---

## 18.3 Selection Axis

初期実装では、Path Groupを次の観点で個別に抽出する。

- Known Information一致
- Request Count上位
- Distinct Source IP Count上位
- 4xx Request Count上位
- 5xx Request Count上位
- POST Request Count上位
- Response Size合計上位

Source IP Groupは次の観点で抽出する。

- Request Count上位
- Distinct Path Count上位
- 4xx Request Count上位
- 5xx Request Count上位
- POST Request Count上位
- Known Information一致Pathへのアクセスを含むIP

Source IP × Path Groupは次の観点で抽出する。

- Request Count上位
- POST Request Count上位
- 4xx Request Count上位
- 5xx Request Count上位
- Known Information一致

User-Agent Groupは次の観点で抽出する。

- Request Count上位
- Distinct Path Count上位
- Distinct Source IP Count上位
- Known Information一致

Status Group、Method Groupは種類数が通常少ないため、初期実装では原則として全件保持し、Total Limit超過時のみ件数上位で圧縮する。

Time Groupは、ログ期間全体を保持できない場合のみ時間Bucketを間引く。

---

## 18.4 Selection Reason

選出されたGroupは、なぜObservationSetへ含まれたかを保持する。

```typescript
type SelectionReason =
  | { type: 'known_information'; knownInformationIds: string[] }
  | { type: 'request_count'; rank: number }
  | { type: 'distinct_source_ip'; rank: number }
  | { type: 'distinct_path'; rank: number }
  | { type: 'client_error_count'; rank: number }
  | { type: 'server_error_count'; rank: number }
  | { type: 'post_count'; rank: number }
  | { type: 'response_size'; rank: number };
```

`rank`はその観点内での順位であり、重要度順位ではない。

---

## 18.5 重複統合

同一Groupが複数観点で選出された場合、Group本体は1件に統合する。

例：

```text
/wp-login.php

Request Count: 4位
POST Count: 1位
Known Information一致
```

ObservationSetでは1つのPath Groupとして保持し、`selectionReasons`に3つの理由を保持する。

これにより、AIへ同じ集計結果を重複送信しない。

---

## 18.6 Known Informationの扱い

Known Information一致は、通常ランキングとは別枠で扱う。

Countが1件でも候補に残す。

ただし、Known Information一致数が非常に多い場合にObservationSetが膨張するため、無制限には保持しない。

上限超過時は次を保持する。

- 一致Group総数
- 省略Group数
- Known Information ID別一致Group数
- Request Count上位の代表Group
- 省略が発生したことを示すTruncation情報

Known Information一致であること自体を重要度へ変換しない。

---

## 18.7 Default Limits

初期値は次のとおりとする。

```yaml
aiContext:
  pathGroups:
    perReasonLimit: 20
    knownInformationLimit: 40
    totalLimit: 80
  sourceIpGroups:
    perReasonLimit: 20
    totalLimit: 60
  sourceIpPathGroups:
    perReasonLimit: 20
    knownInformationLimit: 40
    totalLimit: 80
  userAgentGroups:
    perReasonLimit: 10
    knownInformationLimit: 20
    totalLimit: 30
  statusGroups:
    totalLimit: 20
  methodGroups:
    totalLimit: 20
  timeBuckets:
    totalLimit: 120
```

これらはDetection閾値ではなく、AI入力サイズ制御値である。

実ログでToken量と情報欠落を検証し、後から調整可能にする。

---

## 18.8 Total Limit適用順序

Total Limitを超えた場合、単純にRequest Count下位から削除しない。

初期実装では次の順序で保持する。

1. Known Information一致Group
2. 各Selection Axisの上位Groupを最低1件ずつ確保
3. まだ容量がある場合、各Selection Axisから順位順に追加
4. 同一Groupは重複カウントしない
5. 上限超過分をTruncation Summaryへ記録

これは重要度順位ではなく、観点の偏りを防ぐための保持順序である。

Known Information枠だけでTotal Limitを超える場合は、Known Information IDごとに代表Groupを最低1件確保し、その後Request Count順で残りを選出する。

---

## 18.9 Time Groupの圧縮

Time Groupは時系列の連続性が重要なため、単純なTop N抽出を行わない。

Bucket数が上限以下なら全件保持する。

上限を超える場合は、初期実装では5分Bucketを優先し、必要に応じて1分Bucketを省略する。

将来、より長期間のログを扱う場合は、1分 / 5分 / 1時間など複数粒度への段階的圧縮を検討する。

---

## 18.10 Truncation Summary

AIには、省略が発生した事実を必ず渡す。

```typescript
interface TruncationSummary {
  applied: boolean;
  omittedPathGroups: number;
  omittedSourceIpGroups: number;
  omittedSourceIpPathGroups: number;
  omittedUserAgentGroups: number;
  omittedTimeBuckets: number;
  knownInformationOmissions: {
    knownInformationId: string;
    omittedGroupCount: number;
  }[];
  reasons: string[];
}
```

AIは、Truncationが発生している場合、ObservationSetを全ログの完全な一覧として説明してはならない。

---

## 18.11 不採用案: Global Selection Score

次のような総合Scoreは採用しない。

```text
score =
  requestCountWeight
  + errorCountWeight
  + postCountWeight
  + knownInformationWeight
```

理由：

- 重みの根拠を定義しにくい
- Countが少ない重要情報を落とす可能性がある
- Analyzerが意味判断へ踏み込む
- Scoreの保守が新しい設計負債になる

ObservationSet Selectionは、意味評価ではなく多観点からの代表抽出として実装する。

---

# 19. Parse Warning

Parse Warningは補助情報ではなく、解析結果の信頼性に直接関わる必須情報である。

```typescript
interface ParseSummary {
  totalLines: number;
  parsedLines: number;
  partiallyParsedLines: number;
  failedLines: number;
  warningCounts: CountMap<string>;
  samples: ParseWarningSample[];
}
```

AIへ次を渡す。

- 読み取れなかった行数
- 一部項目のみ取得できた行数
- Warning種別
- 代表行
- 集計に含められなかった項目

AIは、Parse失敗率が高い場合に集計結果の限界を利用者へ説明する。

Analyzerが独自のConfidence Scoreを算出する必要はない。

---

# 20. Configuration

```typescript
interface AnalyzerConfiguration {
  parser: ParserConfiguration;
  normalization: NormalizationConfiguration;
  aggregation: AggregationConfiguration;
  knownInformation: KnownInformationConfiguration;
  aiContext: AiContextConfiguration;
  sensitiveData: SensitiveDataConfiguration;
}
```

## 20.1 Aggregation Configuration

```typescript
interface AggregationConfiguration {
  timeBucketsMinutes: number[];
  topPathSampleLimit: number;
  topSourceIpSampleLimit: number;
  topQuerySampleLimit: number;
  topReferrerSampleLimit: number;
}
```

Detection閾値やSeverity閾値は持たない。

---

# 21. Sample Data / Sensitive Data Handling

## 21.1 基本方針

ObservationSetへ含めるサンプル値は、AIが集計結果の意味を説明するために必要な最小限に限定する。

Analyzerは生ログの代表行を無制限に保持せず、次の原則に従う。

- 集計値で説明できる情報は集計値を優先する
- サンプル値は代表確認用に限定する
- Query / Referrerなど利用者入力を含み得る値は必要最小限とする
- Known Informationで意味を補える場合は、生値を追加で増やさない
- AIへ渡すサンプル数には明示的な上限を設ける
- サンプル値を重要度判定には使用しない

---

## 21.2 Sample Source IP

Path GroupなどでSource IPの具体値を保持する場合、初期実装では上位または代表値のみを保持する。

```typescript
interface SampleSourceIp {
  value: string;
  requestCount?: number;
}
```

サンプルIPは、同一Pathへどの送信元がアクセスしているかをAIが説明する補助情報である。

全IP一覧をObservationSetへ含めることを目的としない。

---

## 21.3 Query Sample

Query Stringはユーザー入力、検索語、識別子、トークンなどを含む可能性があるため、Path本体とは別に扱う。

Analyzerは次を保持する。

- `queryVariantCount`
- 代表Query
- 同一Queryの出現回数

```typescript
interface QuerySample {
  value: string;
  requestCount: number;
  sanitized: boolean;
}
```

代表Queryは、次の優先順位で選出する。

1. 出現回数上位
2. 互いに異なる形式を持つ代表値
3. Known Informationと関連する場合の代表値

Queryの種類数が多い場合も、全件を保持しない。

---

## 21.4 Referrer Sample

ReferrerもURL全体を無制限に保持しない。

初期実装では、まず以下を集計する。

- Host別Count
- ReferrerなしCount
- 同一Host内の代表URL

AI説明に完全URLが不要な場合はHost情報を優先する。

```typescript
interface ReferrerSample {
  host: string | null;
  value?: string;
  requestCount: number;
  sanitized: boolean;
}
```

---

## 21.5 User-Agent Sample

User-Agentは意味のある識別情報であるため原文を保持できる。

ただし、同一Group内で多数のUser-Agentが存在する場合は次のみを保持する。

- 出現回数上位
- 互いに異なる代表値
- Known Information一致

全User-Agent一覧をAIへ渡さない。

---

## 21.6 Sensitive Parameter Redaction

Query StringやReferrerには、秘密情報や個人情報が含まれる可能性がある。

初期実装から、既知の機密Parameter名をRedaction対象として扱う。

例：

```text
password
passwd
pwd
token
access_token
refresh_token
authorization
api_key
apikey
secret
session
session_id
sid
email
mail
phone
tel
```

Redaction対象Parameterは値を保持せず、キー名のみ残す。

```text
?email=[REDACTED]&token=[REDACTED]
```

RedactionはAI説明前だけでなく、ObservationSet生成時点で実施する。

---

## 21.7 Redaction Configuration

```typescript
interface SensitiveDataConfiguration {
  redactQueryParameters: string[];
  redactReferrerQueryParameters: string[];
  maxQuerySamplesPerGroup: number;
  maxReferrerSamplesPerGroup: number;
  maxUserAgentSamplesPerGroup: number;
  maxSourceIpSamplesPerGroup: number;
}
```

初期値例：

```yaml
sensitiveData:
  redactQueryParameters:
    - password
    - passwd
    - pwd
    - token
    - access_token
    - refresh_token
    - authorization
    - api_key
    - apikey
    - secret
    - session
    - session_id
    - sid
    - email
    - mail
    - phone
    - tel
  redactReferrerQueryParameters: same_as_query
  maxQuerySamplesPerGroup: 5
  maxReferrerSamplesPerGroup: 5
  maxUserAgentSamplesPerGroup: 5
  maxSourceIpSamplesPerGroup: 5
```

この設定は危険判定やSelection Scoreには使用しない。

---

## 21.8 Raw Log Retentionとの分離

ObservationSetに含める情報量と、生ログそのものの保存ポリシーは分離する。

本書で定義するのはAnalyzerからAIへ渡すデータであり、生ログ保存期間、暗号化、削除ポリシーなどはStorage / Security設計側で定義する。

Analyzerは、ObservationSetへ不要な生ログ本文を複製しない。

---

## 21.9 Parse Warning Sampleの例外

Parse Warningでは、なぜParseできなかったかを確認するため代表行が必要になる場合がある。

ただし、その場合も次を守る。

- 代表行数に上限を設ける
- Query / ReferrerのRedactionを適用する
- 読み取り失敗箇所以外の不要情報を極力含めない
- AIへ渡す際に「Parse Warning Sample」であることを明示する

---

## 21.10 不採用案: 生ログ代表行の大量保持

各Groupへ生ログ代表行を複数件ずつ保持する設計は採用しない。

理由：

- ObservationSetが急速に肥大化する
- 集計値と情報が重複する
- QueryやReferrerから不要な機密情報を持ち込む
- AIが個別行に引っ張られ、集計結果より局所的な説明を行う可能性がある

必要な具体値は、構造化されたSample項目として限定的に保持する。

---

# 22. Rejected Designs

## 22.1 Count ThresholdによるDetection Rule

```text
300件以上ならLow
800件以上ならMedium
```

件数と重要性が一致しないため不採用とする。

---

## 22.2 CMS別Rule

WordPress、Joomla、Movable Typeなどの製品ごとにRuleを作成しない。

製品固有情報はKnown Informationで保持し、AIが説明に利用する。

---

## 22.3 Intent / Action層

集計結果をIntentやActionへ再分類すると、AIが行う説明と重複する。

Analyzerでは保持しない。

---

## 22.4 Authentication Endpoint判定

Pathが認証ポイントであるかをAnalyzerが判定しない。

Known Informationに登録済みであれば補助情報を付与し、意味の説明はAIが行う。

---

## 22.5 Known InformationによるPriority加点

`/.env`や`/.git/config`が1件でも重要な場合はあるが、重要度は対象サイトの状態やStatusなどによって異なる。

Analyzerでは加点せず、Known Informationと集計値をAIへ渡す。

---

## 22.6 Observation Rule層

同一Path集中、多数Pathアクセス、5xx集中などを個別Ruleとして成立判定する設計は不採用とする。

必要な材料は各Aggregation Viewですでに保持されるため、別のRule層を設けると同じデータを再分類する処理が増える。

---

# 23. AI Input Contract

## 23.1 基本方針

AIは`ObservationSet`を直接入力として受け取る。

AnalyzerとAIの間に、意味判断を行う追加のBuilderやClassifierは置かない。

```text
Analyzer
    ↓
ObservationSet
    ↓
AI
```

必要なJSON serializationやAPI Requestへの変換はTransport層の責務であり、Analyzerの解析処理には含めない。

---

## 23.2 AIへ必ず渡す情報

AIには最低限、次の情報を渡す。

- ログ全体の期間
- 総Request数
- Parse結果とParse Warning
- 選出済みPath Group
- 選出済みSource IP Group
- 選出済みSource IP × Path Group
- Status Group
- Method Group
- User-Agent Group
- Time Group
- 各GroupのKnown Information
- 各Groupの`selectionReasons`
- Truncation Summary

AIは`selectionReasons`を重要度として扱ってはならない。

`selectionReasons`は、Analyzerがどの観点からそのGroupを入力へ残したかを示す説明用メタデータである。

---

## 23.3 Known Informationの受け渡し

Known Informationは一致した対象のGroup内へ付与した状態で渡す。

AIが別途Known Information Store全体を検索することを、初期実装の必須処理にはしない。

```typescript
interface KnownInformationMatch {
  id: string;
  label: string;
  description: string;
  technology?: string;
  commonPurpose?: string;
  source: 'built_in' | 'project' | 'user';
  isPrimary: boolean;
}
```

これにより、AIは例えば次の入力を受け取れる。

```yaml
path: /wp-login.php
requestCount: 5
knownInformation:
  - id: path.wordpress.login
    label: WordPress Login Path
    description: WordPressで一般的にログイン処理に使用されるPathです。
    technology: WordPress
    commonPurpose: Authentication
    source: built_in
    isPrimary: true
```

AIは、このKnown Informationと実際の集計値を組み合わせて説明する。

---

## 23.4 AIへ渡さないもの

初期実装では、次をObservationSetへ追加しない。

- Analyzerが推定した攻撃種別
- Analyzerが推定したIntent
- Severity
- Priority
- Risk Score
- 危険 / 安全フラグ
- Rule名
- AI向けに生成した結論文

これらをAnalyzer側で生成すると、AIの説明責務と重複するためである。

---

## 23.5 AI説明の根拠追跡

AIが説明に利用したGroupを後から確認できるように、各Aggregation Groupには安定した識別子を持たせる。

```typescript
type ObservationGroupId = string;

interface ObservationReference {
  groupId: ObservationGroupId;
  groupType:
    | 'path'
    | 'source_ip'
    | 'source_ip_path'
    | 'status'
    | 'method'
    | 'user_agent'
    | 'time';
}
```

Group IDは説明内容を表す文字列にせず、ObservationSet内で一意に参照できればよい。

AI出力側では、可能な範囲で説明項目と`groupId`を関連付ける。

これによりユーザーは、AIの説明がどの集計結果を根拠としているか確認できる。

---

## 23.6 AIが説明する際の原則

AIはObservationSetから、次を分けて説明する。

```text
観測事実
    ↓
Known Informationによる既知情報
    ↓
考えられる意味・可能性
    ↓
断定できない事項
    ↓
次に確認すべきこと
```

特に次を禁止する。

- Countだけで攻撃と断定する
- Known Information一致だけで危険と断定する
- ObservationSetに存在しないアクセスを確認したと説明する
- Truncationがある状態で全件確認済みと説明する
- Parse Warningを無視して完全な解析結果として説明する

AIの具体的なPrompt設計はAI Architecture側で定義し、本書では入力契約までを責務とする。

---

# 24. Group Reference / Relation

## 24.1 目的

ObservationSetでは、同じアクセスログをPath、Source IP、Source IP × Path、Status、Method、User-Agent、Timeという複数Viewで集計する。

AIがこれらを横断して説明するために、Group間を参照できる最小限の識別情報を持たせる。

ただしRelationは新しい解析結果ではない。

次の処理は行わない。

- Group同士の意味的な関連判定
- 「同一攻撃」「同一事象」などのクラスタリング
- Relation Scoreの算出
- 関連Groupを使ったPriorityやSeverityの決定
- Analyzerによる因果関係の推定

Relationの目的は、**AIが必要な集計結果を重複なしで参照できること**に限定する。

---

## 24.2 Group ID

ObservationSetへ含める各Groupには`groupId`を付与する。

```typescript
type ObservationGroupId = string;
```

初期実装ではGroup IDに意味を持たせない。

例：

```text
path:000123
ip:000045
ip_path:000982
status:000404
time_5m:000031
```

この形式はデバッグ上の可読性を目的とした例であり、AIが文字列を解釈してはならない。

Group IDに以下を直接埋め込まない。

- 生IPアドレス
- 生Path
- User-Agent全文
- Query String
- Known Informationの意味

これにより、ID生成方式と集計内容を分離する。

---

## 24.3 Referenceの基本方針

Group本体に他Viewの完全なAggregationを埋め込まない。

例えばPath Groupへ関連するSource IP Group全件をネストすると、同じ情報がObservationSet内で大量に重複する。

そのため、関連情報が必要な場合は`groupId`のみを参照する。

```typescript
interface ObservationReference {
  groupId: ObservationGroupId;
  groupType:
    | 'path'
    | 'source_ip'
    | 'source_ip_path'
    | 'status'
    | 'method'
    | 'user_agent'
    | 'time';
}
```

---

## 24.4 初期実装で保持するRelation

Relationは必要な箇所に限定する。

### Source IP × Path → Path / Source IP

`SourceIpPathAggregation`は、構成要素であるPath GroupとSource IP Groupを参照できる。

```typescript
interface SourceIpPathAggregation {
  groupId: ObservationGroupId;
  sourceIp: string;
  path: string;
  pathGroupRef?: ObservationReference;
  sourceIpGroupRef?: ObservationReference;
  requestCount: number;
  queryVariantCount: number;
  methodDistribution: CountMap<string>;
  statusDistribution: CountMap<number>;
  distinctUserAgentCount: number;
  firstSeen: Date;
  lastSeen: Date;
  timeDistribution: TimeBucketCount[];
  sampleQueries: string[];
  knownInformation: KnownInformationMatch[];
}
```

参照先GroupがSelectionによってObservationSetから省略されている場合、Referenceは付与しない。

AnalyzerがReferenceを成立させるためだけに、省略済みGroupを追加復活させてはならない。

---

### Path / Source IP → Source IP × Path

Path GroupやSource IP Groupから、関連する`Source IP × Path` Group全件への逆参照は初期実装では持たない。

理由：

- 関連数が非常に多くなり得る
- ObservationSetサイズを増やす
- `sampleSourceIps`、`topPaths`など既存集計で概要を確認できる
- AIが必要以上にRelationを追跡する構造になる

必要性が確認された場合のみ将来追加する。

---

## 24.5 Time GroupとのRelation

Time GroupからPath GroupやSource IP Groupへの明示的Referenceは初期実装では持たない。

Time Groupはすでに次を保持する。

```text
requestCount
distinctSourceIpCount
distinctPathCount
methodDistribution
statusDistribution
topPaths
topSourceIps
```

初期用途ではこれで時間帯の状況説明に十分である。

「この時間Bucketに含まれる全Path Groupを参照する」といったRelationを作ると、Relation自体が大規模な索引になるため採用しない。

---

## 24.6 Status / Method / User-AgentとのRelation

Status、Method、User-Agent Groupについても、他Viewへの完全なReference一覧は初期実装では持たない。

各Groupが保持する`topPaths`、`topSourceIps`、Distributionなどを利用する。

つまり初期実装では、Relationを汎用Graphとして設計しない。

```text
Observation Graph
```

のような中間構造も作成しない。

---

## 24.7 ReferenceとSelection

ReferenceはSelection後に解決する。

```text
AggregationSet
    ↓
Selection / Size Control
    ↓
Selected Groups確定
    ↓
Group ID付与
    ↓
存在するGroup間のみReference解決
    ↓
ObservationSet
```

Reference解決は意味判断ではなく、ObservationSet内のデータ整合性を作る処理である。

---

## 24.8 AI側での利用

AIはReferenceを、別Viewの根拠情報を確認するために使用できる。

例：

```text
Source IP × Path Group
  /wp-login.php : 120 requests
        ↓ pathGroupRef
Path Group
  /wp-login.php : total 180 requests / 14 source IPs
```

これによりAIは、

```text
特定IPから120件あり、同Path全体では180件・14IPからアクセスされています。
```

という説明を、数値を再集計せず生成できる。

ただしReferenceから「分散攻撃」「ブルートフォース」などの意味をAnalyzerが生成することはない。

---

## 24.9 不採用案: Relation Graph

すべてのAggregation ViewをNode、関連をEdgeとしてGraph化する案は初期実装では採用しない。

理由：

- ObservationSetの構造が深くなる
- Edge生成条件が新しい設計対象になる
- Analyzerの集計責務を越えやすい
- AIが必要とする情報は既存Aggregationと限定的Referenceで表現できる
- 実装・テスト・Token量のすべてが増える

必要性が実ログ検証で確認されるまでは追加しない。

---

## 24.10 確定事項

1. Group IDはObservationSet内の参照識別子として使用する。
2. Group ID自体に解析上の意味を持たせない。
3. Group間Relationは最小限にする。
4. 初期実装では`Source IP × Path → Path / Source IP`の参照のみを持つ。
5. 逆参照一覧は持たない。
6. Time / Status / Method / User-Agentからの汎用Relationは持たない。
7. ReferenceはSelection後、ObservationSetへ残ったGroup間だけで解決する。
8. Reference成立のために省略Groupを復活させない。
9. Relation Graphは作成しない。
10. Relationを異常判定・攻撃分類・Priority算出には使用しない。

---

# 25. AI Context Builderを独立させない理由

当初は次の構造を検討した。

```text
ObservationSet
    ↓
AI Context Builder
    ↓
AI
```

しかしObservationSet自体がすでに、

- Aggregation済み
- AI入力候補選出済み
- Known Information付与済み
- サイズ制御済み
- Truncation情報付与済み

のデータである。

その後にContext Builderを置くと、再選別・再分類・再要約が発生しやすく、責務が重複する。

そのため初期設計では採用しない。

必要なのはObservationSetをAPI Requestへ変換する薄いSerializerのみであり、これは解析層ではなくTransport層として扱う。

---

# 26. Testing

## 26.1 Aggregation Accuracy

- Path別件数が正しい
- Query違いが同一Pathへ集約される
- Query Variant Countが正しい
- Source IP × Path件数が正しい
- Method / Status分布が正しい
- First Seen / Last Seenが正しい
- 1分 / 5分Bucketが正しい

## 26.2 Known Information

- Exact一致
- Prefix一致
- Contains一致
- Case Sensitive設定
- user > project > built_inの優先順位
- Count 1件でも一致PathがAI入力候補に含まれる
- 無効化Entryが付与されない

## 26.3 Context Selection

- 観点別上位が正しく選出される
- 同一Groupの重複が統合される
- Selection Reasonが複数保持される
- Total Limitが機能する
- 省略件数がTruncation Summaryへ記録される
- Known Information枠の上限超過が記録される

## 26.4 Parse Warning

- 欠損項目が誤補完されない
- failed / partialが正しく分離される
- Warning Sampleが上限内で保持される
- 集計対象外となった理由を確認できる

## 26.5 Sample / Sensitive Data

- Query Sampleが設定上限を超えない
- Referrer Sampleが設定上限を超えない
- User-Agent / Source IP Sampleが設定上限を超えない
- 機密Parameter値がObservationSetへ残らない
- Referrer Queryにも同じRedactionが適用される
- Redaction後もParameter名と出現状況を確認できる
- Parse Warning SampleにもRedactionが適用される
- 生ログ本文が通常Groupへ複製されない

---

# 27. 現時点のAnalyzer責務

Analyzerの責務を最終的に次へ限定する。

```text
1. Parse
2. Normalize
3. Group
4. Aggregate
5. Known Information Annotation
6. AI入力候補の選出
7. Size Control
8. Parse / Truncation情報の保持
9. ObservationSet生成
```

Analyzerは「何が危険か」「何が攻撃か」を決めない。

Analyzerは、AIが大量の生ログを読む必要がない状態まで、観測情報を整理する。

---

# 28. 確定事項

1. Analyzerは異常・攻撃・Priorityを判定しない。
2. Analyzerはログを正規化・グルーピング・集計・圧縮する。
3. Countは評価値ではなく観測事実である。
4. CountによるLow / Medium / High分類は行わない。
5. Detection Rule / Observation Rule層は設けない。
6. Analyzerの最終成果物はObservationSetとする。
7. Path、IP、IP × Path、Status、Method、User-Agent、時間の各Viewを生成する。
8. Known Informationは初期実装から搭載する。
9. Known InformationはAnalyzerとAIの双方が参照できる。
10. Known Informationは集計結果への注釈とAI入力候補選出にのみ利用する。
11. `/wp-login.php`などの一般的なPathはBuilt-in情報として登録可能にする。
12. 案件固有PathはProject / User情報として追加可能にする。
13. Known Information一致はCountが少なくてもAI入力候補から除外しない。
14. AIへ全ログ・全Groupを渡さず、観点別に代表Groupを選出する。
15. AI入力の省略状況はTruncation Summaryとして明示する。
16. Parse Warningは必須出力とする。
17. 集計結果の意味、可能性、確認事項はAIが説明する。

---
18. Group間参照はObservationSet内の軽量なReferenceに限定する。
19. 初期実装ではSource IP × PathからPath / Source IPへの参照のみを持つ。
20. Relation Graphは作成しない。
21. サンプル値はAI説明に必要な最小限のみ保持する。
22. Query / Referrerの既知機密ParameterはObservationSet生成時点でRedactionする。
23. Sample数はGroupごとに明示的な上限を持つ。
24. 生ログ保存ポリシーとObservationSetのデータ保持は分離する。


# 29. 次の設計対象

次は、ここまで定義したAggregation / Selection / Known Information / Redactionが、実際にどのような`ObservationSet`を生成するかを代表ケースで確認する。

目的は新しい判定層を追加することではなく、データ構造の不足・重複・Token肥大化を設計段階で確認することである。

初期ケースは次を対象とする。

- `/wp-login.php` 少数アクセス + Known Information一致
- `/.git/config` 1件 + Known Information一致
- 特定Pathへの大量アクセス
- 同一IPから多数Pathへのアクセス
- 404が多数発生しているログ
- 5xxが少数だが特定Pathへ集中しているログ
- QueryにToken / Email等を含むログ
- Parse Warningを含むログ
- Group数がTotal Limitを超えTruncationが発生するログ

各ケースについて、

```text
Raw / Parsed情報
    ↓
AggregationSet
    ↓
Known Information Annotation
    ↓
Selection
    ↓
Redaction
    ↓
ObservationSet
```

の形で確認する。

この検証で不要な項目や不足する集計値が見つかった場合は、ObservationSetのInterfaceへ反映する。


# 30. Representative Case Validation

## 30.1 目的

ここまで定義したAnalyzer構造が、実際のログケースをAIへ説明可能な形まで圧縮できるか確認する。

この検証では新しい判定ロジックを追加しない。

確認対象は次の3点とする。

1. AIが説明するために必要な観測事実が残ること
2. Countが少ない既知情報を取りこぼさないこと
3. Countが多いだけのGroupを危険と評価しないこと

---

## 30.2 Case A: `/wp-login.php` 少数アクセス

### Input

```text
10:00:01 203.0.113.10 GET  /wp-login.php 200
10:01:12 203.0.113.10 POST /wp-login.php 200
10:02:30 203.0.113.10 POST /wp-login.php 200
10:03:40 203.0.113.10 POST /wp-login.php 200
10:04:52 203.0.113.10 POST /wp-login.php 200
```

### Aggregation

```yaml
path: /wp-login.php
requestCount: 5
distinctSourceIpCount: 1
methodDistribution:
  GET: 1
  POST: 4
statusDistribution:
  200: 5
```

### Known Information

```yaml
knownInformation:
  - label: WordPress Login Path
    technology: WordPress
    commonPurpose: Authentication
    source: built_in
```

### Selection

Count上位に入らなくても`known_information`によりObservationSetへ残す。

### AIへ渡せる事実

- `/wp-login.php`へ5件
- 1 IPからアクセス
- POSTが4件
- WordPressで一般的にログイン処理に使用されるPath

Analyzerはログイン試行・ブルートフォース等とは判定しない。

---

## 30.3 Case B: `/.git/config` 1件

### Input

```text
10:12:03 198.51.100.8 GET /.git/config 404
```

### Observation

```yaml
path: /.git/config
requestCount: 1
distinctSourceIpCount: 1
statusDistribution:
  404: 1
knownInformation:
  - label: Git Repository Configuration
    commonPurpose: Git repository metadata
    source: built_in
selectionReasons:
  - known_information
```

1件でもKnown Information一致のため残す。

ここではCountによる足切りを行わないことが重要である。

---

## 30.4 Case C: 特定Pathへの大量アクセス

### Input概要

```text
/assets/main.css
requestCount: 12000
distinctSourceIpCount: 3800
status: 200中心
```

### Observation

Request Count上位としてObservationSetへ残る。

ただしAnalyzerは、

```text
大量アクセス = 異常
```

とは評価しない。

Known Informationがなければ、AIはPath名、Status、IP分布、時間分布等の観測情報から説明する。

このケースにより、CountはSelectionには利用できるが意味評価には利用しないことを確認する。

---

## 30.5 Case D: 同一IPから多数Path

### Input概要

```text
sourceIp: 192.0.2.50
requestCount: 240
distinctPathCount: 218
statusDistribution:
  200: 12
  403: 8
  404: 220
```

### Observation

Source IP Groupとして、

```yaml
requestCount: 240
distinctPathCount: 218
statusDistribution:
  200: 12
  403: 8
  404: 220
```

を保持する。

代表PathのみSample / Top Pathとして保持し、218 Path全件をAIへ送らない。

Analyzerは「探索」「スキャン」と分類しない。

AIはDistinct Path Count、Status分布、代表Path、Known Informationを根拠として可能性を説明する。

---

## 30.6 Case E: 404多数

### Input概要

```text
totalRequests: 20000
404: 4200
```

404 Groupでは総件数だけでなく、少なくとも次を保持する。

```yaml
status: 404
requestCount: 4200
distinctPathCount: 1750
distinctSourceIpCount: 420
topPaths:
  - path: /example-a
    count: 180
  - path: /example-b
    count: 95
```

これによりAIは「404が4200件」という総数だけではなく、Path/IPへの分布を確認できる。

---

## 30.7 Case F: 5xx少数集中

### Input概要

```text
totalRequests: 50000
500: 8

/api/order:
  500: 7
```

全体比率では非常に小さい。

しかしPath Groupの`5xx_count`観点から`/api/order`を候補として残せる。

```yaml
path: /api/order
requestCount: 120
statusDistribution:
  200: 113
  500: 7
selectionReasons:
  - 5xx_count
```

このケースにより、全体件数や比率だけでCandidateを選ばないことを確認する。

---

## 30.8 Case G: 機密Query

### Input

```text
GET /reset?email=user@example.com&token=abc123
```

### ObservationSet

```text
/reset?email=[REDACTED]&token=[REDACTED]
```

Parameter名は説明用文脈として残すが、値は残さない。

Known Information MatchingでQuery値を利用する設計にはしない。

---

## 30.9 Case H: Parse Warning

例えば100,000行中250行がParse不能だった場合、

```yaml
parseSummary:
  totalLines: 100000
  parsedLines: 99750
  failedLines: 250
```

を必ず保持する。

Warning Sampleは上限付きでRedaction後の代表例のみ保持する。

AIは250行が解析対象外だったことを説明できる。

---

## 30.10 Case I: Truncation

Aggregation後に10,000 Path Groupが存在し、ObservationSetへ100 Groupしか残せない場合、

```yaml
truncationSummary:
  path:
    totalGroups: 10000
    selectedGroups: 100
    omittedGroups: 9900
```

を保持する。

AIは選出済みGroupだけを根拠に説明し、

```text
すべてのPathを確認した
```

とは説明してはならない。

---

# 31. Validationから確認できたこと

代表ケースを通した結果、現時点のObservationSet構造では次を表現できる。

- Countが少ないKnown Information一致
- Countが多いが意味未確定のPath
- 単一IPから多数Pathへのアクセス
- Status全体の集中
- 特定Pathに局所化した5xx
- Queryの安全なSample
- Parse欠損
- Selectionによる省略

この段階では、新しいDetection Rule、Severity、Priority、Intent分類を追加する必要はない。

一方で、次の点は今後の実ログ検証で確認が必要である。

### 31.1 Baseline比較

現設計はアップロードされたログ内での集計を基本とする。

「通常時より増えた」という比較には過去ObservationSet等のBaselineが必要になるが、初期実装には含めない。

### 31.2 Response Size

Response Sizeはログフォーマットによって存在しない。

存在する場合のみ集計し、欠損を0 byteとして扱わない。

### 31.3 Duration / Response Time

一般的なAccess Logには処理時間が含まれない場合がある。

存在するフォーマットでは将来Aggregation対象にできるが、初期必須項目にはしない。

---

# 32. ObservationSet設計の確定境界

代表ケース検証を踏まえ、08ではAnalyzerの責務を次で確定する。

```text
Raw Log
  ↓
Parse / Normalize
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
  ↓
AI
```

Analyzerはここから先の意味解釈を行わない。

AIはObservationSetを根拠として、

- 何が観測されているか
- Known Information上それが何であるか
- どのような可能性が考えられるか
- 何が断定できないか
- 次に何を確認すべきか

を説明する。

---

# 33. 次の設計対象

ObservationSetの代表ケース検証まで完了したため、次は**Known Information Storeの詳細設計**へ進む。

ここでは次を確定する。

- Built-in / Project / Userの責務
- Entry Schema
- Path Matching方式
- 優先順位とOverride
- Version管理
- 初期Built-in Datasetの範囲
- Analyzer AnnotationとAIへの受け渡し
- 誤ったKnown Informationを更新・無効化する方法

Known InformationはAIの推論負荷を下げる一方、誤情報を事前登録すると説明品質へ直接影響する。

そのため、登録対象を増やすことよりも、**確実に既知と言える情報だけを保持できる構造**を優先する。


# 34. Known Information Store

## 34.1 目的

Known Information Storeは、AnalyzerとAIの双方が参照できる既知情報を保持する。

主目的は次の2点である。

1. Analyzerが、件数の少ない既知Path等をObservationSetへ残せること
2. AIが、一般に既知である情報を毎回推論せずに説明へ利用できること

Known Information Store自体は判定エンジンではない。

次を行わない。

- 攻撃判定
- Severity / Priority算出
- Intent推定
- Observationの意味確定
- AI出力文の生成

Known Informationは、**観測対象に対する補助情報**としてのみ利用する。

---

## 34.2 Source Layer

Known Informationは次の3層で保持する。

```text
built_in
project
user
```

### built_in

Polarisに標準で同梱する情報。

対象は、広く知られており意味が安定しているものに限定する。

例：

```text
/wp-login.php
/.git/config
/.env
/xmlrpc.php
```

Built-in Datasetは「網羅性」より「誤りにくさ」を優先する。

### project

案件固有の情報。

例：

```text
/client-admin/
/members/signin/
/internal-api/
```

同じPathでも案件ごとに意味が異なるため、Project情報はBuilt-inより優先する。

### user

ユーザー個人または組織が明示的に登録した情報。

Project情報よりさらに優先する。

初期の優先順位は次とする。

```text
user
  ↓
project
  ↓
built_in
```

---

## 34.3 Entry Schema

初期Schemaは次とする。

```typescript
type KnownInformationSource =
  | 'built_in'
  | 'project'
  | 'user';

type KnownInformationMatchType =
  | 'exact'
  | 'prefix';

interface KnownInformationEntry {
  id: string;

  source: KnownInformationSource;

  target: {
    type: 'path';
    value: string;
    matchType: KnownInformationMatchType;
    caseSensitive: boolean;
  };

  label: string;

  description: string;

  technology?: string;

  commonPurpose?: string;

  enabled: boolean;

  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    datasetVersion?: string;
  };
}
```

初期実装では`target.type`は`path`のみとする。

UA、IP、Query Parameter、Status等への拡張は、実利用で必要性が確認されてから追加する。

---

## 34.4 Match Type

初期実装で使用するMatching方式は次の2つに限定する。

### exact

完全一致。

```text
/wp-login.php
```

は

```text
/wp-login.php
```

にのみ一致する。

Query StringはNormalize後にPathから除外されるため、

```text
/wp-login.php?redirect_to=...
```

もNormalized Pathが`/wp-login.php`であれば一致する。

### prefix

指定Prefix配下を対象とする。

例：

```text
/.git/
```

なら、

```text
/.git/config
/.git/HEAD
/.git/index
```

に一致する。

---

## 34.5 初期実装で採用しないMatching

次は初期実装では採用しない。

- contains
- regex
- glob
- suffix
- fuzzy matching
- AIによる類似判定

理由：

- Matching結果が分かりにくくなる
- 誤一致の原因が増える
- Datasetメンテナンスが難しくなる
- Known Information自体が判定層に近づく

必要になった場合はMatch Typeを明示的に追加する。

---

## 34.6 Normalizeとの関係

Known Information MatchingはNormalized Pathに対して行う。

```text
Raw Request Target
    ↓
Parse
    ↓
Path Normalize
    ↓
Known Information Match
```

Known Information側のPathも、登録時に同じNormalizeルールへ通す。

これにより、

```text
/wp-login.php
/wp-login.php?foo=bar
```

などを安定して扱える。

ただし、Normalizeで意味を失う変換は行わない。

例えばPathの大文字小文字を常に小文字化することはしない。

Case SensitivityはEntry側で指定する。

---

## 34.7 Override

同じ対象へ複数Entryが一致した場合、Source優先順位を使用する。

```text
user > project > built_in
```

例：

```yaml
built_in:
  /login
  label: Generic Login Path

project:
  /login
  label: Customer Portal Login
```

この場合、Project EntryをPrimaryとして扱う。

Built-in情報を完全に削除する必要はない。

ObservationSetではPrimary Entryと補助Entryを分けられる。

```typescript
interface KnownInformationMatch {
  id: string;
  label: string;
  description: string;
  technology?: string;
  commonPurpose?: string;
  source: KnownInformationSource;
  isPrimary: boolean;
}
```

AIは`isPrimary: true`を優先して説明する。

---

## 34.8 Disable

Built-in Entryを案件単位で無効化できる必要がある。

例えば、

```text
/admin/
```

が案件上まったく別用途で使われており、Built-in情報が不適切な場合がある。

そのためProjectまたはUser側で、特定Built-in Entryを無効化できる。

初期実装では削除ではなくDisable Overrideを使用する。

```typescript
interface KnownInformationOverride {
  targetEntryId: string;
  source: 'project' | 'user';
  enabled: boolean;
}
```

これによりBuilt-in Dataset更新後も、元Entryを失わず案件側の意図を保持できる。

---

## 34.9 ID設計

Entry IDは意味が安定する識別子とする。

例：

```text
path.wordpress.login
path.wordpress.xmlrpc
path.git.config
path.dotenv
```

IDは表示文ではない。

labelやdescriptionを変更してもIDは原則維持する。

Project / User EntryではUUID等の一意IDを利用できる。

---

## 34.10 Built-in Dataset Version

Built-in DatasetにはVersionを持たせる。

```text
datasetVersion: 1
```

または、

```text
datasetVersion: 2026.08
```

形式は実装時に決定する。

重要なのは、ObservationSet生成時にどのDataset Versionを使用したか追跡可能であること。

```typescript
interface KnownInformationSummary {
  builtInDatasetVersion: string;
}
```

これにより、後からKnown Informationが更新された場合でも、過去の解析で使用された情報を確認できる。

---

## 34.11 Built-in Dataset更新

Built-in情報はアプリケーション更新と同時に更新可能にする。

ただし、初期実装では外部サービスから動的に同期しない。

理由：

- 解析の再現性が下がる
- 外部情報の誤りが即時反映される
- 可用性依存が増える
- Known Information更新経路が複雑になる

初期はVersion付きStatic Datasetとして管理する。

---

## 34.12 Built-in Datasetの登録基準

Built-inへ追加する情報は、次を満たすものを優先する。

1. Pathの意味が広く安定している
2. 特定製品・技術で一般的に使われている
3. AI説明時に有用な補助情報になる
4. 誤一致リスクが低い
5. Countが少なくてもObservationSetへ残す価値がある

登録数を増やすこと自体を目的にしない。

---

## 34.13 初期Built-in Datasetの範囲

初期版では、まず少数の確実なPathから開始する。

例：

### WordPress

```text
/wp-login.php
/xmlrpc.php
```

### Git

```text
/.git/config
/.git/HEAD
```

### Environment File

```text
/.env
```

### Common Sensitive Files

```text
/.htaccess
/.htpasswd
```

この一覧は「危険Path一覧」ではない。

各Entryは単に、そのPathが一般に何であるかを説明するための既知情報である。

たとえば`/wp-login.php`へのアクセスが正常な管理者操作である可能性も当然ある。

---

## 34.14 過度なBuilt-in登録を避ける

初期段階で次のような大量リストは入れない。

- 数千件の脆弱性Path
- CVEごとのExploit URL
- スキャナ由来の巨大辞書
- CMS Plugin全件
- 既知Bot UA全件
- IP Reputation Database

これらはKnown Information Storeの責務を越えやすい。

また更新頻度も高くなるため、別機能として必要性を確認してから検討する。

---

## 34.15 Analyzer Annotation

Known Information MatchingはAggregation後のPath Groupに対して実行する。

```text
Path Aggregation
    ↓
Known Information Match
    ↓
Known Information Annotation
```

Raw Logの各行へKnown Informationを複製しない。

これにより処理量とメモリ使用量を抑える。

Source IP × Path Groupでは、同じNormalized PathのAnnotationを再利用できる。

---

## 34.16 Selectionとの関係

Known Information一致はCandidate Selectionの1観点として使用する。

```text
selectionReasons:
  - known_information
```

ただし、Known Informationの種類や内容によってPriorityは付けない。

例えば、

```text
/.git/config
/wp-login.php
```

のどちらが重要かをAnalyzerは判断しない。

一致しているという事実だけをSelectionに利用する。

---

## 34.17 AIへの受け渡し

AIにはKnown Information Store全体を渡さない。

一致したEntryだけをGroupへ付与する。

```yaml
knownInformation:
  - id: path.wordpress.login
    label: WordPress Login Path
    description: WordPressで一般的にログイン処理に使用されるPathです。
    technology: WordPress
    commonPurpose: Authentication
    source: built_in
    isPrimary: true
```

これによりToken使用量を抑える。

AIが全Datasetを検索する必要もない。

---

## 34.18 AI側の扱い

Known InformationはAIにとって「確定した攻撃情報」ではない。

AIは次のように扱う。

```text
Known Information
=
そのPath等についてPolarisが事前に保持している一般情報
```

AIは、

```text
/wp-login.phpなので攻撃です
```

とは説明してはならない。

集計情報とKnown Informationを合わせ、

```text
/wp-login.phpはWordPressで一般的にログイン処理に使用されるPathです。
今回のログでは...
```

のように、事実と解釈を分離して説明する。

---

## 34.19 Project / User Entry登録

Project / User Entryには最低限次を入力できるようにする。

```text
Path
Match Type
Label
Description
Enabled
```

Technology / Common Purposeは任意とする。

ユーザーが分類体系まで理解しなければ登録できないUIにはしない。

例えば、

```text
Path:
/client-admin/

Label:
クライアント管理画面

Description:
社内担当者が利用する管理画面
```

だけで登録可能とする。

---

## 34.20 誤情報修正

Known Informationが誤っている場合、次の方法で対応する。

### Built-in

Dataset側を修正しVersionを更新する。

既存Projectで緊急回避が必要な場合はDisable Overrideを利用する。

### Project / User

Entry自体を編集または無効化する。

過去のObservationSetは生成時のKnown Informationを保持し、後から自動的に書き換えない。

---

## 34.21 Snapshot

ObservationSetへは、一致したKnown InformationをSnapshotとして保存する。

つまりObservationSetが、

```text
Known Information Entry IDだけ
```

を保持し、表示時に最新Storeへ再問い合わせする設計にはしない。

最低限、

```text
id
label
description
technology
commonPurpose
source
isPrimary
```

をObservationSetへ保存する。

理由：

- 過去解析結果の再現性
- Dataset更新による説明内容変化の防止
- AI入力の安定
- External Lookup不要

---

## 34.22 Known Information Store Interface

初期Interface例：

```typescript
interface KnownInformationStore {
  matchPath(path: string): KnownInformationMatch[];

  getBuiltInDatasetVersion(): string;
}
```

AnalyzerはStoreの保存方式を知らない。

Static JSON、DB等への変更はStore実装内部に閉じ込める。

---

## 34.23 不採用案: AIによるKnown Information生成

Analyzer実行中にUnknown PathをAIへ問い合わせ、その回答をKnown Information Storeへ自動登録する方式は採用しない。

理由：

- 誤情報が永続化される可能性
- 同じPathでも案件固有の意味がある
- Storeの信頼性が低下する
- Analyzer処理がAI可用性に依存する

AIが説明時に推測することと、Known Informationとして永続化することは分離する。

---

## 34.24 不採用案: Reputation / Threat Intelligence統合

IP ReputationやThreat IntelligenceをKnown Information Storeへ統合する案は初期実装では採用しない。

これらは、

- 時間で変化する
- 外部API依存が強い
- 評価値を伴う
- 「既知情報」より「外部評価」に近い

ため、Known Informationとは別責務として扱う。

---

# 35. Known Information Testing

## 35.1 Matching

- Exact一致が正しい
- Prefix一致が正しい
- Query除去後Pathで一致する
- Case Sensitive設定が機能する
- Partialな文字列一致が誤って発生しない

## 35.2 Override

- built_inのみの場合Primaryになる
- projectが一致した場合projectがPrimaryになる
- userが一致した場合userがPrimaryになる
- Disable OverrideによりBuilt-inを無効化できる
- 他Entryへの影響が発生しない

## 35.3 Version / Snapshot

- Dataset VersionがObservationSetへ記録される
- Dataset更新後も過去ObservationSetの表示が変わらない
- Snapshot内容がAIへそのまま渡せる

## 35.4 Selection

- Count 1でもKnown Information一致GroupがCandidateになる
- Known Information一致がPriorityやSeverityを生成しない
- Known Information候補上限超過がTruncationへ記録される

---

# 36. Known Information確定事項

1. Known Information Storeは初期実装から搭載する。
2. AnalyzerとAIの双方が利用できる情報として設計する。
3. Storeは`built_in / project / user`の3層を持つ。
4. 優先順位は`user > project > built_in`とする。
5. 初期TargetはPathのみとする。
6. 初期MatchingはExact / Prefixのみとする。
7. Regex / Fuzzy / AI Matchingは初期実装では使用しない。
8. MatchingはNormalized Pathに対して行う。
9. Known Informationは異常・攻撃・Priorityを判定しない。
10. Known Information一致はCandidate Selectionの理由として利用できる。
11. Built-in DatasetはVersion管理する。
12. Built-in Datasetは初期はStatic Datasetとする。
13. 外部サービスからの自動同期は行わない。
14. Built-inは少数の確実な情報から開始する。
15. 大規模脆弱性辞書等は初期Datasetへ入れない。
16. Project / User Entryで案件固有情報を登録可能にする。
17. Built-in EntryはProject / User側から無効化可能にする。
18. ObservationSetには一致Known InformationをSnapshotとして保持する。
19. Dataset更新後も過去ObservationSetを自動変更しない。
20. Unknown情報をAIから自動登録しない。

---

# 37. 次の設計対象

Known Information Storeの詳細設計まで完了したため、次は**ObservationSet Interfaceの最終統合**を行う。

ここまで個別に定義した、

- Parse Summary
- Path Group
- Source IP Group
- Source IP × Path Group
- Status Group
- Method Group
- User-Agent Group
- Time Group
- Known Information
- Selection Reasons
- References
- Truncation Summary
- Redaction情報

を1つのInterfaceとして整理する。

目的は新しい機能を追加することではなく、実装時にそのままTypeScript型へ落とせる形まで統合し、重複項目や欠損項目を最終確認することである。


# 38. ObservationSet Interface Final Integration

## 38.1 目的

ここまで個別に定義してきたAnalyzer出力を、実装時にそのまま型定義へ落とし込める1つの構造へ統合する。

目的は新しい解析機能を追加することではない。

確認対象は次の3点である。

1. 同じ情報を複数箇所へ重複保持していないこと
2. AI説明に必要な情報が欠けていないこと
3. Optional項目と必須項目の境界が明確であること

---

## 38.2 Top Level

```typescript
interface ObservationSet {
  version: string;

  source: ObservationSourceSummary;

  parse: ParseSummary;

  groups: ObservationGroups;

  knownInformation: KnownInformationSetSummary;

  truncation: TruncationSummary;

  redaction: RedactionSummary;
}
```

Top Levelでは意味判断を持たない。

`severity`、`priority`、`risk`、`intent`、`attackType`等は含めない。

---

## 38.3 ObservationSourceSummary

```typescript
interface ObservationSourceSummary {
  logFormat: string;

  period: {
    firstSeen?: string;
    lastSeen?: string;
  };

  totalRequestCount: number;

  availableFields: {
    sourceIp: boolean;
    method: boolean;
    path: boolean;
    query: boolean;
    status: boolean;
    responseSize: boolean;
    referrer: boolean;
    userAgent: boolean;
    duration: boolean;
  };
}
```

`availableFields`は、ログフォーマット上その情報が存在したかを示す。

例えばResponse Sizeが取得できないログで、

```text
responseSize = 0
```

としてはならない。

値が存在しないことと0であったことを分離する。

---

## 38.4 ParseSummary

```typescript
interface ParseSummary {
  totalLines: number;

  parsedLines: number;

  partialLines: number;

  failedLines: number;

  warnings: ParseWarningSummary[];
}
```

```typescript
interface ParseWarningSummary {
  code: string;

  count: number;

  description: string;

  samples: RedactedLogSample[];
}
```

Parse WarningはObservationSetの必須情報である。

`warnings`が空配列であることは許容する。

---

## 38.5 ObservationGroups

```typescript
interface ObservationGroups {
  paths: PathObservation[];

  sourceIps: SourceIpObservation[];

  sourceIpPaths: SourceIpPathObservation[];

  statuses: StatusObservation[];

  methods: MethodObservation[];

  userAgents: UserAgentObservation[];

  time: TimeObservation[];
}
```

初期実装ではこの7 Viewを標準とする。

Group配列が空であることは許容するが、Property自体は常に存在させる。

---

## 38.6 Common Group Metadata

各Groupで共通するメタデータを次とする。

```typescript
interface ObservationGroupBase {
  groupId: ObservationGroupId;

  requestCount: number;

  firstSeen?: string;

  lastSeen?: string;

  selectionReasons: SelectionReason[];

  knownInformation: KnownInformationMatch[];
}
```

ただし、Known Informationを実際に持つのは主にPath系Groupである。

他Groupでは空配列となる。

全Groupに同じInterfaceを無理に継承させることで不要項目が増える場合は、実装時にCompositionへ変更してよい。

本書では「Groupに共通して必要な情報」を明示する目的でBaseを使用する。

---

## 38.7 SelectionReason

```typescript
type SelectionReason =
  | 'known_information'
  | 'request_count'
  | 'distinct_source_ip_count'
  | 'distinct_path_count'
  | '4xx_count'
  | '5xx_count'
  | 'post_count'
  | 'response_size'
  | 'time_bucket'
  | 'representative';
```

Selection Reasonは重要度ではない。

AIはSelection ReasonをPriorityとして解釈してはならない。

---

## 38.8 PathObservation

```typescript
interface PathObservation extends ObservationGroupBase {
  path: string;

  distinctSourceIpCount: number;

  queryVariantCount: number;

  methodDistribution: CountMap<string>;

  statusDistribution: CountMap<number>;

  distinctUserAgentCount: number;

  responseSize?: {
    total: number;
    average: number;
    max: number;
  };

  timeDistribution: TimeBucketCount[];

  sampleQueries: RedactedQuerySample[];

  sampleReferrers: RedactedReferrerSample[];

  sampleUserAgents: string[];

  sampleSourceIps: string[];
}
```

Path GroupはAI説明上もっとも重要なViewの1つである。

ただし全Pathを保持せず、Selection後のPathのみObservationSetへ含める。

---

## 38.9 SourceIpObservation

```typescript
interface SourceIpObservation extends ObservationGroupBase {
  sourceIp: string;

  distinctPathCount: number;

  methodDistribution: CountMap<string>;

  statusDistribution: CountMap<number>;

  distinctUserAgentCount: number;

  topPaths: RankedPathCount[];

  timeDistribution: TimeBucketCount[];

  sampleUserAgents: string[];
}
```

Source IP自体のReputationや国情報等は初期実装では含めない。

---

## 38.10 SourceIpPathObservation

```typescript
interface SourceIpPathObservation extends ObservationGroupBase {
  sourceIp: string;

  path: string;

  queryVariantCount: number;

  methodDistribution: CountMap<string>;

  statusDistribution: CountMap<number>;

  distinctUserAgentCount: number;

  timeDistribution: TimeBucketCount[];

  sampleQueries: RedactedQuerySample[];

  pathGroupRef?: ObservationReference;

  sourceIpGroupRef?: ObservationReference;
}
```

このViewのみ、初期実装で限定的なGroup Referenceを持つ。

---

## 38.11 StatusObservation

```typescript
interface StatusObservation extends ObservationGroupBase {
  status: number;

  distinctPathCount: number;

  distinctSourceIpCount: number;

  topPaths: RankedPathCount[];

  topSourceIps: RankedSourceIpCount[];

  timeDistribution: TimeBucketCount[];
}
```

Status Groupは、

```text
404が多い
```

だけでなく、どのPath / IPへ分布しているかをAIが確認するために使用する。

---

## 38.12 MethodObservation

```typescript
interface MethodObservation extends ObservationGroupBase {
  method: string;

  distinctPathCount: number;

  distinctSourceIpCount: number;

  topPaths: RankedPathCount[];

  topSourceIps: RankedSourceIpCount[];

  statusDistribution: CountMap<number>;
}
```

Method自体に危険度を付けない。

POSTが多い等の意味はAIが他情報と合わせて説明する。

---

## 38.13 UserAgentObservation

```typescript
interface UserAgentObservation extends ObservationGroupBase {
  userAgent: string;

  distinctPathCount: number;

  distinctSourceIpCount: number;

  topPaths: RankedPathCount[];

  statusDistribution: CountMap<number>;
}
```

UA Classificationは初期必須ではない。

Known Botかどうか等の情報を将来Known Informationへ拡張する余地はあるが、現時点では生UA文字列と集計値を扱う。

---

## 38.14 TimeObservation

```typescript
interface TimeObservation extends ObservationGroupBase {
  bucket: {
    start: string;
    end: string;
    sizeSeconds: number;
  };

  distinctPathCount: number;

  distinctSourceIpCount: number;

  methodDistribution: CountMap<string>;

  statusDistribution: CountMap<number>;

  topPaths: RankedPathCount[];

  topSourceIps: RankedSourceIpCount[];
}
```

1分Bucketと5分Bucketのどちらを含むかはConfigurationで制御する。

両方含める場合は`sizeSeconds`で区別する。

---

## 38.15 Shared Count Types

```typescript
type CountMap<K extends string | number> =
  Record<K, number>;
```

ただし実装言語上、数値KeyをJSONへserializeすると文字列化される。

Transport時の表現差異はSerializerで吸収する。

---

## 38.16 Ranked Types

```typescript
interface RankedPathCount {
  path: string;
  count: number;
}

interface RankedSourceIpCount {
  sourceIp: string;
  count: number;
}
```

`rank`自体は保持しない。

配列順が順位を表す。

理由：

- rankと配列順の不整合を防ぐ
- 情報重複を避ける

---

## 38.17 TimeBucketCount

```typescript
interface TimeBucketCount {
  start: string;
  end: string;
  count: number;
}
```

Path / IP Group内の時間分布では、すべてのBucketを保持しない。

SelectionされたGroupについて、上限付きの代表Bucketまたは連続期間に限定して保持する。

---

## 38.18 RedactedQuerySample

```typescript
interface RedactedQuerySample {
  value: string;

  count: number;
}
```

例：

```text
email=[REDACTED]&token=[REDACTED]
```

Raw QueryはObservationSetへ保持しない。

---

## 38.19 RedactedReferrerSample

```typescript
interface RedactedReferrerSample {
  value: string;

  count: number;
}
```

Referrer URL内のQueryにも同じRedactionルールを適用する。

---

## 38.20 RedactedLogSample

```typescript
interface RedactedLogSample {
  value: string;
}
```

Parse Warning用のSample等でのみ使用する。

通常GroupへRaw Log本文を複製しない。

---

## 38.21 KnownInformationSetSummary

```typescript
interface KnownInformationSetSummary {
  builtInDatasetVersion: string;

  matchedEntryCount: number;
}
```

Store全体のEntry一覧はObservationSetへ含めない。

一致内容は各Group内の`knownInformation`へSnapshotとして保持する。

---

## 38.22 KnownInformationMatch

```typescript
interface KnownInformationMatch {
  id: string;

  label: string;

  description: string;

  technology?: string;

  commonPurpose?: string;

  source:
    | 'built_in'
    | 'project'
    | 'user';

  isPrimary: boolean;
}
```

Known Informationは説明補助情報であり、危険度を含めない。

---

## 38.23 TruncationSummary

```typescript
interface TruncationSummary {
  groups: Record<
    ObservationGroupType,
    {
      totalGroups: number;
      selectedGroups: number;
      omittedGroups: number;
    }
  >;

  knownInformation?: {
    matchedGroups: number;
    selectedGroups: number;
    omittedGroups: number;
  };
}
```

```typescript
type ObservationGroupType =
  | 'path'
  | 'source_ip'
  | 'source_ip_path'
  | 'status'
  | 'method'
  | 'user_agent'
  | 'time';
```

Truncationが発生していなくても`omittedGroups: 0`として保持する。

これによりAIは「全件か一部か」を常に確認できる。

---

## 38.24 RedactionSummary

```typescript
interface RedactionSummary {
  applied: boolean;

  redactedParameterNames: string[];

  redactedValueCount: number;
}
```

具体的な機密値は保持しない。

Parameter名のみ、どの種類の情報がRedactionされたかを示す。

---

## 38.25 ObservationReference

```typescript
interface ObservationReference {
  groupId: ObservationGroupId;

  groupType: ObservationGroupType;
}
```

Reference先がObservationSet内に存在する場合のみ付与する。

---

## 38.26 ObservationSet Version

ObservationSetには独立したSchema Versionを持つ。

```text
version: "1.0"
```

これはKnown Information Dataset Versionとは別である。

目的：

- Schema変更追跡
- 過去データ互換
- AI Prompt側の入力契約管理
- 将来Migration

---

# 39. Interface Review

## 39.1 削除した重複

最終統合時に、次の重複を持たない方針を確認した。

### `totalRequestCount`

Top LevelのSource Summaryにのみ保持する。

各GroupのrequestCountはそのGroup自身の件数であり、全体総数を重複保持しない。

### Known Information Dataset

ObservationSetにはDataset全体を含めない。

Dataset Version + GroupごとのMatched Snapshotのみ保持する。

### Rank

配列順で表現し、rankフィールドを持たない。

### Raw Log

Parse Warning Sample以外へRaw Log本文を複製しない。

---

## 39.2 Optionalと必須

必須：

- ObservationSet.version
- source
- parse
- groups
- knownInformation
- truncation
- redaction
- 各GroupのgroupId
- requestCount
- selectionReasons

Optional：

- firstSeen / lastSeen
- responseSize
- duration関連情報
- Group Reference
- technology
- commonPurpose

「存在しないデータ」と「0件」を混同しない。

---

## 39.3 AIへ不要な項目

次は最終Interfaceにも追加しない。

- Severity
- Priority
- Risk Score
- Attack Type
- Intent
- Recommended Actionの固定値
- Analyzer生成の結論文

AIはObservationSetの事実から説明する。

---

# 40. ObservationSet Validation Example

最小例：

```yaml
version: "1.0"

source:
  logFormat: combined
  period:
    firstSeen: 2026-08-21T10:00:00+09:00
    lastSeen: 2026-08-21T11:00:00+09:00
  totalRequestCount: 12500

parse:
  totalLines: 12500
  parsedLines: 12498
  partialLines: 0
  failedLines: 2
  warnings:
    - code: malformed_line
      count: 2
      description: Request lineを解析できませんでした。
      samples:
        - value: "[REDACTED SAMPLE]"

groups:
  paths:
    - groupId: path:1
      path: /wp-login.php
      requestCount: 5
      distinctSourceIpCount: 1
      queryVariantCount: 0
      methodDistribution:
        GET: 1
        POST: 4
      statusDistribution:
        200: 5
      distinctUserAgentCount: 1
      timeDistribution: []
      sampleQueries: []
      sampleReferrers: []
      sampleUserAgents:
        - Mozilla/5.0 ...
      sampleSourceIps:
        - 203.0.113.10
      selectionReasons:
        - known_information
      knownInformation:
        - id: path.wordpress.login
          label: WordPress Login Path
          description: WordPressで一般的にログイン処理に使用されるPathです。
          technology: WordPress
          commonPurpose: Authentication
          source: built_in
          isPrimary: true

  sourceIps: []
  sourceIpPaths: []
  statuses: []
  methods: []
  userAgents: []
  time: []

knownInformation:
  builtInDatasetVersion: "2026.08"
  matchedEntryCount: 1

truncation:
  groups:
    path:
      totalGroups: 420
      selectedGroups: 100
      omittedGroups: 320
    source_ip:
      totalGroups: 0
      selectedGroups: 0
      omittedGroups: 0
    source_ip_path:
      totalGroups: 0
      selectedGroups: 0
      omittedGroups: 0
    status:
      totalGroups: 0
      selectedGroups: 0
      omittedGroups: 0
    method:
      totalGroups: 0
      selectedGroups: 0
      omittedGroups: 0
    user_agent:
      totalGroups: 0
      selectedGroups: 0
      omittedGroups: 0
    time:
      totalGroups: 0
      selectedGroups: 0
      omittedGroups: 0

redaction:
  applied: false
  redactedParameterNames: []
  redactedValueCount: 0
```

この例から、AIは次を確認できる。

- ログ全体件数
- Parse欠損
- ObservationSetが全Pathを含んでいないこと
- `/wp-login.php`の件数
- Method / Status
- Known Information

Analyzerは何も危険判定していない。

---

# 41. ObservationSet Testing

## 41.1 Schema

- 必須Propertyが常に存在する
- Optional項目欠損時に0へ誤変換されない
- Empty Groupは空配列で表現される
- ObservationSet Versionが保持される

## 41.2 Group Integrity

- groupIdがObservationSet内で一意
- requestCountがAggregationSetと一致する
- Distribution合計がrequestCountと矛盾しない
- Reference先が存在する
- Selection後に省略されたGroupへのReferenceが残らない

## 41.3 Truncation

- total = selected + omitted
- Group Typeごとの件数が正しい
- 省略なしでも0を明示する
- AIが全件処理済みと誤認しない情報が存在する

## 41.4 Known Information

- Matched SnapshotがGroupへ含まれる
- Dataset VersionがTop Level Summaryへ含まれる
- Primaryが1件以下になる
- Store更新後も既存ObservationSetが変化しない

## 41.5 Redaction

- Raw Sensitive Valueが存在しない
- redactedValueCountが実際の処理数と一致する
- Parameter名のみSummaryへ残る

---

# 42. ObservationSet Interface確定事項

1. Analyzerの最終成果物は`ObservationSet`とする。
2. ObservationSetはSchema Versionを持つ。
3. Parse / Group / Known Information / Truncation / RedactionをTop Levelで保持する。
4. 標準Aggregation Viewは7種類とする。
5. 各Groupは一意なgroupIdを持つ。
6. Selection Reasonは重要度ではなく選出理由である。
7. Known Informationは各GroupへSnapshotとして保持する。
8. Known Information Store全体はObservationSetへ含めない。
9. Dataset VersionはTop Level Summaryで保持する。
10. Group Referenceは存在するSelected Group間のみ保持する。
11. Truncationは常にGroup Typeごとに明示する。
12. Optional情報を0値で代替しない。
13. Raw Sensitive ValueはObservationSetへ保持しない。
14. Severity / Priority / Intent / Attack Typeを持たない。
15. Analyzer生成の結論文を持たない。

---

# 43. 次の設計対象

ObservationSet Interfaceの統合が完了したため、次は**Analyzer Configuration**を最終整理する。

ここでは以下を確定する。

- Aggregation Viewの有効 / 無効
- Selection Top N
- ObservationSet Total Limit
- Sample Limit
- Time Bucket
- Redaction Parameter
- Known Information Dataset
- Project / User Known Information
- Exclusion
- Parser / Normalizerとの境界

Configurationも意味判断を持たず、集計・圧縮・安全なAI入力生成を制御する設定に限定する。


# 44. Analyzer Configuration

## 44.1 目的

Analyzer Configurationは、Analyzerの集計・圧縮・Redaction・Known Information利用を制御する。

Configurationは意味判断を行わない。

次のような設定は持たない。

- Severity Threshold
- Priority Threshold
- Attack Score
- Intent Weight
- Risk Weight
- 「危険と判定するCount」

Configurationは、**何を集計し、どこまで保持し、安全にAIへ渡すか**だけを制御する。

---

## 44.2 Top Level

```typescript
interface AnalyzerConfiguration {
  aggregation: AggregationConfiguration;

  selection: SelectionConfiguration;

  samples: SampleConfiguration;

  time: TimeConfiguration;

  redaction: RedactionConfiguration;

  knownInformation: KnownInformationConfiguration;

  exclusions: ExclusionConfiguration;
}
```

Parser / Normalizer固有設定は別Configurationとして管理し、Analyzer Configurationへ混在させない。

---

## 44.3 AggregationConfiguration

```typescript
interface AggregationConfiguration {
  views: {
    path: boolean;
    sourceIp: boolean;
    sourceIpPath: boolean;
    status: boolean;
    method: boolean;
    userAgent: boolean;
    time: boolean;
  };
}
```

初期デフォルトでは全Viewを有効にする。

ただしログフォーマット上利用できない項目に依存するViewは生成しない。

例：

```text
Source IPが取得不能
→ Source IP View / Source IP × Path Viewを生成しない
```

Configurationで有効でも、Source Fieldが存在しない場合に0値やUnknown Groupを生成してはならない。

---

## 44.4 SelectionConfiguration

```typescript
interface SelectionConfiguration {
  perView: {
    path: ViewSelectionConfiguration;
    sourceIp: ViewSelectionConfiguration;
    sourceIpPath: ViewSelectionConfiguration;
    status: ViewSelectionConfiguration;
    method: ViewSelectionConfiguration;
    userAgent: ViewSelectionConfiguration;
    time: ViewSelectionConfiguration;
  };

  totalGroupLimit: number;
}
```

```typescript
interface ViewSelectionConfiguration {
  enabled: boolean;

  topN: {
    requestCount?: number;
    distinctSourceIpCount?: number;
    distinctPathCount?: number;
    http4xxCount?: number;
    http5xxCount?: number;
    postCount?: number;
    responseSize?: number;
  };

  representativeLimit?: number;
}
```

SelectionはObservationSetへ残す候補を選ぶ設定であり、異常判定ではない。

---

## 44.5 初期Selection Default

初期値例：

```yaml
selection:
  totalGroupLimit: 500

  perView:
    path:
      enabled: true
      topN:
        requestCount: 50
        distinctSourceIpCount: 50
        http4xxCount: 50
        http5xxCount: 50
        postCount: 50
        responseSize: 30
      representativeLimit: 20

    sourceIp:
      enabled: true
      topN:
        requestCount: 50
        distinctPathCount: 50
        http4xxCount: 50
        http5xxCount: 50
      representativeLimit: 20
```

これは初期案であり、実ログ検証でToken量と情報欠落を確認して調整する。

重要なのは値そのものではなく、観点別に独立したTop Nを持つことである。

---

## 44.6 Total Limit

`totalGroupLimit`はObservationSet全体のGroup数上限である。

Per View / Per Reason選出後、重複Groupを統合してから適用する。

```text
各観点Selection
    ↓
Duplicate Merge
    ↓
Known Information Candidate追加
    ↓
Per View Result
    ↓
Total Limit適用
```

Total Limit超過時も重要度Scoreは計算しない。

既存方針どおり、

1. Known Information一致
2. 各観点の最低代表
3. 各観点の順位順

で残す。

---

## 44.7 Known Information Candidate Limit

Known Information一致Groupが非常に多い場合、全件を保持するとObservationSetが肥大化する。

そのためKnown Information枠にも上限を持てる。

```typescript
interface KnownInformationSelectionConfiguration {
  maxMatchedGroupsPerView: number;
}
```

ただし上限超過時には、

```text
Known Information一致が省略された
```

ことをTruncation Summaryへ記録する。

Countが少ないから削除する、という基準にはしない。

---

## 44.8 SampleConfiguration

```typescript
interface SampleConfiguration {
  queryPerGroup: number;

  referrerPerGroup: number;

  userAgentPerGroup: number;

  sourceIpPerGroup: number;

  parseWarningSamplesPerCode: number;

  topPathsPerGroup: number;

  topSourceIpsPerGroup: number;

  timeBucketsPerGroup: number;
}
```

Sampleは説明用の代表値である。

初期デフォルト例：

```yaml
samples:
  queryPerGroup: 5
  referrerPerGroup: 5
  userAgentPerGroup: 5
  sourceIpPerGroup: 5
  parseWarningSamplesPerCode: 3
  topPathsPerGroup: 10
  topSourceIpsPerGroup: 10
  timeBucketsPerGroup: 12
```

値はToken量とUI表示量を見ながら調整する。

---

## 44.9 TimeConfiguration

```typescript
interface TimeConfiguration {
  buckets: number[];
}
```

初期値：

```yaml
time:
  buckets:
    - 60
    - 300
```

単位は秒。

つまり、

- 1分
- 5分

Bucketを生成する。

時間Bucketは異常判定に使わない。

AIがアクセス集中の時間分布を説明するための観測値である。

---

## 44.10 RedactionConfiguration

```typescript
interface RedactionConfiguration {
  enabled: boolean;

  parameterNames: string[];

  replacement: string;
}
```

初期例：

```yaml
redaction:
  enabled: true
  replacement: "[REDACTED]"
  parameterNames:
    - password
    - passwd
    - pwd
    - token
    - access_token
    - api_key
    - apikey
    - secret
    - session
    - session_id
    - email
    - phone
```

Parameter名比較は初期実装ではCase Insensitiveとする。

---

## 44.11 Redaction対象

初期実装では次を対象とする。

- Query String
- Referrer URLのQuery String
- Parse Warning Sample内で抽出可能なQuery部分

Raw Request Bodyは通常のAccess Logに含まれないため対象外。

ログフォーマットによってRequest Bodyが含まれる場合は、別途Parser / Security設計が必要であり、初期実装の前提にはしない。

---

## 44.12 Redaction拡張

Project / User側で追加Parameter名を登録できる。

```typescript
interface RedactionConfiguration {
  enabled: boolean;

  builtInParameterNames: string[];

  projectParameterNames: string[];

  userParameterNames: string[];

  replacement: string;
}
```

実装上は最終的な集合を生成して適用する。

Built-in Redactionを案件側で安易に無効化するUIは初期実装では設けない。

---

## 44.13 KnownInformationConfiguration

```typescript
interface KnownInformationConfiguration {
  builtInEnabled: boolean;

  builtInDatasetVersion?: string;

  projectEntriesEnabled: boolean;

  userEntriesEnabled: boolean;

  selection: {
    maxMatchedGroupsPerView: number;
  };
}
```

Built-in Dataset Versionを固定指定できる構造を許容する。

ただし通常利用ではアプリケーション既定Versionを使用する。

---

## 44.14 Known Information Entry管理との境界

Analyzer ConfigurationはEntry本体を大量に埋め込むものではない。

次は別のStore / Repositoryで管理する。

- Built-in Entry一覧
- Project Entry一覧
- User Entry一覧
- Disable Override

ConfigurationはどのSourceを利用するかを指定するだけでよい。

---

## 44.15 ExclusionConfiguration

```typescript
interface ExclusionConfiguration {
  paths: PathExclusion[];

  sourceIps: SourceIpExclusion[];
}
```

```typescript
interface PathExclusion {
  value: string;

  matchType:
    | 'exact'
    | 'prefix';

  enabled: boolean;
}
```

```typescript
interface SourceIpExclusion {
  value: string;

  enabled: boolean;
}
```

初期実装ではPath / Source IPのみとする。

UAやStatus等の除外は、必要性が確認されてから追加する。

---

## 44.16 Exclusionの意味

Exclusionは「安全」と判定する設定ではない。

単にAnalyzer集計対象から除外する。

例：

```text
/healthcheck
```

を監視システムが毎秒アクセスしており、分析上不要な場合に除外できる。

Exclusionされた件数は完全に消すのではなく、Summaryへ残す。

```typescript
interface ExclusionSummary {
  excludedRequestCount: number;

  byType: {
    path: number;
    sourceIp: number;
  };
}
```

これにより、Analyzerが何件を除外したか確認できる。

---

## 44.17 Exclusion適用タイミング

```text
Parse
    ↓
Normalize
    ↓
Exclusion Match
    ↓
Aggregation
```

Aggregation後にGroupを削除する方式にはしない。

理由：

- Request Count等の集計値が除外前の値になる
- Source IP × Path等で整合性が崩れる
- Truncation / Selection件数が分かりにくくなる

---

## 44.18 ExclusionとKnown Information

ExclusionはKnown Informationより先に適用する。

```text
Normalized Entry
    ↓
Exclusion
    ↓
Aggregation
    ↓
Known Information Annotation
```

除外されたRequestをKnown Information一致候補として復活させない。

---

## 44.19 Configuration Validation

Analyzer起動前にConfigurationをValidationする。

例：

- Top Nが負数でない
- Total Limitが0以下でない
- Sample Limitが負数でない
- Time Bucketが0以下でない
- Redaction Replacementが空文字でない
- Path Prefixが不正形式でない

Validation失敗時に暗黙のDefaultへフォールバックして処理を続行しない。

設定誤りは明示的なConfiguration Errorとして扱う。

---

## 44.20 Default Strategy

初期設定は「最大限検出」ではなく、

```text
一般的なAccess Logを安全に整理し、
AIへ過不足なく渡せる
```

ことを目的にする。

そのため、

- Viewは基本有効
- Selectionは観点別
- Sampleは少数
- Known Informationは少数確実
- Redactionは標準有効
- Exclusionは初期空

とする。

---

## 44.21 Environment別設定

Analyzer Configurationを、

```text
development
production
```

で意味的に変えない。

例えばProductionだけSelection Thresholdを厳しくする、といった動作は避ける。

環境差は、

- Logging Level
- Debug Output
- Performance Instrumentation

など運用設定へ限定する。

同じログと同じAnalyzer Configurationなら、環境に関係なく同じObservationSetを生成できることを優先する。

---

## 44.22 Reproducibility

ObservationSetへAnalyzer Configurationそのものを全量保存する必要はない。

ただし、再現性に必要な識別情報を保持できる構造は持つ。

```typescript
interface AnalyzerExecutionSummary {
  configurationVersion: string;
}
```

必要に応じてHashを利用できる。

```text
configurationHash
```

ただし初期実装で必須とはしない。

---

# 45. Analyzer Configuration Interface

最終例：

```typescript
interface AnalyzerConfiguration {
  version: string;

  aggregation: {
    views: {
      path: boolean;
      sourceIp: boolean;
      sourceIpPath: boolean;
      status: boolean;
      method: boolean;
      userAgent: boolean;
      time: boolean;
    };
  };

  selection: {
    totalGroupLimit: number;

    perView: Record<
      ObservationGroupType,
      ViewSelectionConfiguration
    >;
  };

  samples: {
    queryPerGroup: number;
    referrerPerGroup: number;
    userAgentPerGroup: number;
    sourceIpPerGroup: number;
    parseWarningSamplesPerCode: number;
    topPathsPerGroup: number;
    topSourceIpsPerGroup: number;
    timeBucketsPerGroup: number;
  };

  time: {
    buckets: number[];
  };

  redaction: {
    enabled: boolean;
    replacement: string;
    parameterNames: string[];
  };

  knownInformation: {
    builtInEnabled: boolean;
    projectEntriesEnabled: boolean;
    userEntriesEnabled: boolean;
    maxMatchedGroupsPerView: number;
  };

  exclusions: {
    paths: PathExclusion[];
    sourceIps: SourceIpExclusion[];
  };
}
```

---

# 46. Configuration Testing

## 46.1 View

- Disabled Viewが生成されない
- 必要Field欠損時に無効Viewを生成しない
- 他Viewの集計値へ影響しない

## 46.2 Selection

- 観点別Top Nが独立して動作する
- Duplicate Merge後にTotal Limitが適用される
- Known Information一致がSelectionへ反映される
- Total Limit超過がTruncation Summaryへ反映される

## 46.3 Sample

- 各Sample Limitを超えない
- Limit 0でSampleを保持しない
- 集計Count自体には影響しない

## 46.4 Time

- 60 / 300秒Bucketが正しく生成される
- 任意Bucket Sizeが使用できる
- 無効なBucket値を拒否する

## 46.5 Redaction

- Built-in ParameterがRedactionされる
- User追加ParameterがRedactionされる
- Case InsensitiveでParameter名を認識する
- Replacementが正しく適用される

## 46.6 Exclusion

- Exact Path除外
- Prefix Path除外
- Source IP除外
- 除外件数がSummaryへ残る
- Known Informationで復活しない

## 46.7 Reproducibility

- 同一Input + 同一Configurationで同一ObservationSetになる
- Environment差で解析結果が変わらない

---

# 47. Analyzer Configuration確定事項

1. Configurationは意味判断を持たない。
2. Configurationは集計・選出・Sample・時間Bucket・Redaction・Known Information・Exclusionを制御する。
3. Severity / Priority / Attack Threshold等は持たない。
4. Aggregation Viewは個別に有効化できる。
5. Fieldが存在しないViewは生成しない。
6. Selectionは観点別Top N + Total Limitで制御する。
7. Total Limit適用時も総合Scoreは使用しない。
8. SampleにはGroupごとの明示的上限を持つ。
9. Time Bucketは初期1分 / 5分とする。
10. Redactionは標準有効とする。
11. Project / User独自Redaction Parameterを追加可能にする。
12. Known Information Entry本体はStoreで管理し、Configurationへ埋め込まない。
13. ExclusionはPath / Source IPから開始する。
14. ExclusionはNormalize後、Aggregation前に適用する。
15. Exclusion件数はSummaryへ保持する。
16. Configuration Errorを暗黙Defaultで隠さない。
17. 同一Input + 同一Configurationで同一ObservationSetを生成する。

---

# 48. 次の設計対象

Analyzer Configurationの整理まで完了したため、次は**Error Handling / Failure Mode**を整理する。

対象は次とする。

- Parse失敗
- Partial Parse
- 不正Configuration
- Known Information Store読込失敗
- ObservationSet Size Control失敗
- Redaction失敗
- Memory不足 / 大規模ログ
- Unsupported Log Format
- Analyzer内部例外

目的は、解析失敗を「成功したように見せない」ことと、部分的に利用できる結果を安全に返せる境界を決めることである。


# 49. Error Handling / Failure Mode

## 49.1 目的

Analyzerでは、解析途中の失敗を成功結果として扱わない。

一方で、一部の行だけがParseできない場合など、利用可能な観測結果まで破棄する必要はない。

そのためFailureを次の2種類に分ける。

```text
Recoverable
Fatal
```

RecoverableではObservationSetを返せる。

FatalではObservationSetを正常結果として返さない。

---

## 49.2 Analyzer Result Envelope

Analyzerの実行結果は、ObservationSet本体とは分離したEnvelopeで返す。

```typescript
type AnalyzerExecutionStatus =
  | 'success'
  | 'partial'
  | 'failed';

interface AnalyzerExecutionResult {
  status: AnalyzerExecutionStatus;

  observationSet?: ObservationSet;

  errors: AnalyzerError[];

  warnings: AnalyzerWarning[];
}
```

`failed`時には通常`observationSet`を返さない。

`partial`時には、利用可能な範囲のObservationSetを返す。

---

## 49.3 AnalyzerError

```typescript
interface AnalyzerError {
  code: string;

  message: string;

  stage:
    | 'configuration'
    | 'parse'
    | 'normalize'
    | 'aggregation'
    | 'known_information'
    | 'selection'
    | 'redaction'
    | 'serialization'
    | 'system';

  recoverable: boolean;

  count?: number;
}
```

Errorにはユーザー向け説明文とは別に、機械的に扱える`code`を必ず持たせる。

---

## 49.4 AnalyzerWarning

```typescript
interface AnalyzerWarning {
  code: string;

  message: string;

  stage: string;

  count?: number;
}
```

Warningは解析継続可能な情報欠損・制約を表す。

例：

```text
一部行をParseできなかった
Response Sizeがログに含まれていない
Known Information Storeの一部Entryを読めなかった
```

---

# 50. Parse Failure

## 50.1 一部行のParse失敗

一部の行だけがParseできない場合はRecoverableとする。

例：

```text
100,000行
99,750 Parsed
250 Failed
```

結果：

```text
status = partial
```

ObservationSetは返す。

Parse Summaryへ、

```text
totalLines
parsedLines
failedLines
warnings
```

を保持する。

AIは解析対象外の行があることを説明できる。

---

## 50.2 全行Parse失敗

全行または実質的に全行がParseできない場合はFatalとする。

例：

```text
Unsupported Log Format
```

結果：

```text
status = failed
observationSet = undefined
```

「0件のアクセス」としてObservationSetを返してはならない。

---

## 50.3 Partial Parse

行の一部Fieldのみ取得できる場合は、利用可能なFieldだけで集計する。

例えば、

```text
Path: available
Status: available
Source IP: unavailable
```

ならPath / Status Viewは生成可能。

Source IP系Viewは生成しない。

Partial Parse情報はParse Summaryへ残す。

---

# 51. Unsupported Log Format

Parserがログ形式を判定できない場合はFatalとする。

```text
ANALYZER_UNSUPPORTED_LOG_FORMAT
```

この場合、Analyzerは推測でColumn位置を決めて処理を続けない。

必要に応じてParser側でSupported Format一覧や検出候補を返す。

---

# 52. Configuration Failure

## 52.1 不正Configuration

次はFatalとする。

- Total Limitが負数
- Time Bucketが0以下
- Redaction設定が不正
- Exclusion Match Typeが未対応
- Required Configuration欠損

結果：

```text
status = failed
stage = configuration
```

暗黙DefaultへのFallbackは禁止する。

---

## 52.2 Optional設定欠損

Optional設定が存在しない場合は、明示されたDefault Configurationを使用できる。

これはConfiguration Errorではない。

重要なのは、

```text
Invalid Value
```

と

```text
Value Omitted
```

を分離することである。

---

# 53. Known Information Store Failure

## 53.1 Built-in Store読込失敗

Built-in Known Information Store全体を読めない場合、Analyzer本体の集計は可能である。

そのため基本はRecoverableとする。

結果：

```text
status = partial
```

Known Information AnnotationなしでObservationSetを生成する。

Warning / Errorとして、

```text
KNOWN_INFORMATION_BUILTIN_UNAVAILABLE
```

を保持する。

---

## 53.2 Project / User Entry読込失敗

Project / User Entryの一部または全部が読めない場合も、Aggregation自体は継続可能。

結果：

```text
status = partial
```

ただし、AIにはKnown Informationが欠損していることが伝わる必要がある。

そのためKnown Information Summaryへ状態を追加する。

```typescript
interface KnownInformationSetSummary {
  builtInDatasetVersion?: string;

  matchedEntryCount: number;

  sources: {
    builtIn: 'available' | 'unavailable' | 'disabled';
    project: 'available' | 'unavailable' | 'disabled';
    user: 'available' | 'unavailable' | 'disabled';
  };
}
```

---

# 54. Aggregation Failure

## 54.1 特定Viewのみ失敗

例えばUser-Agent View生成中に内部エラーが発生したが、Path / Status Viewは生成済みの場合。

原則として、

```text
status = partial
```

とする。

失敗したViewは空配列として正常扱いにせず、Errorへ明示する。

必要に応じてGroup AvailabilityをTop Levelへ持つ。

```typescript
interface ObservationGroupAvailability {
  path: 'available' | 'failed' | 'disabled' | 'unsupported';
  sourceIp: 'available' | 'failed' | 'disabled' | 'unsupported';
  sourceIpPath: 'available' | 'failed' | 'disabled' | 'unsupported';
  status: 'available' | 'failed' | 'disabled' | 'unsupported';
  method: 'available' | 'failed' | 'disabled' | 'unsupported';
  userAgent: 'available' | 'failed' | 'disabled' | 'unsupported';
  time: 'available' | 'failed' | 'disabled' | 'unsupported';
}
```

これにより、

```text
空配列 = 0件
```

と

```text
View生成失敗
```

を区別できる。

---

## 54.2 Aggregation全体失敗

主要Aggregationが生成できずObservationSetとして意味を持たない場合はFatal。

例：

- Path Group生成不能
- 集計データ構造破損
- 全View生成不能

---

# 55. Selection / Size Control Failure

Selection処理で一部観点の候補抽出だけ失敗した場合はRecoverableとする。

ただしTotal LimitやTruncation Summaryの整合性を保証できない場合はFatalとする。

ObservationSetが、

```text
どこまで省略されたか不明
```

な状態でAIへ渡ることを避ける。

---

# 56. Redaction Failure

## 56.1 基本方針

Redaction失敗は安全性に直結するため、通常のRecoverable Errorとして扱わない。

Redaction対象データを安全に処理できない場合はFatalとする。

```text
status = failed
```

理由：

- Token
- Email
- Session ID
- API Key

等がObservationSetへ残る可能性があるため。

---

## 56.2 一部SampleだけRedaction不能

対象Sample自体を破棄することで安全を保証できる場合はRecoverableとする。

例：

```text
Referrer Sample 1件の構造解析に失敗
→ Sample自体をObservationSetへ入れない
```

Warningへ記録する。

生値をそのまま残すFallbackは禁止する。

---

# 57. Serialization Failure

ObservationSet生成後、JSON serializationに失敗した場合はFatal。

不完全なJSONや一部Fieldを削除した状態でAIへ送らない。

Transport層で再試行する場合も、Analyzer出力自体は同一である必要がある。

---

# 58. Memory / Large Log Failure

## 58.1 基本方針

大規模ログによるMemory不足でプロセスが落ちる設計を避ける。

Analyzerは可能な限りStreaming / Incremental Aggregationを前提とする。

```text
Raw Log
  ↓
Line-by-line Parse
  ↓
Incremental Aggregate
```

全Parsed Entryをメモリへ保持することを初期前提にしない。

---

## 58.2 Memory Limit接近

内部的にMemory Guardを設ける場合、Aggregationの整合性を保ったまま安全に処理を中断できる必要がある。

中途半端なAggregationを正常ObservationSetとして返してはならない。

安全にPartialとして返せる条件が明確でない場合はFatalとする。

---

## 58.3 File Size Limit

アプリケーション側でUpload Size Limitを設ける場合、Analyzer実行前に拒否する。

```text
FILE_TOO_LARGE
```

と、

```text
Analyzer処理中Memory不足
```

を混同しない。

---

# 59. Internal Exception

未分類例外はFatalとする。

```text
ANALYZER_INTERNAL_ERROR
```

ユーザー向けレスポンスにStack Traceを直接含めない。

内部ログには、

- Error Code
- Stage
- Correlation ID
- Stack Trace
- Configuration Version
- ObservationSet Version

等を記録可能にする。

---

# 60. Failure Matrix

| Failure | Status | ObservationSet | Notes |
|---|---|---|---|
| 一部行Parse失敗 | partial | 返す | Parse Summary必須 |
| 全行Parse失敗 | failed | 返さない | Unsupported扱い含む |
| 一部Field欠損 | partial | 返す | 利用可能Viewのみ |
| Configuration不正 | failed | 返さない | Silent fallback禁止 |
| Built-in Known Info読込失敗 | partial | 返す | Annotationなし |
| Project/User Known Info失敗 | partial | 返す | Source状態明示 |
| 特定Aggregation View失敗 | partial | 条件付きで返す | Availability明示 |
| Aggregation全体失敗 | failed | 返さない | |
| Redaction失敗 | failed | 返さない | 安全優先 |
| Safe Sample Dropで回避可能 | partial | 返す | Sample破棄 |
| Serialization失敗 | failed | 返さない | |
| Memory不足 | failed | 原則返さない | 安全なPartial条件がない限り |
| 未分類内部例外 | failed | 返さない | |

---

# 61. Partial ResultとAI

AIへ渡せるのは、

```text
status = success
```

または、

```text
status = partial
```

のみ。

`partial`の場合、AI入力にはAnalyzerExecutionResultのWarning / Error Summaryも含める。

AIは、

```text
一部データを解析できなかった
Known Informationが利用できなかった
特定Viewが生成できなかった
```

等を説明に反映する。

AIが不足情報を推測で補完してはならない。

---

# 62. ObservationSetへの追加項目

Failure Mode設計を受け、ObservationSetへ次を追加する。

```typescript
interface ObservationSet {
  version: string;

  source: ObservationSourceSummary;

  parse: ParseSummary;

  availability: ObservationAvailability;

  groups: ObservationGroups;

  knownInformation: KnownInformationSetSummary;

  truncation: TruncationSummary;

  redaction: RedactionSummary;

  exclusions: ExclusionSummary;
}
```

```typescript
interface ObservationAvailability {
  groups: ObservationGroupAvailability;
}
```

これにより、

- Disabled
- Unsupported
- Failed
- Available

を空配列と区別できる。

---

# 63. Error Handling Testing

## 63.1 Parse

- 1行失敗でpartialになる
- 全行失敗でfailedになる
- Partial Fieldで利用可能Viewだけ生成する
- failedLinesを0件アクセスとして扱わない

## 63.2 Known Information

- Built-in Store失敗でもAggregation継続
- Source状態がObservationSetへ残る
- AIへKnown Information欠損が伝わる

## 63.3 Aggregation

- 1 View失敗時にAvailabilityがfailedになる
- 空配列との区別ができる
- 全体失敗時にObservationSetを返さない

## 63.4 Redaction

- Redaction失敗時に生値をFallbackしない
- Sample破棄で安全確保できる場合のみpartial
- Raw SecretがObservationSetへ残らない

## 63.5 Memory

- File Size Limit超過を実行前に検出
- Memory Errorを正常完了扱いしない
- Incremental Aggregationで大規模Inputを処理できる

---

# 64. Error Handling確定事項

1. Analyzer結果は`success / partial / failed`を明示する。
2. ObservationSetとExecution Statusは分離する。
3. 一部Parse失敗はpartialで返せる。
4. 全体Parse失敗はfailedとする。
5. 不正Configurationはfailedとする。
6. Known Information障害は原則partialで継続する。
7. View単位失敗はAvailabilityを明示する。
8. Redactionの安全を保証できない場合はfailedとする。
9. 生Sensitive ValueへのFallbackは禁止する。
10. 大規模ログはIncremental Aggregationを前提とする。
11. 不完全なAggregationを正常結果として返さない。
12. Partial ResultをAIへ渡す場合は欠損情報も必ず渡す。
13. AIは欠損情報を推測で補完しない。
14. Empty GroupとUnavailable Groupを区別する。

---

# 65. 次の設計対象

Error Handling / Failure Modeまで整理したため、次は**Performance / Resource Strategy**を最終整理する。

対象：

- Streaming Parse
- Incremental Aggregation
- Group数増大
- High-cardinality Path / IP / UA
- Selection前メモリ使用量
- Known Information Matching Cost
- ObservationSet生成コスト
- 大規模ログでの計算量
- 上限設定

目的は高速化そのものではなく、Analyzerが大量ログでも予測可能なResource使用量で動作できる設計にすることである。


# 66. Performance / Resource Strategy

## 66.1 目的

AnalyzerのPerformance設計では、単純な高速化よりも、

```text
入力サイズが大きくなっても
Resource使用量が予測可能であること
```

を優先する。

初期実装では、次を避ける。

- 全Parsed Entryのメモリ保持
- 全Path / IP / UAの詳細Sample保持
- Selection前の無制限Group保持
- Known Informationの全Entry総当たり
- ObservationSet生成時の重複コピー

Analyzerは大量ログを、

```text
Parse
↓
Incremental Aggregate
↓
Compact
↓
ObservationSet
```

へ縮約していく構造とする。

---

## 66.2 Streaming Parse

Raw Logは可能な限りLine-by-lineで処理する。

```text
Read Line
↓
Parse
↓
Normalize
↓
Exclusion
↓
Aggregate Update
↓
Discard Parsed Entry
```

各Parsed Entryを配列へ蓄積しない。

例外として、Parse Warning Sample等の上限付きSampleのみ保持する。

---

## 66.3 Incremental Aggregation

各Aggregation Viewは逐次更新可能な構造にする。

例：

```typescript
interface MutablePathAggregate {
  requestCount: number;

  sourceIps: SetLikeCounter;

  methodDistribution: CountMap<string>;

  statusDistribution: CountMap<number>;

  userAgents: SetLikeCounter;

  firstSeen?: string;

  lastSeen?: string;
}
```

実装では、正確なDistinct CountにSetを使うと高カーディナリティ時にMemoryを消費する。

初期実装では、ログ規模に応じて正確性とMemoryのバランスを検証する。

ただし、初期段階からApproximate Algorithmを前提にはしない。

---

## 66.4 Aggregation Complexity

基本集計は1行あたり定数回の更新を目標とする。

概念的には、

```text
O(n)
```

で処理する。

`n`はLog Line数。

各行について、

- Path
- Source IP
- Source IP × Path
- Status
- Method
- User-Agent
- Time Bucket

を更新する。

View数は固定のため、Log Line数に対して線形となる。

---

## 66.5 High Cardinality

特に次はGroup数が増えやすい。

```text
Path
Source IP
Source IP × Path
User-Agent
```

Status / MethodはCardinalityが低いため大きな問題になりにくい。

最も注意が必要なのは、

```text
Source IP × Path
```

である。

最悪の場合、

```text
Request Count ≒ Group Count
```

になり得る。

---

## 66.6 Group Count Guard

Aggregation中にGroup数を監視する。

```typescript
interface AggregationResourceConfiguration {
  maxGroups: {
    path: number;
    sourceIp: number;
    sourceIpPath: number;
    userAgent: number;
  };
}
```

ただし、この上限を超えたGroupを単純に捨てると集計結果が不正になる。

そのため上限超過時の挙動は明示的に定義する。

---

## 66.7 初期方針: Group Guard超過はFailure

初期実装では、Group Guardを超えた場合にApproximate Aggregationへ暗黙移行しない。

結果：

```text
status = failed
```

または、安全にView単位で停止できる場合は、

```text
status = partial
```

とする。

理由：

- 上位Groupだけ残す方式では後から重要なGroupが現れる可能性がある
- Count 1件のKnown Information一致を落とす可能性がある
- 集計精度が入力順に依存する
- Analyzer結果の再現性が下がる

Approximate Strategyは将来拡張とする。

---

## 66.8 Source IP × Path View

このViewはMemory負荷が最も高いため、初期実装でも個別に無効化可能とする。

```yaml
aggregation:
  views:
    sourceIpPath: true
```

大規模ログ向けConfigurationでは、

```text
sourceIpPath = false
```

にする余地を持つ。

ただし、標準Configurationでは有効を維持する。

---

## 66.9 Distinct Count Strategy

Distinct Source IP / Path / UAを正確に数える場合、Setが必要になる。

例：

```text
Path Group
  distinctSourceIpCount
```

単純なSetはCardinalityが増えるほどMemoryを消費する。

初期実装では次の順で対応する。

1. 実ログ規模でMemory Profileを測る
2. 問題が確認された場合のみApproximate Distinct Countを検討する
3. Approximate化する場合はObservationSetへその事実を明示する

HyperLogLog等を初期設計へ固定しない。

---

## 66.10 Sample Collection

SampleはReservoir Sampling等を初期必須にしない。

初期実装では、

```text
First N unique sample
```

または、

```text
Count上位N
```

など、Groupごとに決めた単純方式を使用する。

重要なのはSample上限を超えて保持しないこと。

Sampleの完全な統計代表性は初期要件ではない。

---

## 66.11 Top N生成

Selection用のTop Nを生成するために、Aggregation中に常時Heapを更新する方式と、Aggregation後にSortする方式が考えられる。

初期実装では、

```text
Aggregation完了
↓
候補GroupをSort
↓
Top N
```

を基本とする。

理由：

- 実装が単純
- 同一Groupが複数観点で使える
- Selection Reasonの統合が容易
- 初期性能検証がしやすい

Group数が非常に大きくSortが問題になる場合、Heap等へ最適化する。

---

## 66.12 Selection Complexity

Group数を`g`とすると、単純Sortは、

```text
O(g log g)
```

となる。

Path / IP / UA等のViewごとに実行される。

Aggregationの`O(n)`に比べ、Group数が非常に多い場合にSelection Costが支配的になる可能性がある。

実測で確認する。

---

## 66.13 Known Information Matching Cost

Known Information MatchingはRaw Log各行ではなく、Aggregation後のUnique Pathへ対して行う。

```text
Raw Line Count = n
Unique Path Count = p

Known Information Matching Cost
nではなくpに対して実行
```

これによりMatching回数を大幅に抑える。

---

## 66.14 Exact Matching

Exact MatchingはHash Mapで管理する。

```typescript
Map<NormalizedPath, KnownInformationEntry[]>
```

概念的には、

```text
O(1)
```

Lookupを目標とする。

---

## 66.15 Prefix Matching

Prefix Entry数が少ない初期Datasetでは単純走査でも許容できる。

ただしProject / User Entry増大を考慮し、Store内部で実装方式を隠蔽する。

将来的には、

- Trie
- Prefix Index

等へ変更可能にする。

AnalyzerはMatching実装を知らない。

---

## 66.16 Known Information Cache

同一Normalized PathへのKnown Information Lookup結果は、Aggregation Group単位で1回だけ取得する。

Raw Log LineごとのCacheは不要。

Known Information StoreがExternal APIへ依存しない初期設計のため、複雑なDistributed Cacheも不要。

---

## 66.17 Time Bucket Cost

各Lineについて有効なBucket数だけ更新する。

初期設定：

```text
1分
5分
```

であれば、1 Lineあたり2 Bucket更新。

Bucket種類を無制限に追加できるConfigurationにはしない。

Validationで上限を設ける。

例：

```typescript
maxTimeBucketDefinitions: 5
```

---

## 66.18 ObservationSet生成

ObservationSet生成時にAggregationSet全体をDeep Copyしない。

Selected GroupのみImmutableな出力構造へ変換する。

```text
AggregationSet
↓
Selected Group IDs
↓
Selected GroupのみProjection
↓
ObservationSet
```

これによりOutput生成時のMemory Spikeを抑える。

---

## 66.19 Known Information Snapshot Copy

Known Informationも一致Entry全体を複製しない。

ObservationSetに必要なFieldだけProjectionする。

```text
id
label
description
technology
commonPurpose
source
isPrimary
```

Store内部Metadata等は含めない。

---

## 66.20 Serialization

ObservationSetはAIへ送信する前にSerializationされる。

サイズ制御後のObservationSetのみserializeする。

AggregationSet全体をJSON化してから削る方式は禁止する。

---

## 66.21 ObservationSet Size Measurement

Group数だけでなく、最終JSON Sizeも測定できるようにする。

```typescript
interface ObservationSetResourceSummary {
  selectedGroupCount: number;

  serializedBytes?: number;
}
```

Token Countの厳密計算はAnalyzer必須責務にしない。

ただしAI Transport層で必要に応じてToken Estimateを行える。

---

## 66.22 Token Budgetとの境界

Analyzerは、

```text
ObservationSetを一定サイズまで圧縮
```

する。

AI Model固有のToken Budgetに合わせた最終調整はTransport / AI層の責務とする。

理由：

- Model変更でToken上限が変わる
- AnalyzerとAI Providerを結合させない
- 同じObservationSetをUI表示にも使用できる

---

## 66.23 File I/O

可能な場合、File全体をMemoryへ読み込まない。

```text
Stream
Buffered Reader
Line Iterator
```

等を利用する。

Compressed Log対応を行う場合も、全展開してMemoryへ載せない方式を優先する。

---

## 66.24 Parallelization

初期実装では過度なParallelizationを行わない。

理由：

- Group更新の同期が複雑になる
- Memory使用量が増える
- 再現性検証が難しくなる
- 単一Upload解析ではI/O + Hash Updateが中心になる可能性が高い

まずSingle Process / Incremental Aggregationで実測する。

必要性が確認された場合のみ、

- Chunk Parse
- Partial Aggregate
- Merge

方式を検討する。

---

## 66.25 Partial Aggregate Merge

将来Parallel化する場合も、Aggregation ViewはMerge可能な構造を維持する。

```text
Chunk A Aggregate
Chunk B Aggregate
Chunk C Aggregate
      ↓
Aggregate Merge
```

Count / Distribution / First Seen / Last Seen等はMerge可能である。

Distinct Set等は実装方式によってMerge戦略が必要になる。

このため、Aggregate APIは将来的に`merge()`可能な設計を意識する。

---

## 66.26 Performance Instrumentation

Development / Profiling用途として次を測定可能にする。

```text
inputBytes
lineCount
parseDuration
aggregationDuration
knownInformationDuration
selectionDuration
observationSetBuildDuration
peakGroupCount
finalGroupCount
serializedObservationSetBytes
```

これらはユーザー向けObservationSet必須項目ではない。

内部Performance Metricとして扱う。

---

## 66.27 Resource Limitとユーザー表示

Resource Limitにより解析できなかった場合、

```text
ログに問題がありませんでした
```

と表示してはならない。

Errorとして、

```text
解析対象が大きすぎるため処理を完了できませんでした
```

等を明示する。

具体的なUI文言はOutput / UI設計側で定義する。

---

# 67. Performance Configuration

初期例：

```typescript
interface AnalyzerResourceConfiguration {
  maxInputBytes: number;

  maxGroups: {
    path: number;
    sourceIp: number;
    sourceIpPath: number;
    userAgent: number;
  };

  maxTimeBucketDefinitions: number;
}
```

これをAnalyzer Configurationへ統合する。

```typescript
interface AnalyzerConfiguration {
  version: string;

  aggregation: AggregationConfiguration;

  selection: SelectionConfiguration;

  samples: SampleConfiguration;

  time: TimeConfiguration;

  redaction: RedactionConfiguration;

  knownInformation: KnownInformationConfiguration;

  exclusions: ExclusionConfiguration;

  resources: AnalyzerResourceConfiguration;
}
```

---

# 68. 初期Resource Limitの扱い

具体的な数値は、設計段階で固定しない。

理由：

- 実装言語
- Hosting Memory
- Log Format
- 平均Path長
- Cardinality
- Source IP × Path比率

で必要Memoryが大きく変わるため。

初期実装後にBenchmark Logを用いて決定する。

つまり、

```text
maxGroups.path = 100000
```

のような根拠のない値を本仕様では決めない。

---

# 69. Benchmark Strategy

少なくとも次のSynthetic / Realistic Datasetで確認する。

## 69.1 Small

```text
10,000 lines
```

一般的な運用ログ。

## 69.2 Medium

```text
100,000 lines
```

Path / IPが一定数存在。

## 69.3 Large

```text
1,000,000 lines
```

Streaming / Incremental Aggregation確認。

## 69.4 High Cardinality

```text
100,000 lines
100,000 unique Path
```

Path Group Guard確認。

## 69.5 High IP × Path Cardinality

```text
100,000 lines
ほぼ全Lineが異なるIP × Path
```

最悪ケース確認。

## 69.6 Known Information Heavy

大量Pathの中に少数のKnown Information一致が存在するケース。

Countが1でもSelectionへ残ることを確認する。

---

# 70. Performance Testing

## 70.1 Streaming

- 全Parsed EntryをMemoryに保持しない
- Line-by-lineでAggregation更新できる
- Input Size増加に対しMemoryが不必要に線形増加しない

## 70.2 Group Guard

- Group Limit到達を検出する
- Silent Dropしない
- Input順で結果が変化するApproximate化を行わない

## 70.3 Selection

- Group数増大時もSelection結果が正しい
- Duplicate Mergeが正しい
- ObservationSet Total Limitが守られる

## 70.4 Known Information

- MatchingがUnique Path単位で行われる
- Exact MatchingがIndex利用できる
- Prefix MatchingがStore内部へ隠蔽される

## 70.5 Output

- Selected GroupだけProjectionする
- AggregationSet全体をDeep Copyしない
- Serialization後Sizeを測定可能

---

# 71. Performance / Resource確定事項

1. AnalyzerはStreaming Parseを基本とする。
2. Parsed Entry全件をMemoryに保持しない。
3. AggregationはIncrementalに更新する。
4. 基本計算量はLog Line数に対してO(n)を目標とする。
5. High Cardinality Viewを明示的に認識する。
6. Source IP × Pathが最もMemory負荷の高いViewである。
7. Group Guardを設ける。
8. Guard超過時にSilent Dropしない。
9. Approximate Aggregationへ暗黙移行しない。
10. Approximate Distinct Countは初期必須としない。
11. Known Information MatchingはUnique Pathに対して行う。
12. Exact MatchingはIndex化可能な構造とする。
13. ObservationSet生成時に全AggregationをDeep Copyしない。
14. AI Model固有Token調整はTransport / AI層の責務とする。
15. Resource Limitの具体値はBenchmark後に決める。
16. Performance Metricを内部計測可能にする。
17. 同一Input / Configで結果の再現性を維持する。

---

# 72. 次の設計対象

Performance / Resource Strategyまで完了したため、次は**Testing Strategyの最終統合**を行う。

これまで章ごとに定義した、

- Parse
- Aggregation
- Known Information
- Selection
- Redaction
- ObservationSet
- Configuration
- Error Handling
- Performance

のTestingを、Unit / Integration / Property / Benchmarkの観点で整理する。

目的はTest Caseを増やすことではなく、実装時にどの層で何を保証するかを明確にすることである。


# 73. Testing Strategy Final Integration

## 73.1 目的

これまで各章で定義してきたTesting項目を、実装レイヤーごとに整理する。

目的はTest Case数を増やすことではない。

次を明確にする。

1. 単一関数・単一責務で保証するもの
2. 複数Stageを通して保証するもの
3. 入力の組み合わせに対して一般則として保証するもの
4. Resource / Performanceとして保証するもの

Testing Strategyは次の4層に分ける。

```text
Unit Test
Integration Test
Property Test
Benchmark / Resource Test
```

---

# 74. Unit Test

## 74.1 Parser

保証対象：

- 対応Log Formatを正しくParseできる
- 欠損Fieldを誤補完しない
- Unsupported Formatを検出できる
- Partial Parseを正しく表現できる
- Timestamp / Method / Path / Status等を正しく抽出できる

代表Case：

```text
正常行
一部Field欠損
不正Request Line
空行
想定外Column
```

---

## 74.2 Normalizer

保証対象：

- PathとQueryを分離する
- Query違いが同一Normalized Pathへまとまる
- PathのCaseを勝手に変更しない
- Decode / Encodeの扱いが一貫している
- Normalization後も意味を壊さない

NormalizerはKnown Information MatchingとAggregationの基盤になるため、独立してTestする。

---

## 74.3 Exclusion Matcher

保証対象：

- Exact Path
- Prefix Path
- Source IP
- Disabled Exclusion

Exclusion後に対象EntryがAggregationへ渡らないことを確認する。

---

## 74.4 Redaction

保証対象：

- Query Parameter値Redaction
- Referrer Query Redaction
- Case Insensitive Parameter名
- User追加Parameter
- Replacement文字列
- Redaction失敗時に生値を残さない

特に、

```text
token=secret-value
```

等のRaw Sensitive ValueがObservationSetへ残らないことを直接検証する。

---

## 74.5 Known Information Matching

保証対象：

- Exact
- Prefix
- Case Sensitive
- Source Priority
- Disable Override
- Primary選択

次の誤一致を防ぐ。

```text
/.git/
```

Prefixが、

```text
/.github/
```

へ誤一致しないこと等。

---

## 74.6 Aggregation

Viewごとに独立してTestする。

### Path

- requestCount
- distinctSourceIpCount
- Method Distribution
- Status Distribution
- Query Variant Count
- First / Last Seen

### Source IP

- requestCount
- distinctPathCount
- topPaths
- Status Distribution

### Source IP × Path

- requestCount
- Query Variant
- Method / Status
- Reference用Key

### Status / Method / UA / Time

各ViewのCount / Distribution / Top N素材が正しいこと。

---

## 74.7 Selection

保証対象：

- 観点別Top N
- Duplicate Merge
- Selection Reason統合
- Known Information Candidate
- Total Limit
- Representative最低保持
- Truncation計数

SelectionはPriorityを生成しないこともTestする。

---

## 74.8 Group Reference

保証対象：

- Selected Group間のみReference生成
- 省略GroupへのReferenceを残さない
- groupId一意
- Reference先Typeが正しい

---

# 75. Integration Test

## 75.1 Parse → Aggregation

実際の複数行Logを入力し、

```text
Parse
↓
Normalize
↓
Exclusion
↓
Aggregation
```

までの結果を確認する。

単一関数では見えない、

- Query統合
- Exclusion後件数
- Partial Parse
- Time Bucket

等を検証する。

---

## 75.2 Aggregation → ObservationSet

```text
AggregationSet
↓
Selection
↓
Known Information
↓
Redaction
↓
Reference
↓
ObservationSet
```

を通し、最終Schemaが期待どおりになることを確認する。

---

## 75.3 Representative Cases

Chapter 30で定義した代表ケースをIntegration Testとして固定する。

対象：

- `/wp-login.php` 少数
- `/.git/config` 1件
- 特定Path大量
- 同一IPから多数Path
- 404多数
- 5xx少数集中
- Sensitive Query
- Parse Warning
- Truncation

これらはRegression Testとして継続的に利用する。

---

## 75.4 Partial Result

一部Parse失敗、一部Known Information障害、一部View失敗などで、

```text
status = partial
```

かつ利用可能なObservationSetが返ること。

同時にMissing / Failed状態が明示されることを確認する。

---

## 75.5 Fatal Result

次ではObservationSetを正常結果として返さない。

- Unsupported Format
- Invalid Configuration
- Redaction Safety Failure
- Aggregation全体失敗
- Serialization失敗

---

# 76. Property Test

## 76.1 Count Conservation

Exclusionなし・Parse成功行について、

```text
totalRequestCount
```

と各低Cardinality Viewの合計が矛盾しないこと。

例えばStatus Groupが利用可能なら、

```text
sum(status.requestCount)
=
parsed aggregatable request count
```

となる。

---

## 76.2 Distribution Conservation

各Path Groupで、

```text
sum(methodDistribution)
=
requestCount
```

```text
sum(statusDistribution)
=
requestCount
```

が成立する。

Field欠損時は対象Distribution自体のAvailabilityを考慮する。

---

## 76.3 Truncation Consistency

常に、

```text
totalGroups
=
selectedGroups + omittedGroups
```

が成立する。

---

## 76.4 Determinism

同一Input + 同一Configuration + 同一Known Information Datasetなら、

```text
同一ObservationSet
```

を生成する。

Group ID生成方式がRandomの場合でも、内容比較可能なStable Test用ID方式を持つか、IDを除外して比較できるようにする。

---

## 76.5 No Semantic Fields

ObservationSetへ、

```text
severity
priority
attackType
intent
riskScore
```

が追加されていないことをSchema Testで保証する。

設計思想のRegression防止として扱う。

---

## 76.6 Redaction Invariant

Redaction対象ParameterのRaw ValueはObservationSet文字列全体に存在しない。

Serialization後JSONに対して直接検証する。

---

## 76.7 Selection Independence

Selection Reasonが変わってもAggregation Count自体は変化しない。

Selection処理がAggregationを変更しないことを保証する。

---

# 77. Schema / Contract Test

## 77.1 ObservationSet Schema

必須項目：

- version
- source
- parse
- availability
- groups
- knownInformation
- truncation
- redaction
- exclusions

を常に持つ。

---

## 77.2 Version Compatibility

ObservationSet VersionごとにFixtureを保持する。

AI / Transport層は対応Versionを明示する。

未知Versionを暗黙に処理しない。

---

## 77.3 Known Information Snapshot

Fixtureに保存されたObservationSetは、Store更新後も内容が変わらない。

Store参照型ではなくSnapshot型になっていることを保証する。

---

# 78. Benchmark / Resource Test

## 78.1 Dataset

Performance章で定義した、

- Small
- Medium
- Large
- High Cardinality
- High IP × Path Cardinality
- Known Information Heavy

を固定Benchmark Datasetとして利用する。

---

## 78.2 測定項目

最低限、

```text
inputBytes
lineCount
totalDuration
parseDuration
aggregationDuration
knownInformationDuration
selectionDuration
observationSetBuildDuration
peakMemory
peakGroupCount
serializedObservationSetBytes
```

を測定可能にする。

---

## 78.3 性能合否

初期仕様書では、

```text
100万行を5秒以内
```

のような根拠のない固定SLAを設定しない。

まずBenchmark結果を収集する。

その後、

- Hosting環境
- 想定Upload Size
- UX要件

を踏まえて目標値を決める。

---

## 78.4 Memory Regression

同一Benchmark Datasetに対し、実装変更でPeak Memoryが大幅増加した場合に検知できるようにする。

厳密なCI Fail Thresholdは実装後に決める。

---

# 79. Test Fixture Strategy

## 79.1 小さな明示Fixture

Unit / Integrationでは、数行〜数十行の読めるLogを使用する。

Test失敗時に人が期待値を確認できることを優先する。

---

## 79.2 Synthetic Large Fixture

BenchmarkではGeneratorを使用して大量Logを作成可能にする。

巨大なLog FixtureをGit Repositoryへ大量保存しない。

Generator Seedを固定し、再現可能にする。

---

## 79.3 Real Log Sanitization

実アクセスログをRegression Testへ利用する場合、

- IP
- Query
- Referrer
- User-Agent中の識別情報
- Token

等をSanitizeする。

実Client LogをそのままRepositoryへ保存しない。

---

# 80. Golden ObservationSet

代表Integration Caseでは、期待するObservationSetをGolden Fixtureとして保持できる。

ただし全文Snapshot Testだけに依存しない。

理由：

- Field追加時に大量差分が出る
- 意味のあるRegressionを見落とす
- Group順序変更等で壊れやすい

そのため、

```text
重要Fieldの明示Assert
+
必要箇所のみGolden Snapshot
```

を併用する。

---

# 81. Failure Injection

Recoverable / Fatal境界をTestするため、次を意図的に発生させられるようにする。

- Known Information Store Error
- 1 View Aggregation Error
- Redaction Error
- Serialization Error
- Resource Guard超過

内部DependencyをInterface化し、Test DoubleでFailureを注入できる構造が望ましい。

---

# 82. Testing責務の境界

Analyzer TestではAIの説明文品質を評価しない。

Analyzerが保証するのは、

```text
ObservationSetが正しいこと
```

まで。

AI Testでは、

- ObservationSetの事実を捏造しない
- Known Informationと観測事実を分離する
- Partial / Truncationを無視しない
- 次に確認すべき事項を説明する

等をAI Architecture側でTestする。

---

# 83. Testing Strategy確定事項

1. TestingはUnit / Integration / Property / Benchmarkの4層で整理する。
2. Parser / Normalizer / Aggregation等はUnitで保証する。
3. ObservationSet生成全体はIntegrationで保証する。
4. Chapter 30の代表ケースをRegression Testとして固定する。
5. Count / Distribution / Truncation整合性をProperty Testで保証する。
6. 同一Input / Config / DatasetでDeterministicであることを保証する。
7. Sensitive ValueがSerialization後にも残らないことを保証する。
8. ObservationSetにSemantic Fieldが混入しないことをSchema Testする。
9. Benchmarkの固定SLAは実測前に決めない。
10. Large FixtureはGenerator中心とする。
11. 実ログはSanitizeして利用する。
12. Golden Snapshotだけに依存しない。
13. Recoverable / Fatal FailureをInjection Testする。
14. AI説明品質はAnalyzer Testingの責務外とする。

---

# 84. 08_Detection_Rulesの位置付け再整理

本章は当初`Detection Rules`を設計する目的で開始した。

しかし設計検討の結果、Analyzer側で、

```text
Rule
Severity
Priority
Intent
```

を持つと、

- 観測事実と意味判断が混在する
- 技術固有Ruleが増える
- Threshold根拠が曖昧になる
- AI説明責務と重複する

ことが明確になった。

そのため最終的なAnalyzer設計は、

```text
Parse
Normalize
Group
Aggregate
Known Information Annotation
Selection
Redaction
Size Control
ObservationSet
```

へ収束した。

つまり、本章の重要な結論は、

```text
Detection Ruleを詳細化した結果、
Rule層を置かない設計に到達した
```

ことである。

---



# 84.1 横断レビューによる補正

09〜11との横断レビューで、Known Informationの処理順を再確認した。

Known Information一致は`known_information`というSelection Reasonとして利用するため、処理順は必ず、

```text
Aggregation
↓
Known Information Annotation
↓
Selection
```

でなければならない。

`Selection → Known Information Annotation`という記述は不整合であり、本版で修正した。

また、AnalyzerはUrgencyを一切生成しない。Urgencyは09 / 11で定義するAI側の説明情報であり、08のObservationSetには追加しない。

# 85. 次の設計対象

08でAnalyzer出力とその周辺責務が十分に固まったため、次は次章へ進む。

候補は、

```text
09_AI_Explanation
```

または既存ドキュメント構成に合わせたAI説明 / Output設計章とする。

次章ではObservationSetを入力として、

- 何を「観測事実」として説明するか
- Known Informationをどう使うか
- 可能性と断定をどう分離するか
- Partial / Truncationをどう明示するか
- ユーザー向けに「今見るべきこと」をどう組み立てるか

を設計する。

Analyzer側で再び意味判定を追加しないことを前提とする。

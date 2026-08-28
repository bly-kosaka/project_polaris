# Project Polaris
# 28_Development_Setup_and_Second_Sprint
## Sprint 2 実装指示・受入基準

---

# 1. 目的

Sprint 1では、以下を完成させた。

```text
Repository
↓
Local Environment
↓
Domain Status
↓
Streaming Reader
↓
Parser
↓
Normalizer
↓
Parse Summary / Warning
↓
Synthetic Fixture Test
```

Sprint 2では、Analyzer Coreを次の段階まで進める。

```text
Normalized Access Log Entry
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
```

Sprint 2の目的は、

> **Access LogをStreaming処理した結果から、AIやUIが利用できるObservationSetを生成できるAnalyzer Coreを完成させること**

である。

---

# 2. Sprint 2 Scope

対象：

```text
E04 Aggregation
E05 Known Information
E06 Candidate Selection / ObservationSet
```

実装する：

```text
Aggregation Engine
Path Aggregation
Source IP Aggregation
Source IP × Path Aggregation
Status Aggregation
Method Aggregation
User-Agent Aggregation
Time Aggregation
Response Size Summary
First / Last Seen
Distribution

Known Information
Built-in Source
Project Source
User Source
Exact Match
Prefix Match
Priority Resolution
Annotation

Candidate Selection
Selection Reason
Deduplication

Redaction
Size Control
Truncation Metadata

Reference Resolution

ObservationSet Schema
ObservationSet Validation

Synthetic Fixture / Unit Test / Integration Test
```

---

# 3. Sprint 2で実装しないもの

以下は明示的にScope外とする。

```text
Prisma Persistence
Database Repository
Object Storage
Upload API
Fastify Analysis API
BullMQ
Worker Job
Raw Log Deletion
AI Provider
OpenAI
AI Explanation
AI Chat
Authentication
Authorization
Clerk
Stripe
Billing
Vue Aggregation UI
Analysis Result UI
Report Export
Production Deployment
```

Sprint 2では、

```text
Input
= AsyncIterable<string> または Normalized Entry Stream

Output
= ObservationSet
```

というAnalyzer Core単体を完成させる。

---

# 4. 最重要Architecture Rule

Polarisの正式Pipeline：

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
```

順序を変更しない。

特に、

```text
Aggregation
↓
Known Information Annotation
↓
Candidate Selection
```

とする。

Known InformationをRaw Line単位で全件照合しない。

Candidate Selection前にRisk判定を行わない。

Reference ResolutionはSelection後に行う。

---

# 5. Analyzerが行わないこと

Sprint 2でもAnalyzerは意味判断を行わない。

禁止：

```text
Severity
Priority
Risk Score
Health Score
Urgency
Intent
Attack Type
Bot判定
Attack判定
Normal判定
Likely Safe
Incident Pattern
Recommendation
Next Action
```

Countも評価値にしない。

```text
Count = Fact
```

であり、

```text
Count → Low / Medium / High
Count → Severity
Count → Priority
```

の変換を実装しない。

---

# 6. Sprint 1との接続

Sprint 1で完成したProduction API：

```typescript
parseAccessLogStream()
```

を利用する。

概念：

```typescript
await parseAccessLogStream(lines, {
  onEntry(entry) {
    aggregation.consume(entry);
  }
});
```

Production Pipelineで、

```typescript
NormalizedAccessLogEntry[]
```

を全件保持しない。

Aggregation EngineはIncremental Consumerとして実装する。


---

# 6.1 Exclusion Stage（除外処理）

正式Pipelineに従い、NormalizerとAggregationの間にExclusionを置く。

```text
parseAccessLogStream()
↓
Normalized Entry
↓
Exclusion
↓
Aggregation
```

Sprint 2では最低限、以下を実装する。

```text
Path Exact
Path Prefix
Source IP
```

Exclusionは安全判定ではない。

```text
「分析対象から外す設定」
```

としてのみ扱う。

除外されたEntryはAggregationへ渡さない。

最低限、次を保持する。

```typescript
interface ExclusionSummary {
  excludedEntryCount: number;
  byReason?: Array<{
    ruleId: string;
    count: number;
  }>;
}
```

Raw LineやSensitive ValueをExclusionSummaryへ保存しない。

ObservationSetにはExclusionSummaryを含め、AI/UIが「何件が解析対象外になったか」を確認できるようにする。

Exclusion Ruleが0件の場合はIdentity Stageとして動作する。


---

# 7. Aggregation Engine

推奨Interface概念：

```typescript
interface AggregationEngine {
  consume(entry: NormalizedAccessLogEntry): void;
  build(): AggregationSet;
}
```

または同等の責務分離でよい。

重要なのは、

```text
1 Entry
↓
consume()
↓
内部集計State更新
↓
Entryを破棄
```

となることである。

Raw Entryを全件保存しない。

---

# 8. Standard Aggregation Views

Sprint 2必須：

```text
Path
Source IP
Source IP × Path
Status
Method
User-Agent
Time
```

最低でもこの7 Viewを生成可能にする。

---

# 9. Path Aggregation

Path Groupで保持する候補：

```text
id
path
requestCount
distinctSourceIpCount
distinctUserAgentCount
queryVariantCount
methodDistribution
statusDistribution
referrerDistribution
responseSizeSummary
firstSeen
lastSeen
timeDistribution
sampleSourceIps
sampleQueries
knownInformation
```

全項目を機械的に実装するより、

1. Sprint 2 Acceptanceに必要
2. ObservationSetで利用する
3. UI / AI入力に必要

の順に優先する。

Path文字列は勝手に同一化しない。

禁止例：

```text
lowercase強制
末尾slash統一
連続slash統一
```

QueryはPathから分離する。

---

# 10. Source IP Aggregation

候補：

```text
id
sourceIp
requestCount
distinctPathCount
distinctUserAgentCount
methodDistribution
statusDistribution
responseSizeSummary
firstSeen
lastSeen
timeDistribution
topPaths
```

Source IPが取得できないEntryを、

```text
unknown
```

という1つのIPへ統合しない。

欠損は欠損として扱う。

---

# 11. Source IP × Path Aggregation

候補：

```text
id
sourceIp
path
requestCount
queryVariantCount
methodDistribution
statusDistribution
distinctUserAgentCount
firstSeen
lastSeen
timeDistribution
knownInformation
```

ObservationSetで選択された場合、

```text
Path Group
Source IP Group
```

へのReferenceを持てるようにする。

---

# 12. Status Aggregation

最低：

```text
status
requestCount
```

必要なら、

```text
firstSeen
lastSeen
```

程度を追加してよい。

ただし、

```text
404 = Warning
500 = Critical
```

のようなSemantic Mappingを行わない。

---

# 13. Method Aggregation

最低：

```text
method
requestCount
```

Methodも評価しない。

```text
POST = dangerous
```

のような意味付けをAnalyzerへ入れない。

---

# 14. User-Agent Aggregation

最低：

```text
userAgent
requestCount
distinctPathCount
distinctSourceIpCount
```

User-Agent分類はしない。

禁止：

```text
browser
bot
crawler
attacker
human
```

へのAnalyzer独自分類。

原文文字列をAggregation Keyとして扱う。

---

# 15. Time Aggregation

必須Bucket：

```text
1 minute
5 minutes
```

保持：

```text
bucketStart
requestCount
```

必要に応じて、

```text
distinctSourceIpCount
distinctPathCount
statusDistribution
```

を追加可能。

ただし、

```text
spike
anomaly
abnormal
```

等の判定をAnalyzerは行わない。

---

# 15.1 Time Bucket Truncation

1分Bucketと5分Bucketは別Resolutionとして扱う。

一方を優先してもう一方を全て消す設計は避ける。

推奨：

```text
1m limit
5m limit
```

を別Configとして持つ。

Truncation Metadataも、

```text
time1m
time5m
```

を別々に保持する。

これにより長期間Logでも両Resolutionが存在することを保証する。

---

# 16. Distribution

Distributionは、

```text
Map<Key, Count>
```

等の内部表現からObservationSet向けの安定した構造へ変換する。

Sort順を明示する。

同数時のSortもDeterministicにする。

同じInputから毎回同じObservationSetが生成されることを重視する。

---

# 17. Response Size Summary

最低候補：

```text
count
total
min
max
average
```

必要以上のStatistics Libraryを導入しない。

Median / PercentileはMVP必須ではない。

---

# 18. First / Last Seen

Timestampを利用可能なGroupでは、

```text
firstSeen
lastSeen
```

を更新する。

Timestamp欠損Entryを推測補完しない。

---

# 19. Known Information

初期Target：

```text
Path
```

Source：

```text
user
project
built_in
```

Priority：

```text
user > project > built_in
```

Match：

```text
exact
prefix
```

Regexは禁止。

---

# 20. Known Information Data

概念：

```typescript
interface KnownInformation {
  id: string;
  target: 'path';
  source: 'user' | 'project' | 'built_in';
  matchType: 'exact' | 'prefix';
  pattern: string;
  title: string;
  description?: string;
}
```

重要：

Known Informationには以下を保存しない。

```text
severity
priority
risk
attack
urgency
```

`Priority Resolution`は、

> どのSourceのKnown Informationを優先するか

という意味であり、Security Priorityではない。

---

# 21. Known Information Matching

処理順：

```text
Aggregation完成
↓
Unique Aggregated Path
↓
Known Information Match
↓
Annotation
```

Raw Lineごとに照合しない。

同じPathへ複数SourceがMatchした場合：

```text
user
↓
project
↓
built_in
```

で解決する。

Exact / Prefix競合時のルールを明文化し、Testする。

推奨：

```text
Source Priorityを先に評価
同一Source内では exact を prefix より優先
prefix同士ではより具体的な長いpatternを優先
```

このルールは実装時に固定し、TestでDeterministicにする。

---

# 22. Candidate Selection

AIへ全Groupを送らない。

Candidate Selectionは、

```text
重要度判定
```

ではなく、

```text
ObservationSetへ含めるGroupを選ぶ
```

処理。

---

# 23. Selection Axes

必須候補：

```text
Known Information Match
Request Count
Distinct Source IP
Distinct Path
4xx
5xx
POST
Response Size
Representative
```

全Viewへ全軸を適用する必要はない。

適用可能なGroupへだけ適用する。

---

# 24. Selection Reason

概念：

```typescript
type SelectionReason =
  | 'known_information'
  | 'request_count'
  | 'distinct_source_ip'
  | 'distinct_path'
  | 'status_4xx'
  | 'status_5xx'
  | 'method_post'
  | 'response_size'
  | 'representative';
```

名称は実装時に多少調整可能。

重要なのは、

```text
Selection Reason
≠ Priority
≠ Severity
≠ Risk
```

であること。

---

# 25. Deduplication

同じGroupが複数軸で選択された場合：

```text
Groupは1つ
Selection Reasonは複数
```

例：

```json
{
  "id": "path:/wp-login.php",
  "selectionReasons": [
    "known_information",
    "request_count",
    "method_post"
  ]
}
```

Scoreへ変換しない。

---

# 26. Selection Limit

Selection件数はConfigとして外出しする。

例：

```typescript
interface CandidateSelectionConfig {
  requestCountLimit: number;
  distinctSourceIpLimit: number;
  distinctPathLimit: number;
  clientErrorLimit: number;
  serverErrorLimit: number;
  postLimit: number;
  responseSizeLimit: number;
  representativeLimit: number;
}
```

数値は、

```text
危険Threshold
```

ではなく、

```text
AI Input Size Control
```

のための件数上限。

Config値を意味評価へ利用しない。

---

# 27. Representative Selection

Representativeは、

```text
各Viewから最低限の代表例を残す
```

目的。

全てのSelection Axisに該当しないGroupが存在しても、

```text
そのViewにはこういうDataも存在する
```

とAI/UIが理解できるようにする。

Representativeも安全判定ではない。

---

# 28. Redaction

RedactionはObservationSet構築時に行う。

最低対象Parameter名：

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

Value：

```text
[REDACTED]
```

へ置換する。

---

# 29. Query Redaction

例：

```text
/search?q=polaris&token=abc123
```

Observation Sample：

```text
q=polaris&token=[REDACTED]
```

Parameter名比較はCase-insensitiveを推奨。

Malformed Queryを無理に再構築しない。

安全にRedactionできない場合：

```text
SampleをDrop
```

する。

---

# 30. Referrer Redaction

ReferrerにもQuery Stringが含まれる可能性がある。

同じRedaction Policyを利用できる構造にする。

Raw Referrerを無条件でObservationSetへ永続化しない。

---

# 30.1 Bounded Sampleの正確性

Sample用のbounded structureはMemoryを制限する必要があるが、

```text
容量到達後は未知Keyを一切受け付けない
```

方式を「頻度上位Sample」として扱ってはならない。

この方式では入力前半のUnique値に強く偏り、後半で大量出現した値を観測できないためである。

次のどちらかを採用する。

### A. 単純Sample

```text
first-N deterministic sample
```

として明示し、Frequency / Topという意味を持たせない。

### B. Bounded Heavy-Hitter

Space-Saving / Misra-Gries等のbounded algorithmを利用し、

```text
approximate
```

であることをType / Field名 / Documentationで明示する。

MVPではAでもよい。

正確なCountとして見える値に不完全なFrequencyを入れない。

---

# 31. Sample Limit

Sampleは無制限に保持しない。

Config例：

```text
sampleSourceIpLimit
sampleQueryLimit
sampleReferrerLimit
topPathLimit
```

Aggregation中も上限を意識する。

ObservationSet生成時だけ削る方式では、大量のUnique値をMemory保持する可能性があるため注意する。

---

# 32. Size Control

ObservationSet全体について、

```text
Total Group
Selected Group
Omitted Group
```

を把握可能にする。

Silent Truncationは禁止。

---

# 33. Truncation Metadata

概念：

```typescript
interface TruncationSummary {
  truncated: boolean;
  views: {
    [viewName: string]: {
      totalGroups: number;
      selectedGroups: number;
      omittedGroups: number;
    };
  };
}
```

Known Information一致Groupを省略した場合は、それも分かる形にする。

---

# 34. Reference Resolution

Reference Resolution：

```text
Candidate Selection
↓
Deduplication
↓
Selected Group Set確定
↓
Reference Resolution
```

ReferenceのためにOmitted Groupを復活させない。

---

# 35. Group ID

StableなGroup IDを生成する。

候補：

```text
path:<encoded-key>
source-ip:<encoded-key>
source-ip-path:<encoded-source-ip>:<encoded-path>
status:<status>
method:<method>
user-agent:<hash-or-stable-key>
time:1m:<timestamp>
time:5m:<timestamp>
```

ID生成方式は、

```text
Deterministic
Collision回避
Sensitive Valueの不用意な露出回避
```

を満たすこと。

特にUser-Agent全文をIDへそのまま埋め込まない方がよい。

---

# 36. Group References

MVPで必要なRelation：

```text
Source IP × Path
  → Path Group
  → Source IP Group
```

Reverse Referenceは作らない。

Generic Graphを作らない。

---

# 37. ObservationSet

ObservationSetはAnalyzerの公開Artifact。

概念構造：

```typescript
interface ObservationSet {
  schemaVersion: string;

  overview: ObservationOverview;

  parseSummary: ParseSummary;

  aggregations: {
    paths: SelectedPathGroup[];
    sourceIps: SelectedSourceIpGroup[];
    sourceIpPaths: SelectedSourceIpPathGroup[];
    statuses: StatusGroup[];
    methods: MethodGroup[];
    userAgents: SelectedUserAgentGroup[];
    time: TimeAggregation;
  };

  truncation: TruncationSummary;

  redaction: RedactionSummary;

  knownInformation: KnownInformationSummary;

  references: ObservationReferenceSummary;
}
```

実際の型は既存Domain設計と整合させて調整してよい。

---

# 38. ObservationSet禁止Field

禁止：

```text
severity
priority
riskScore
urgency
intent
attackType
nextAction
conclusion
```

Analyzer生成値として存在させない。

---

# 38.1 Fatal時のObservationSet Contract

AnalyzerStatusが`failed`となるFatal条件では、ObservationSetを正常成果物として生成・返却しない。

Fatal例：

```text
Unsupported Format
全行Parse失敗
Invalid Configuration
Redaction Safety Failure
Aggregation全体失敗
ObservationSet Serialization / Validation Failure
```

したがってTop-level Analyzer APIは、成功/PartialとFatalを型で分離する。

推奨：

```typescript
type AnalyzeAccessLogResult =
  | {
      analyzerStatus: 'success' | 'partial';
      observationSet: ObservationSet;
    }
  | {
      analyzerStatus: 'failed';
      observationSet?: never;
      errorCode: string;
      parseSummary?: ParseSummary;
    };
```

`failed + empty ObservationSet`を「正常なObservationSet」として返さない。

---

# 39. ObservationSet Validation

ObservationSetはValidation可能にする。

Zod採用可。

最低確認：

```text
schemaVersion
Parse Summary整合
Group ID uniqueness
Reference target exists when present
Truncation count整合
Selection Reason validity
Forbidden semantic fieldなし
```

---

# 40. Error Handling

Sprint 2で新しくFatal判定を増やしすぎない。

Parser Fatal：

```text
usable line = 0
```

はSprint 1のまま。

Aggregationの特定Viewが生成できない場合：

```text
Unavailable View
Data Limitation
```

として扱える設計を優先する。

1 Viewの欠損で全解析Fatalとしない。

---

# 41. Test Strategy

Sprint 2必須：

```text
Unit Test
Fixture Test
Incremental Aggregation Test
Known Information Match Test
Selection Test
Deduplication Test
Redaction Test
Truncation Test
Reference Resolution Test
ObservationSet Validation Test
Memory Sanity Test
Determinism Test
```

---

# 42. Aggregation Test

最低確認：

```text
Path requestCount
Source IP requestCount
Source IP distinctPathCount
Source IP × Path requestCount
Status count
Method count
User-Agent count
1m bucket
5m bucket
firstSeen
lastSeen
```

---

# 43. Known Information Test

最低：

```text
built_in exact
built_in prefix
project override
user override
exact / prefix conflict
Count=1 match
no match
```

Severity等がKnown Informationに存在しないこともTypeまたはTestで担保する。

---

# 44. Selection Test

最低：

```text
Known Information Count=1 remains selected
Request Count top
4xx top
5xx top
POST top
Response Size top
multiple reason dedupe
no weighted score
```

Selection順がDeterministicであること。

---

# 45. Redaction Test

最低：

```text
password
token
email
session_id
case-insensitive parameter name
multiple parameters
referrer query
malformed query
```

Raw Sensitive ValueがObservationSetへ残っていないことを確認する。

---

# 46. Truncation Test

最低：

```text
totalGroups
selectedGroups
omittedGroups
truncated
```

の整合。

Silent omissionを許さない。

---

# 47. Reference Test

最低：

```text
selected Source IP × Path
↓
selected Path
selected Source IP
```

へのReference生成。

TargetがSelectionされていない場合：

```text
Referenceを作らない
```

Omitted Groupを復活させない。

---

# 48. Memory Sanity

大量Synthetic EntryをGeneratorで作る。

確認：

```text
Raw Entry全件を保持しない
Query Sample無制限保持しない
Referrer Sample無制限保持しない
Source IP Sample無制限保持しない
```

Group CardinalityそのものによるMemory消費はAggregationの性質上存在する。

ただし、

```text
Raw Lines × N
Raw Entries × N
Unlimited Samples
```

の追加保持をしない。

---

# 49. Determinism

同一Input / Config / Known Informationから、

```text
同一Aggregation
同一Selection
同一ObservationSet
```

が生成されること。

Map iteration order等へ偶然依存しない。

Sortルールを明示する。

---

# 50. Sprint 2 Tasks

```text
S2-01 Aggregation Type設計
S2-02 Incremental Aggregation Engine
S2-02A Exclusion（Path Exact / Prefix / Source IP）
S2-03 Path Aggregation
S2-04 Source IP Aggregation
S2-05 Source IP × Path Aggregation
S2-06 Status / Method Aggregation
S2-07 User-Agent Aggregation
S2-08 Time Aggregation
S2-09 Response Size / First Last Seen
S2-10 Aggregation Fixture Test

S2-11 Known Information Type
S2-12 Exact / Prefix Matcher
S2-13 Source Priority Resolution
S2-14 Aggregation Annotation
S2-15 Known Information Test

S2-16 Candidate Selection Config
S2-17 Selection Axes
S2-18 Selection Reason / Deduplication
S2-19 Representative Selection
S2-20 Selection Test

S2-21 Query / Referrer Redaction
S2-22 Sample / Size Control
S2-23 Truncation Metadata
S2-24 Redaction / Truncation Test

S2-25 Stable Group ID
S2-26 Reference Resolution
S2-27 ObservationSet Schema
S2-28 ObservationSet Validation
S2-29 Integration Test
S2-30 Memory / Determinism Test
```

---

# 51. Sprint 2 Acceptance Criteria

Sprint 2完了条件：

## Aggregation

```text
Path                         PASS
Source IP                    PASS
Source IP × Path             PASS
Status                       PASS
Method                       PASS
User-Agent                   PASS
Time 1m                      PASS
Time 5m                      PASS
Response Size                PASS
First / Last Seen            PASS
Streaming Compatibility      PASS
Exclusion Stage               PASS
Exclusion Summary             PASS
```

## Known Information

```text
built_in                     PASS
project                      PASS
user                         PASS
user > project > built_in    PASS
exact                        PASS
prefix                       PASS
regexなし                    PASS
Aggregation後Annotation      PASS
Count=1 Match保持            PASS
```

## Candidate Selection

```text
Known Information            PASS
Request Count                PASS
Distinct Source IP           PASS
Distinct Path                PASS
4xx                          PASS
5xx                          PASS
POST                         PASS
Response Size                PASS
Representative               PASS
Multi Reason Dedup           PASS
Weighted Risk Scoreなし      PASS
```

## Redaction / Size

```text
Sensitive Query Redaction    PASS
Referrer Redaction           PASS
Unsafe Sample Drop           PASS
Sample Limit                 PASS
Truncation Metadata          PASS
Silent Truncationなし        PASS
```

## Reference

```text
Selection後に解決            PASS
Omitted Group復活なし        PASS
SourceIP×Path → Path         PASS
SourceIP×Path → SourceIP     PASS
```

## ObservationSet

```text
Schema                       PASS
Validation                   PASS
Group ID uniqueness          PASS
Reference validity           PASS
Parse Summary保持            PASS
Truncation保持               PASS
Redaction Summary保持        PASS
Exclusion Summary保持         PASS
Known Information保持        PASS
Semantic Fieldなし           PASS
Fatal時ObservationSetなし     PASS
```

---

# 52. Sprint 2 Definition of Done

```text
Synthetic Access Log
↓
Streaming Read
↓
Parse
↓
Normalize
↓
Incremental Aggregation
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
```

が自動Testで成功する。

さらに、

```text
yarn typecheck
yarn lint
yarn test
yarn build
yarn workspace @polaris/analyzer test
```

が成功する。

---

# 53. Sprint 2での設計変更Rule

実装中に設計との差異が必要になった場合：

```text
コードを独自判断で変更
```

ではなく、

```text
設計上の問題
or
実装上の問題
```

を分類する。

実装上の問題なら設計を変えずに修正する。

設計上の問題なら、理由を報告してから関連Markdownを更新する。

---

# 54. Claude Code Implementation Prompt

以下をClaude Codeへ渡す。

```text
Project Polaris Sprint 2を実装してください。

Sprint 1は完了済みです。

対象Repository:
bly-kosaka/project_polaris

必ず最初に以下を読んでください。

- md/07_Analyzer_Architecture.md
- md/08_Detection_Rules.md
  ※ファイル名は旧名称ですが、本文タイトルは08_Analyzer_Aggregationです。
- md/12_Architecture_Reconciliation.md
- md/13_Analysis_Data_Model.md
- md/20_MVP_Implementation_Plan.md
- md/25_MVP_Backlog_and_Acceptance_Criteria.md
- md/26_Development_Setup_and_First_Sprint.md
- md/27_Sprint_1_Review.md
- md/28_Development_Setup_and_Second_Sprint.md

Sprint 2の対象は、
E04 Aggregation
E05 Known Information
E06 Candidate Selection / ObservationSet
のみです。

実装TaskはS2-01〜S2-30です。

最重要ルール:

- AnalyzerはFactを集計するだけで意味判断しない
- Severity / Priority / Risk / Urgency / Intent / Attack Typeを生成しない
- Countを評価値として利用しない
- Weighted Risk Scoreを作らない
- Sprint 1のparseAccessLogStream()をProduction Pipelineとして利用する
- NormalizedAccessLogEntry[]を全件保持しない
- NormalizerとAggregationの間にExclusion Stageを置く
- ExclusionはPath Exact / Path Prefix / Source IPを最低限実装する
- Exclusion SummaryをObservationSetへ保持する
- AggregationはIncremental Consumerとして実装する
- Known InformationはAggregation後にAnnotationする
- Known InformationのSource Priorityは user > project > built_in
- Matchはexact / prefixのみ
- Regexを実装しない
- Known InformationへSeverity等を保存しない
- Candidate Selectionは重要度判定ではなくInput Size Control
- Selection ReasonをPriority扱いしない
- 同一GroupはDeduplicateし複数Selection Reasonを保持する
- RedactionはObservationSet構築前に必ず行う
- Sensitive ValueをRawのままObservationSetへ残さない
- Redaction不能SampleはDropする
- Fatal時にempty ObservationSetを正常成果物として返さない
- analyzerStatus='failed'ではObservationSetなしのdiscriminated unionとする
- Bounded Sampleで不完全なFrequencyを正確なTop Countのように見せない
- 1m / 5m Time Bucketは別々にTruncationする
- Silent Truncationを行わない
- Reference ResolutionはSelection後
- ReferenceのためにOmitted Groupを復活させない
- Generic Graph / Reverse Referenceを作らない
- ObservationSetへsemantic fieldを追加しない
- Sprint 2 Scope外のDB/API/Worker/AI/Auth/Billing/UIを実装しない
- 不要なFrameworkや抽象化を追加しない

Production Pipeline:

Access Log
↓
parseAccessLogStream()
↓
Incremental Aggregation
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

実装前に必ず、

1. 実装計画
2. 作成・変更File一覧
3. 新規依存Package
4. 各S2 Taskとの対応
5. 設計上の不明点
6. Memory上の注意点

を提示してください。

設計上の不明点がなければ実装へ進んでください。

完了時には、

- S2-01〜S2-30の実装状況
- Acceptance Criteria
- Test結果
- CI結果
- Memory Sanity結果
- 未完了項目
- 設計との差異
- Sprint 3へ進めるか

を報告してください。
```

---

# 55. Claude Code Review Prompt

Sprint 2実装後：

```text
Project Polaris Sprint 2の実装を設計書に照らしてレビューしてください。

必ず確認してください。

Architecture:
- Production PipelineがStreamingか
- Normalized Entryを全件保持していないか
- AggregationがIncrementalか
- AnalyzerにSemantic Judgmentが混入していないか

Aggregation:
- Path
- Source IP
- Source IP × Path
- Status
- Method
- User-Agent
- Time 1m / 5m
- Response Size
- First / Last Seen
- Distribution

Known Information:
- Aggregation後にAnnotationしているか
- exact / prefixのみか
- user > project > built_inか
- Severity / Priority / Risk等を持っていないか
- Count=1でもCandidateへ残せるか

Candidate Selection:
- Weighted Risk Scoreが存在しないか
- Selection Reasonが複数保持できるか
- Deduplicationされるか
- Selection Configが危険Thresholdとして利用されていないか
- Representativeが意味判断になっていないか

Redaction:
- Query Sensitive Parameterが[REDACTED]になるか
- Referrerも対象か
- Raw Sensitive ValueがObservationSetへ残らないか
- Redaction不能SampleをDropするか
- Sampleを無制限保持していないか

Truncation:
- Total / Selected / Omittedが分かるか
- Silent Truncationがないか

Reference:
- Selection後に解決するか
- Omitted Groupを復活させないか
- Source IP × PathからPath / Source IPへの最低限Referenceのみか

ObservationSet:
- Severity
- Priority
- Risk Score
- Urgency
- Intent
- Attack Type
- Next Action
- Conclusion

がAnalyzer生成値として存在しないか。

Test:
- Aggregation
- Known Information
- Selection
- Redaction
- Truncation
- Reference
- Validation
- Memory Sanity
- Determinism

を確認してください。

Critical / Major / Minorに分類してください。

各指摘は、

File:
Problem:
Design mismatch:
Impact:
Fix:

の形式で出してください。

最後に、

Sprint 2:
PASS / PASS WITH FIXES / FAIL

Sprint 3:
GO / FIX THEN GO

を判定してください。
```

---

# 56. Sprint 2終了後

Sprint 2がPASSした後に、

```text
Sprint 3
Prisma
Storage
Queue
Worker
Upload Lifecycle
```

へ進む。

Sprint 2中にSprint 3を先回り実装しない。

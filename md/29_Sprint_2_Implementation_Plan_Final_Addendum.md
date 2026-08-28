# Project Polaris
# Sprint 2 Implementation Plan — Final Review Addendum
## Claude Code 実装開始前の最終修正指示

---

# 1. 目的

Sprint 2の修正版実装プランをレビューした結果、前回指摘した以下4点は解消されている。

```text
1. Fatal時にempty ObservationSetを正常成果物として返さない
2. NormalizeとAggregationの間にExclusion Stageを追加
3. 不正確なbounded frequency sampleを廃止
4. 1m / 5m Time Bucketを独立してTruncation
```

修正版プランは基本的に実装開始可能な状態である。

ただし、実装前に以下2点を追加修正すること。

```text
F-01 analyzeAccessLog() のException Boundary
F-02 ExclusionRuleのSource IP型制約
```

この2点をプランへ反映した後は、再度プラン確認を待たずSprint 2実装へ進んでよい。

---

# 2. 総合判定

```text
GO WITH 2 FIXES
```

以下2点を反映後：

```text
GO
```

---

# 3. F-01 analyzeAccessLog() のException Boundary

## 問題

現在のプランでは概ね、

```text
1. parseAccessLogStream()
   └─ onEntry
      ├─ Exclusion
      └─ aggregationEngine.consume()

2. deriveAnalyzerStatus()

3. try
   ├─ engine.build()
   ├─ Known Information
   ├─ Selection
   ├─ Redaction
   ├─ Reference Resolution
   ├─ ObservationSet
   └─ Validation
```

となっている。

しかし、

```typescript
aggregationEngine.consume(entry)
```

は`parseAccessLogStream()`の`onEntry` callback内で実行される。

したがって、

```typescript
aggregationEngine.consume(entry)
```

または、

```typescript
checkExclusion(entry, config)
```

がthrowした場合、

```text
Step 3のtry/catchへ到達しない
```

可能性がある。

その場合、

```text
ANALYZER_AGGREGATION_FAILED
```

等へ変換されず、`analyzeAccessLog()`自体がrejectする可能性がある。

---

# 4. 修正方針

`analyzeAccessLog()`のProduction Pipeline全体をException Boundaryで囲む。

概念：

```typescript
export async function analyzeAccessLog(
  lines: AsyncIterable<string>,
  config: AnalyzeAccessLogConfig = {},
  knownInformationDataset: KnownInformationEntry[] =
    BUILT_IN_KNOWN_INFORMATION_DATASET,
): Promise<AnalyzeAccessLogResult> {
  let parseSummary: ParseSummary | undefined;

  try {
    const exclusionConfig = resolveExclusionConfig(config.exclusion);
    const aggregationConfig = resolveAggregationConfig(config.aggregation);

    const exclusionSummaryBuilder =
      new ExclusionSummaryBuilder();

    const aggregationEngine =
      new AggregationEngine(aggregationConfig);

    parseSummary = await parseAccessLogStream(lines, {
      onEntry(entry) {
        const exclusion =
          checkExclusion(entry, exclusionConfig);

        if (exclusion.excluded) {
          exclusionSummaryBuilder.add(exclusion.ruleId);
          return;
        }

        aggregationEngine.consume(entry);
      },
    });

    const analyzerStatus =
      deriveAnalyzerStatus(parseSummary);

    if (analyzerStatus === 'failed') {
      return {
        analyzerStatus: 'failed',
        errorCode: 'PARSER_NO_VALID_LINES',
        parseSummary,
      };
    }

    const aggregationSet =
      aggregationEngine.build();

    const annotated =
      annotateAggregationSet(
        aggregationSet,
        knownInformationDataset,
      );

    const selected =
      selectCandidates(
        annotated,
        config.selection,
      );

    const redacted =
      redactSelectedGroups(
        selected,
        config.redaction,
      );

    const referenced =
      resolveReferences(redacted);

    const observationSet =
      buildObservationSet({
        ...referenced,
        parseSummary,
        exclusion:
          exclusionSummaryBuilder.build(),
      });

    validateObservationSet(observationSet);

    return {
      analyzerStatus,
      observationSet,
    };
  } catch (error) {
    return mapAnalyzerFailure(
      error,
      parseSummary,
    );
  }
}
```

実際の関数名・責務分割は既存コード構造に合わせて調整してよい。

重要なのは、

> `parseAccessLogStream()`を含むProduction Analyzer Pipeline全体がAnalyzer Failure Boundary内に存在すること

である。

---

# 5. Error Mapping

未知のErrorをすべて、

```text
ANALYZER_AGGREGATION_FAILED
```

へ変換しない。

内部Errorを最低限分類する。

例：

```typescript
class AggregationError extends Error {}

class RedactionSafetyError extends Error {}

class ObservationSetValidationError extends Error {}
```

または、

```typescript
interface AnalyzerInternalError {
  code: AnalyzerErrorCode;
  cause?: unknown;
}
```

等でもよい。

---

# 6. AnalyzerErrorCode

最低候補：

```typescript
type AnalyzerErrorCode =
  | 'PARSER_NO_VALID_LINES'
  | 'PARSER_FAILED'
  | 'ANALYZER_INVALID_CONFIGURATION'
  | 'ANALYZER_AGGREGATION_FAILED'
  | 'ANALYZER_REDACTION_SAFETY_FAILURE'
  | 'ANALYZER_OBSERVATION_SET_INVALID'
  | 'ANALYZER_INTERNAL_ERROR';
```

既存Sprint 1 Error Codeとの整合を優先する。

必要以上にError Class階層を作らない。

---

# 7. Unknown Error

分類不能なErrorは、

```text
ANALYZER_INTERNAL_ERROR
```

等へFallbackする。

禁止：

```text
Unknown Error
↓
Aggregation Failed
```

と決め打ちすること。

---

# 8. Sensitive Error Handling

Error Messageへ以下を含めない。

```text
Raw Log Line
Raw Query
Raw Referrer
Token
Email
Session ID
Authorization
```

外部へ返すのは、

```text
AnalyzerErrorCode
ParseSummary
Safe Metadata
```

を基本とする。

Raw Error ObjectをAPI向けResultへそのまま入れない。

---

# 9. Fatal Contract

Fatal時のResultは引き続き、

```typescript
type AnalyzeAccessLogResult =
  | {
      analyzerStatus: 'success' | 'partial';
      observationSet: ObservationSet;
    }
  | {
      analyzerStatus: 'failed';
      observationSet?: never;
      errorCode: AnalyzerErrorCode;
      parseSummary?: ParseSummary;
    };
```

とする。

以下は禁止：

```typescript
{
  analyzerStatus: 'failed',
  observationSet: emptyObservationSet
}
```

---

# 10. F-02 ExclusionRuleの型制約

## 問題

現在案：

```typescript
interface ExclusionRule {
  id: string;
  target: 'path' | 'source_ip';
  matchType: 'exact' | 'prefix';
  value: string;
}
```

この型では、

```typescript
{
  id: 'rule-1',
  target: 'source_ip',
  matchType: 'prefix',
  value: '192.0.'
}
```

がTypeScript上合法になる。

しかしSprint 2仕様は、

```text
Path
  exact
  prefix

Source IP
  exact only
```

である。

CIDR / Source IP Prefix MatchingはSprint 2 Scope外。

---

# 11. ExclusionRule修正版

Discriminated Unionとする。

```typescript
type ExclusionRule =
  | {
      id: string;
      target: 'path';
      matchType: 'exact' | 'prefix';
      value: string;
    }
  | {
      id: string;
      target: 'source_ip';
      matchType: 'exact';
      value: string;
    };
```

これにより、

```text
source_ip + prefix
```

をCompile Timeで禁止する。

Runtime Validationを追加する場合も同じConstraintを適用する。

---

# 12. Path Match Shared Primitive

既存プランの、

```text
shared/path-match.ts
```

はそのままでよい。

ただしShared Primitiveが、

```text
Source IP Prefix Matching
```

までGenericに拡張されないようにする。

用途：

```text
Path Exact
Path Prefix
Known Information Path Exact
Known Information Path Prefix
```

Source IPはExact比較のみ。

---

# 13. Exclusion Test追加

最低限：

```text
Path Exact                 PASS
Path Prefix                PASS
Source IP Exact            PASS
Source IP Prefix           Compile Error / Validation Error
No Rule                    PASS
Excluded Entry not aggregated
ExclusionSummary increment
```

Type Testが可能なら、

```typescript
// @ts-expect-error
const invalidRule: ExclusionRule = {
  id: 'invalid',
  target: 'source_ip',
  matchType: 'prefix',
  value: '192.0.',
};
```

等で保証する。

---

# 14. Exception Boundary Test追加

最低限以下をTestする。

```text
Parser Fatal
→ failed
→ PARSER_NO_VALID_LINES
→ observationSetなし

Aggregation consume throws
→ analyzeAccessLog resolves failed result
→ rejectしない
→ ANALYZER_AGGREGATION_FAILED

Redaction Safety Error
→ failed
→ ANALYZER_REDACTION_SAFETY_FAILURE

ObservationSet Validation Error
→ failed
→ ANALYZER_OBSERVATION_SET_INVALID

Unknown Error
→ failed
→ ANALYZER_INTERNAL_ERROR

Error ResultにRaw Log / Query等を含まない
```

---

# 15. 修正版Pipeline

最終Pipeline：

```text
analyzeAccessLog()
│
├─ Exception Boundary
│
├─ parseAccessLogStream()
│   │
│   └─ onEntry
│       │
│       ├─ Exclusion
│       │   ├─ excluded
│       │   │   └─ ExclusionSummary
│       │   │
│       │   └─ included
│       │       └─ AggregationEngine.consume()
│       │
│       └─ Entry破棄
│
├─ ParseSummary
│
├─ Fatal Check
│   └─ failed
│       └─ ObservationSetなし
│
├─ AggregationEngine.build()
│
├─ Known Information Annotation
│
├─ Candidate Selection
│
├─ Redaction / Size Control
│
├─ Reference Resolution
│
├─ ObservationSet Assembly
│
├─ ObservationSet Validation
│
└─ success / partial
```

---

# 16. 既存修正版プランで承認済みの項目

以下は変更不要。

## Streaming

```text
parseAccessLogStream()
↓
onEntry
↓
Exclusion
↓
AggregationEngine.consume()
```

Raw Entryを全件保持しない。

## Exclusion

```text
Path Exact
Path Prefix
Source IP Exact
```

除外件数を`ExclusionSummary`へ保持。

## Aggregation

```text
Path
Source IP
Source IP × Path
Status
Method
User-Agent
Time 1m
Time 5m
```

Incremental Consumer。

## Known Information

```text
Aggregation
↓
Known Information Annotation
```

Source Priority：

```text
user > project > built_in
```

Match：

```text
exact
prefix
```

Regexなし。

## Candidate Selection

Selection Reasonは、

```text
Selection Reason
≠ Priority
≠ Severity
≠ Risk
```

Weighted Scoreなし。

## Sample

正確なTop-Nと参考Sampleを分離。

```text
Top-N
= Exact Count Map

Sample
= First-N distinct
```

`FirstNSample`にはCountを付けない。

## Time Bucket

```text
1m
5m
```

を独立してLimit / Truncationする。

## Redaction

Sensitive Parameter：

```text
[REDACTED]
```

安全にRedactionできないSampleはDrop。

## Reference

```text
Selection
↓
Reference Resolution
```

ReferenceのためにOmitted Groupを復活させない。

## ObservationSet

禁止Field：

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

## Determinism

同一Input / Config / Known Information：

```text
同一ObservationSet
```

を保証する。

---

# 17. 実装開始指示

上記、

```text
F-01 Exception Boundary
F-02 ExclusionRule Type Constraint
```

を現在のSprint 2 Implementation Planへ反映すること。

反映後は、

```text
再度Plan Approvalを待つ必要はない。
```

そのままSprint 2実装を開始してよい。

ただし実装中に、

```text
既存設計と矛盾する
設計変更が必要
ObservationSet Contract変更が必要
Semantic Judgment追加が必要
```

となった場合は実装を止めて報告すること。

単なるImplementation Detailについては、既存設計原則の範囲内で判断してよい。

---

# 18. 完了時報告

Sprint 2実装完了時に以下を報告する。

```text
1. S2-01〜S2-30 + S2-02A 実装状況
2. Acceptance Criteria結果
3. Exclusion Test結果
4. Exception Boundary Test結果
5. Fatal Contract Test結果
6. Aggregation Test結果
7. Known Information Test結果
8. Candidate Selection Test結果
9. Redaction Test結果
10. Truncation Test結果
11. Reference Resolution Test結果
12. ObservationSet Validation結果
13. Memory Sanity結果
14. Determinism Test結果
15. yarn typecheck
16. yarn lint
17. yarn test
18. yarn build
19. yarn workspace @polaris/analyzer test
20. CI結果
21. 未完了項目
22. 設計との差異
23. Sprint 3へ進めるか
```

---

# 19. 最終判定

```text
Sprint 2 Plan
GO WITH 2 FIXES

F-01
Exception BoundaryをProduction Pipeline全体へ拡張

F-02
ExclusionRuleをDiscriminated Union化

反映後
GO
```

# Project Polaris
# 30_Sprint_2_Review
## Sprint 2 実装レビュー

レビュー対象:
- Repository: `bly-kosaka/project_polaris`
- Branch: `main`
- Reviewed Head: `1d3740e688862367534d982763bd51a197268f8b`
- Review Date: 2026-09-01

---

# 1. 総合判定

```text
PASS WITH FIXES
```

Sprint 2の主要Architectureは正しく実装されている。

確認できたもの:

```text
Streaming
Exclusion
Incremental Aggregation
Known Information Annotation
Candidate Selection
Redaction
Independent 1m / 5m Truncation
Reference Resolution
ObservationSet
Fatal Contract
Exception Boundary
Semantic Field禁止
Determinism方針
```

ただし、Candidate Selectionの`ViewTruncation`計算に、高Cardinality InputでAnalyzer全体を`failed`にしてしまう不具合が1件ある。

Sprint 3移行判定:

```text
FIX THEN GO
```

---

# 2. Critical

## C-01 Candidate SelectionのomittedGroups計算がTotal Group数と一致しない

対象:

```text
packages/analyzer/src/selection/select-groups.ts
```

現在、Total Limitを超えない場合:

```typescript
if (deduped.length <= totalLimit) {
  return {
    selected: deduped,
    truncation: {
      totalGroups,
      selectedGroups: deduped.length,
      omittedGroups: 0,
    },
  };
}
```

しかし`totalGroups`は元のAggregation Group総数、`deduped.length`はSelection AxisまたはRepresentativeによってCandidate化されたGroup数。

例:

```text
totalGroups = 1000
candidate / deduped = 65
totalLimit = 80
```

現在の結果:

```text
totalGroups     = 1000
selectedGroups  = 65
omittedGroups   = 0
```

そのため:

```text
selectedGroups + omittedGroups
!=
totalGroups
```

となる。

Total Limit超過時も、

```typescript
omittedGroups: deduped.length - kept.length
```

となっており、Selection Axisに一度も入らなかったGroupを数えていない。

正しくは常に:

```text
omittedGroups = totalGroups - selectedGroups
```

である。

---

# 3. 影響

ObservationSet Validationは、

```text
selectedGroups + omittedGroups = totalGroups
```

を必須Invariantとしている。

高Cardinality Access Logでは、

```text
Candidate Selection
↓
incorrect Truncation Metadata
↓
ObservationSet
↓
validateObservationSet()
↓
ObservationSetValidationError
↓
ANALYZER_OBSERVATION_SET_INVALID
↓
Analyzer failed
```

になる可能性がある。

つまり一般的な高Cardinality Access Logを正常解析できない可能性があるため、Sprint 3前に修正必須。

---

# 4. 修正案

Total Limit未到達:

```typescript
return {
  selected: deduped,
  truncation: {
    totalGroups,
    selectedGroups: deduped.length,
    omittedGroups: totalGroups - deduped.length,
  },
};
```

Total Limit超過:

```typescript
const kept = prioritized.slice(0, totalLimit);

return {
  selected: kept,
  truncation: {
    totalGroups,
    selectedGroups: kept.length,
    omittedGroups: totalGroups - kept.length,
  },
};
```

---

# 5. 必須Regression Test

既存Testは全GroupがCandidate化されやすい条件のため、本不具合を検出できていない。

追加:

```typescript
it('counts groups never selected by any axis as omitted', () => {
  // 100 paths
  // requestCountLimit = 2
  // other axis limits = 0
  // representativeLimit = 1
  // totalLimit = 80
  //
  // selected = 3
  // omitted = 97
  // total = 100
});
```

最低限、

```text
totalLimit未到達
totalLimit超過
```

の両Caseで、

```text
totalGroups = selectedGroups + omittedGroups
```

を検証する。

---

# 6. Minor

## m-01 Config Validationが未実装

`AnalyzerErrorCode`には`ANALYZER_INVALID_CONFIGURATION`があるが、現在のConfig ResolverはDefaultとのMergeのみ。

将来APIからConfigを受け取る前に、

```text
integer
>= 0
finite
```

等のValidationを追加推奨。

Sprint 2修正のBlockerとはしない。

---

# 7. Architecture Check

| 項目 | 判定 |
|---|---|
| Production Pipeline Streaming | PASS |
| Normalized Entry全件保持なし | PASS |
| Exclusion Stage | PASS |
| Path Exact / Prefix | PASS |
| Source IP Exact Only | PASS |
| Exclusion Summary | PASS |
| Incremental Aggregation | PASS |
| Path View | PASS |
| Source IP View | PASS |
| Source IP × Path View | PASS |
| Status View | PASS |
| Method View | PASS |
| User-Agent View | PASS |
| Time 1m | PASS |
| Time 5m | PASS |
| Known Information after Aggregation | PASS |
| user > project > built_in | PASS |
| exact / prefix | PASS |
| Regexなし | PASS |
| Candidate Selection非Weighted Score | PASS |
| Selection Reason複数保持 | PASS |
| Redaction | PASS |
| Unsafe Sample Drop | PASS |
| Sample Limit | PASS |
| Truncation Metadata | FAIL |
| 1m / 5m別Truncation | PASS |
| Reference after Selection | PASS |
| Omitted Group復活なし | PASS |
| Fatal時ObservationSetなし | PASS |
| Exception Boundary | PASS |
| Semantic Fieldなし | PASS |
| CI | PASS |

---

# 8. 前回追加指示の再確認

## F-01 Exception Boundary

`analyzeAccessLog()`全体がtry/catch Boundary内にあり、`parseAccessLogStream()`の`onEntry`内で実行されるExclusion / AggregationもBoundary内。

```text
PASS
```

## F-02 ExclusionRule

Discriminated Unionで、

```text
Path: exact / prefix
Source IP: exact only
```

を型で保証。

```text
PASS
```

---

# 9. Redaction / Known Information / ObservationSet

Redaction:
- Query sensitive parameter → `[REDACTED]`
- Referrer queryも同Policy
- Decode不能SampleはDrop
- Raw Error MessageをFailure Resultへコピーしない

Known Information:
- Aggregation後にPath単位でMatch
- `user > project > built_in`
- `exact > prefix`
- longer prefix優先
- Analyzer Semantic Judgmentなし

ObservationSet Validation:
- schemaVersion
- Group ID uniqueness
- Reference validity
- Truncation arithmetic
- Selection Reason validity
- Forbidden Semantic Field

禁止Field:

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

これらはPASS。

---

# 10. CI

最新main:

```text
1d3740e688862367534d982763bd51a197268f8b
```

GitHub Actions:

```text
Install dependencies  PASS
Type check            PASS
Lint                  PASS
Test                  PASS
Build                 PASS
```

Workflow:

```text
SUCCESS
```

今回のC-01はTest Coverage Gapによって残ったもの。

---

# 11. Sprint 2 Task判定

| Task | 判定 |
|---|---|
| S2-01〜S2-19 | PASS |
| S2-20 Selection Test | PARTIAL |
| S2-21 Redaction | PASS |
| S2-22 Sample / Size Control | PASS |
| S2-23 Truncation Metadata | FAIL |
| S2-24 Redaction / Truncation Test | PARTIAL |
| S2-25 Stable Group ID | PASS |
| S2-26 Reference Resolution | PASS |
| S2-27 ObservationSet Schema | PASS |
| S2-28 ObservationSet Validation | PASS |
| S2-29 Integration Test | PASS |
| S2-30 Memory / Determinism | PASS |

---

# 12. 設計書修正要否

```text
不要
```

今回の問題は実装側のCount計算ミス。

設計の、

```text
Total Group
Selected Group
Omitted Group
Silent Truncation禁止
```

という方針はそのままでよい。

---

# 13. 修正後の再レビュー範囲

全面レビューは不要。

確認対象:

```text
packages/analyzer/src/selection/select-groups.ts
packages/analyzer/src/__tests__/selection-limits.test.ts
必要に応じて truncation.test.ts / analyze-integration.test.ts
```

確認項目:

```text
1. omittedGroups = totalGroups - selectedGroups
2. 未Candidate Groupもomittedへ含む
3. totalLimit未到達Case
4. totalLimit超過Case
5. ObservationSet Validation PASS
6. yarn typecheck
7. yarn lint
8. yarn test
9. yarn build
10. CI PASS
```

---

# 14. 最終判定

```text
Critical  1
Major     0
Minor     1

Sprint 2
PASS WITH FIXES

Sprint 3
FIX THEN GO
```

C-01修正・Regression Test追加・CI PASS後はSprint 3へ進める見込み。

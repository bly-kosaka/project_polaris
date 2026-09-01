# Project Polaris
# 30_Sprint_2_Review
## Sprint 2 再レビュー（C-01修正後）

- Repository: `bly-kosaka/project_polaris`
- Branch: `main`
- Reviewed Head: `ce7cd93469719b7e095afd05cef579b7770b2ed4`
- Review Date: 2026-09-01

---

# 1. 総合判定

```text
PASS
```

```text
Critical  0
Major     0
Minor     1（継続課題・Sprint 2 Blockerではない）
```

Sprint 2:

```text
COMPLETE
```

Sprint 3:

```text
GO
```

---

# 2. C-01 再レビュー

前回指摘:

```text
Candidate SelectionのomittedGroupsが
Candidate化済みGroupだけを基準に計算され、
未Candidate GroupをomittedGroupsへ含めていなかった。
```

修正後はTotal Limit未到達時:

```typescript
omittedGroups: totalGroups - deduped.length
```

Total Limit超過時:

```typescript
omittedGroups: totalGroups - kept.length
```

となっている。

これにより常に、

```text
totalGroups
=
selectedGroups
+
omittedGroups
```

が成立する。

判定:

```text
RESOLVED
```

---

# 3. Regression Test

以下2ケースが追加された。

## Case A: Total Limit未到達

```text
totalGroups      100
selectedGroups     3
omittedGroups     97
```

Selection AxisにもRepresentativeにも入らなかったGroupが
正しく`omittedGroups`へ含まれる。

## Case B: Total Limit超過

```text
totalGroups       50
selectedGroups    10
omittedGroups     40
```

Total Limitによる削減と未Candidate Groupの双方を含めて
Truncation arithmeticが成立する。

判定:

```text
PASS
```

---

# 4. CI

Reviewed Head:

```text
ce7cd93469719b7e095afd05cef579b7770b2ed4
```

GitHub Actions:

```text
Install dependencies  PASS
Type check            PASS
Lint                  PASS
Test                   PASS
Build                  PASS
```

Workflow conclusion:

```text
SUCCESS
```

---

# 5. Sprint 2 Acceptance再判定

前回PARTIAL / FAILだった項目:

| Task | 前回 | 再判定 |
|---|---|---|
| S2-20 Selection Test | PARTIAL | PASS |
| S2-23 Truncation Metadata | FAIL | PASS |
| S2-24 Redaction / Truncation Test | PARTIAL | PASS |

その他のSprint 2項目は前回レビュー時点でPASS。

したがって:

```text
S2-01 ～ S2-30
ALL PASS
```

---

# 6. m-01 Config Validationについて

前回Minor:

```text
Analyzer Config Validation未実装
```

対象例:

```text
negative limit
NaN
Infinity
non-integer
```

`AnalyzerErrorCode`には、

```text
ANALYZER_INVALID_CONFIGURATION
```

が定義されている一方、
現在のConfig ResolverはDefault ConfigとのMergeが中心で、
値自体のRuntime Validationはまだ行っていない。

## 判断

```text
Sprint 2の完了条件には含めない。
Sprint 3着手を止めない。
```

したがって今回未対応で問題ない。

ただし、この課題を無期限に先送りするのは推奨しない。

理由は、今後AnalyzerがAPI / Worker / Persistence等と接続されると、
ConfigがAnalyzer内部だけの値ではなく外部Boundaryを通る可能性が高くなるため。

推奨タイミング:

```text
Sprint 3開始
↓
Persistence / API等からAnalyzer Configを受け取るBoundaryを作る
↓
そのBoundaryへ到達する前にConfig Validationを実装
```

つまり、

```text
Sprint 3着手前の必須修正
```

ではなく、

```text
Sprint 3のHardening Taskとして早めに対応
```

とする。

最低Validation候補:

```text
Selection Limit   integer >= 0
Sample Limit      integer >= 0
Top N Limit       integer >= 0
Total Limit       integer >= 0
数値全般           finite
```

Invalid時:

```text
ANALYZER_INVALID_CONFIGURATION
```

へ分類する。

この対応はArchitecture変更ではなくInput Boundary Hardeningである。

---

# 7. 設計書修正要否

```text
不要
```

C-01は実装不具合として解消済み。

m-01も既存Architectureを変更するものではなく、
Runtime Validation追加で対応可能。

---

# 8. 最終判定

```text
Critical  0
Major     0
Minor     1
```

MinorはSprint 2 BlockerではなくSprint 3継続課題。

最終結果:

```text
SPRINT 2
COMPLETE

SPRINT 3
GO
```

次工程ではSprint 3の実装計画を確定する際に、
`Analyzer Config Validation`をSprint 3のEarly Hardening Taskとして
Backlogへ明示的に組み込む。

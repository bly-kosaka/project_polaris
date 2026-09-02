# Project Polaris
# 33_Sprint_3_Review
## Sprint 3 実装レビュー

- Repository: `bly-kosaka/project_polaris`
- Branch: `main`
- Reviewed Head: `a231aa61e876d1dbe6e5c38abe852887b9272b6e`
- Base: `ce7cd93469719b7e095afd05cef579b7770b2ed4`
- Review Date: 2026-09-01

---

# 1. 総合判定

```text
PASS

Critical  0
Major     0
Minor     1

SPRINT 3
COMPLETE

SPRINT 4
GO
```

MinorはSprint 4着手Blockerではない。

---

# 2. Plan Review F-01〜F-05

```text
F-01 Prisma 7 Setup                 RESOLVED
F-02 Domain Type Ownership          RESOLVED
F-03 Known Information Target       RESOLVED
F-04 DB Test Isolation              RESOLVED
F-05 Transaction Rollback Test      RESOLVED
```

Prisma 7.10.0固定、Domain/Persistence境界分離、KnownInformationTarget Enum、
Vitest file parallelism無効化、実際の2書き目失敗によるRollback証明を確認した。

---

# 3. Analyzer Config Validation

```text
PASS
```

`AggregationConfig` / `CandidateSelectionConfig`の数値項目を
`Number.isInteger(value) && value >= 0`で検証する。

0は合法。

negative / NaN / Infinity / -Infinity / non-integerを拒否し、
Parse開始前に`ANALYZER_INVALID_CONFIGURATION`へ分類する。

Sprint 2 Review m-01は解消。

---

# 4. Persistence Architecture Boundary

```text
PASS
```

`Project` / `Analysis` / `ProjectStatus` / `AnalysisMetadata`は
`packages/domain`が所有する。

Prisma Generated Typeは`packages/db`側に閉じる。

Analyzer Core自身はPrismaへ依存しない。

---

# 5. ObservationSet Persistence

```text
PASS
```

Persist前に`validateObservationSet()`を実行。

Read後もDB JSONを再Validationしてから`ObservationSet`として扱う。

Schemaでは、

```prisma
analysisId String @unique
```

により、

```text
1 Analysis = 1 ObservationSet
```

をDB Constraintでも保証する。

---

# 6. Transaction / Partial / Failed Contract

```text
PASS
```

Success / Partial：

```text
validate ObservationSet
↓
Transaction
├─ ObservationSet INSERT
└─ Analysis Status Update
↓
Commit
```

Partialでも、

```text
Analysis.status = analyzer_result_ready
AnalyzerStatus = partial
```

であり、Top-level `partial`は存在しない。

Failed：

```text
Analysis.status = failed
AnalyzerStatus = failed
ObservationSetRecord = none
```

Failure用FunctionはObservationSet Repositoryを使用しない。

---

# 7. Transaction Rollback

```text
PASS
```

Testは、

```text
Analysis = created
↓
ObservationSet INSERT成功
↓
created → analyzer_result_ready拒否
↓
Transaction Failure
↓
ObservationSet INSERTもRollback
↓
Analysis remains created
```

を確認している。

最初のWrite成功後に2番目のWriteが失敗するAtomicity Testになっている。

---

# 8. Status Transition

```text
PASS
```

Lifecycle：

```text
created
→ uploaded
→ analyzing
→ analyzer_result_ready
→ explaining / completed
```

途中状態から`failed`を許可。

`completed` / `failed`はTerminal。

`created → analyzer_result_ready`は拒否する。

Sprint 3 Scopeとして十分な最小State Guard。

---

# 9. Known Information

```text
PASS
```

Project Known InformationはDBへPersist。

`KnownInformationTarget.PATH`でDB側からTargetを制約。

Analyzer InputへのMapperでは、

```text
source = project
target = path
```

へ変換する。

`enabled = false`はDataset生成時に除外される。

Built-in Known InformationはDB Seedしていない。

---

# 10. Sensitive Logging / Error Mapping

```text
PASS
```

Prisma Clientは、

```typescript
log: ['warn', 'error']
```

であり`query`を有効化していない。

ObservationSet JSON / IP / Query Parameter等をSQL Query Logへ常時出力しない。

Prisma Errorも固定されたDB Error Code / MessageへMappingし、
raw Prisma message/metaをPublic Messageとして使用しない。

---

# 11. PostgreSQL Integration Test / CI

```text
PASS
```

実PostgreSQLでProject / Analysis / Known Information / ObservationSet /
Unique Constraint / Status Transition / Partial / Failed /
Serialization Round-trip / Transaction Rollbackを検証。

Initial MigrationもCommit済み。

Reviewed HeadのGitHub Actions：

```text
Initialize PostgreSQL  PASS
Install                PASS
Type check             PASS
Lint                   PASS
Database migrations    PASS
Test                    PASS
Build                   PASS
```

Workflow conclusion：

```text
SUCCESS
```

---

# 12. Redis Local Port Error

```text
Sprint 3評価対象外
```

Sprint 3はRedis / Queueを使用しない。

PostgreSQL PersistenceのClean Environment Verificationが成立しているため、
Redis `56379`のローカル起動問題はSprint 3 Blockerではない。

ただしSprint 4ではRedis / BullMQがScopeへ入るため、
Sprint 4 Environment Setup時に解消またはPort変更する。

---

# 13. Minor m-01 — `--ignore-engines`

CI / Local Installでは、

```text
yarn install --ignore-engines
```

を使用している。

現状はPrisma transitive dependencyのNode Engine要求との不整合回避であり、
CI / Typecheck / Test / Buildは成功しているためSprint 3 Blockerではない。

ただし`--ignore-engines`はDependency Tree全体のEngine Checkを無効化するため、
将来本当にNode 22等を必要とするDependencyが追加された場合にも
Install時に検知できない可能性がある。

```text
Sprint 4 Blockerにはしない
```

Prisma / Node / Dependency更新時に`--ignore-engines`を外せるか再確認し、
恒久設定として固定しない。

---

# 14. Sprint 3 Acceptance

```text
S3-01 〜 S3-30
ALL PASS
```

---

# 15. 最終判定

```text
Critical  0
Major     0
Minor     1

SPRINT 3
COMPLETE

SPRINT 4
GO
```

---

# 16. Sprint 4重点項目

次Sprint：

```text
Queue
Worker
Temporary Object Storage
Upload Lifecycle
Raw Log Delete
Cleanup / Retry
```

重点レビュー対象：

```text
Job Idempotency
ObservationSet二重生成防止
Raw Log削除順序
ObservationSet Persist成功前のRaw Log削除禁止
Delete Retry
Worker Crash Recovery
Redis Environment
```

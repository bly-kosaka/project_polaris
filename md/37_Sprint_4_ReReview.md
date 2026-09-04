# Project Polaris
# 37_Sprint_4_ReReview
## Sprint 4 修正後再レビュー

レビュー対象HEAD：

```text
fc710fc95672cbcaee9bf5a693a6cdfe34d72796
```

前回レビュー対象HEAD：

```text
804c47bac3c3f5ef5f9cd7af16b25eca75c5fad0
```

## 1. 総合判定

```text
PASS WITH FIXES

Critical  0
Major     2
Minor     1

SPRINT 4
FIX THEN FINAL RE-REVIEW

SPRINT 5
HOLD
```

前回指摘のうち、

```text
C-01  RESOLVED
M-02  RESOLVED
M-03  RESOLVED
M-04  RESOLVED
m-01  RESOLVED
m-02  RESOLVED
```

を確認した。

一方で、M-01の対象として前回明示したFailure Pathが1箇所残っている。
加えて、Fatal Failure Persist成功直後のAnalysisExecution更新失敗時にLifecycleが途中で止まる新規ケースを確認した。

大規模な設計変更は不要。

---

## 2. CI

最新HEADのGitHub Actionsは成功。

```text
Run ID: 33834962567

Initialize containers PASS
Install dependencies PASS
Type check PASS
Lint PASS
Run database migrations PASS
Wait for MinIO PASS
Test PASS
Build PASS
```

---

## 3. C-01 RESOLVED

Fatal Analyzer Resultと、
そのFailure StateをDBへPersistする処理が分離された。

```text
Analyzer Fatal Result
↓
persistAnalyzerFailure
├─ success
│  ↓
│ Raw Log Delete
│ UnrecoverableError
└─ failure
   ↓
   Retryable Path
   ↓
   BullMQ Retry
```

Real BullMQ Workerを使ったFailure Injection Testでも、
Failure Persistの一時失敗後に再試行され、
最終的にAnalysisがfailedへ遷移することを確認。

```text
C-01 RESOLVED
```

---

## 4. M-01 PARTIAL

今回、以下は共通Failure Boundaryへ入った。

```text
Analysis Load
CAS
UploadedAccessLog Load
Storage.exists
AnalysisExecution
Known Information
Storage.getObjectStream
Analyzer
ObservationSet Persist
```

さらにReal BullMQ Testで、

```text
Storage Read transient failure → Retry → success
Storage Read exhaustion → Analysis/Execution failed + Raw Log retained
persistAnalyzerSuccess failure → exhaustion → Analysis failed
```

まで確認済み。

ただし前回M-01で明示した

```text
ObservationSetRepository.findByAnalysisId
```

だけは現在もFailure Boundary外。

現在：

```typescript
const existingObservationSet =
  await observationSetRepository.findByAnalysisId(analysisId);

if (existingObservationSet !== null) {
  ...
  return;
}

try {
  // Claim / Load / Storage / Analyzer / Persist
}
catch {
  ...
}
```

となっている。

### 影響

```text
Analysis = uploaded
Raw Log = exists
ObservationSet = none
```

でObservationSet lookupが全Attempt失敗すると、

```text
BullMQ Job = failed
Analysis = uploaded
Raw Log = exists
```

のまま残る。

データ破壊はしないが、
Queue側のみFailedでDB側は再処理可能な状態となる。

---

## 5. M-01R: Recovery Functionもfailed jobを再実行できない可能性

Analyzer Job IDは固定：

```text
analyzer-${analysisId}
```

BullMQでは、同じcustom jobIdのJobがQueueに残っている場合、
同じIDをaddしても新Jobは追加されない。

現在の`recoverAnalyzerEnqueue()`は：

```text
Analysis uploaded
ObservationSet none
↓
enqueueAnalyzerJob()
↓
'enqueued'
```

のみ。

そのため既存Failed Jobが残っているケースでは、
`enqueued`を返しても実際には再実行Jobが追加されない可能性がある。

### 修正

`recoverAnalyzerEnqueue()`でJob stateを確認する。

```text
No Job
→ enqueue

Waiting / Active / Delayed
→ skipped

Failed
→ retry existing job
  または
→ remove + deterministic IDでre-enqueue
```

戻り値も例えば：

```text
enqueued
retried
skipped
```

とする。

### 必須Test

Real Redis / BullMQで：

```text
Analysis uploaded
↓
ObservationSet lookupを全Attempt失敗
↓
BullMQ failed
↓
Recovery Function
↓
実際に再実行可能状態へ戻る
↓
次実行成功
↓
analyzer_result_ready
```

まで確認する。

```text
M-01 PARTIAL
```

---

## 6. M-02 RESOLVED

`registerCleanupScheduler()`を追加。

```text
maintenanceQueue.upsertJobScheduler
↓
every 1h
↓
cleanup-expired-raw-logs
```

Worker起動時に登録。

Real BullMQ Worker Testで、

```text
Scheduler
↓
Cleanup Job
↓
Worker
↓
expired Raw Log delete
```

まで確認。

```text
M-02 RESOLVED
```

---

## 7. M-03 RESOLVED

Raw Log Delete Failure後のMaintenance enqueue failureが
Analyzer Jobへ逆流しないよう隔離された。

```text
Delete Failure
↓
markDeletionFailed
↓
Maintenance enqueue failure
↓
swallow
↓
Analyzer Result remains valid
```

Real BullMQ Testでも、

```text
Analysis = analyzer_result_ready
ObservationSet exists
deletionStatus = failed
Analyzer Job = completed
```

を確認。

```text
M-03 RESOLVED
```

---

## 8. M-04 RESOLVED

追加：

```text
failure-injection.test.ts
scheduled-cleanup.test.ts
bullmq-test-helpers.ts
prisma-fault-injection.ts
```

Real：

```text
PostgreSQL
Redis
MinIO
BullMQ Queue
BullMQ Worker
```

を利用し、

```text
Fatal Persist transient error
Storage Read retry
Storage Read exhaustion
Persist failure
Retry exhaustion
Maintenance enqueue failure
Scheduled Cleanup
```

を確認。

```text
M-04 RESOLVED
```

---

## 9. Major M-05
### Fatal Failure Persist成功後のAnalysisExecution更新失敗

現在：

```typescript
async function persistFailureAndUpdateExecution(...) {
  try {
    await persistAnalyzerFailure(...);
  } catch (error) {
    return { persisted: false, error };
  }

  await executionRepository.updateProgress(...);

  return { persisted: true };
}
```

問題：

```text
persistAnalyzerFailure SUCCESS
↓
Analysis = failed
↓
AnalysisExecution.updateProgress FAILURE
↓
throw
```

となる。

このErrorは`FinalizeResult`へ変換されず外へthrow。

次Attemptでは：

```text
ObservationSet = none
Analysis.status = failed
↓
Worker status branch
↓
return
↓
BullMQ completed
```

となり得る。

結果：

```text
Analysis = failed
AnalysisExecution = running/stale
Raw Log = retained
BullMQ Job = completed
```

Raw LogはPeriodic Cleanupで最終削除されるためCriticalではないが、

```text
Non-retryable Fatal
→ Failure Persist
→ Raw Log immediate delete
→ Execution failed
→ BullMQ failed(Unrecoverable)
```

という契約は崩れる。

### 修正

`persistAnalyzerFailure()`成功をLifecycle上のCommit Pointとして扱う。

以降の：

```text
Raw Log Delete Reconciliation
AnalysisExecution metadata update
```

は分離する。

例：

```text
persistAnalyzerFailure SUCCESS
↓
Raw Log Delete Reconcile
↓
Execution update best-effort
↓
UnrecoverableError
```

重要：

```text
Execution metadata更新失敗によって
既に成功したFailure Persistを未Persist扱いに戻さない
```

こと。

### 必須Test

```text
Fatal Analyzer Result
↓
persistAnalyzerFailure succeeds
↓
AnalysisExecution.updateProgressだけ失敗
```

確認：

```text
Analysis = failed
ObservationSet = none
Raw Log delete/reconcile attempted
BullMQ = failed via UnrecoverableError
```

```text
M-05 OPEN
```

---

## 10. Minor m-03

Node 20.19.0でCIはPASS。

ただしAWS SDK v3の将来ReleaseではNode >=22が必要になるため、
Node 22 migrationをBacklogに維持する。

Sprint 4 Blockerではない。

---

## 11. Finding Status

```text
C-01   RESOLVED

M-01   PARTIAL
  └─ M-01R ObservationSet preflight / failed-job recovery

M-02   RESOLVED
M-03   RESOLVED
M-04   RESOLVED

M-05   OPEN

m-01   RESOLVED
m-02   RESOLVED
m-03   OPEN / NON-BLOCKING
```

---

## 12. 修正Task

```text
S4-FIX-08
ObservationSet preflight failure後のfailed job recoveryを実装

S4-FIX-09
recoverAnalyzerEnqueueでexisting Failed Jobをretry/requeue可能にする

S4-FIX-10
Preflight failure → failed → recovery → success
のReal BullMQ Integration Test追加

S4-FIX-11
Failure Persist成功後のAnalysisExecution update失敗をLifecycle本体から分離

S4-FIX-12
Fatal Persist success + Execution update failure Regression Test追加
```

---

## 13. Final Re-review条件

必須：

```text
M-01R resolved
M-05 resolved
```

CI：

```text
Typecheck PASS
Lint PASS
Migration PASS
MinIO Health PASS
Tests PASS
Build PASS
```

---

## 14. 最終判定

```text
Architecture                PASS
Happy Path                  PASS
Raw Log Persist/Delete      PASS
Streaming                   PASS
CAS                         PASS
Fatal Persist Retry         PASS
Retry Exhaustion            PASS
Periodic Cleanup            PASS
Maintenance Isolation       PASS
Failure Injection           PASS
CI                          PASS

Preflight Recovery          FIX REQUIRED
Fatal Metadata Failure      FIX REQUIRED
```

最終：

```text
Critical  0
Major     2
Minor     1

SPRINT 4
PASS WITH FIXES

SPRINT 5
HOLD
```

残件は局所的。
Architecture変更は不要で、Worker RecoveryとFailure-finalizationの2点補強でよい。

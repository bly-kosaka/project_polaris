# Project Polaris
# 36_Sprint_4_Review
## Sprint 4 実装レビュー

レビュー対象HEAD：

```text
804c47bac3c3f5ef5f9cd7af16b25eca75c5fad0
```

Sprint 3基準HEAD：

```text
a231aa61e876d1dbe6e5c38abe852887b9272b6e
```

差分：

```text
2 commits ahead
0 behind
```

対象コミット：

```text
c523d30 Add Sprint 4 Queue/Worker/Storage/Upload Lifecycle implementation
804c47b Wire Redis/MinIO into CI and document Sprint 4 setup in README
```

---

# 1. 総合判定

```text
PASS WITH FIXES
```

現時点：

```text
Critical  1
Major     4
Minor     3
```

判定：

```text
SPRINT 4
FIX THEN RE-REVIEW

SPRINT 5
HOLD
```

Sprint 4のArchitecture自体は大部分が正しく実装されている。

特に以下は確認できた。

```text
Queue / Worker分離
Redis Producer / Worker Connection分離
Temporary Object Storage Interface
S3 / MinIO Adapter
Streaming Upload
Streaming Analyzer Input
UploadedAccessLog
AnalysisExecution
CAS
ObservationSet既存Recovery Branch
ObservationSet Persist → Raw Log Delete順序
Delete Retry Queue
Fatal Analyzer Contract
MinIO CI
Redis CI
PostgreSQL CI
205 tests PASS
Typecheck PASS
Lint PASS
Build PASS
```

ただしFailure Pathに、
Product LifecycleをRecovery不能状態へ残す問題があるため、
Sprint 4 COMPLETEとはまだ判定しない。

---

# 2. CI確認

最新HEADのGitHub Actions：

```text
Run ID
33576730427

Conclusion
success
```

成功Step：

```text
Initialize containers
Install dependencies
Type check
Lint
Run database migrations
Wait for MinIO
Test
Build
```

Test：

```text
45 Test Files PASS
205 Tests PASS
```

PostgreSQL / Redis / MinIOも実Containerで起動している。

MinIO：

```text
minio/minio:RELEASE.2025-09-07T16-13-09Z
server /data
```

Runner側：

```text
/minio/health/live
```

確認成功。

F-12は正しく実装済み。

---

# 3. 実装済み主要Invariant

## Raw Log Delete Ordering

Success / Partial：

```text
Analyzer
↓
persistAnalyzerSuccess()
↓
reconcileRawLogDeletion()
```

となっており、

```text
ObservationSet Persist前にRaw Logを削除しない
```

は守られている。

```text
PASS
```

---

# 4. Crash-after-Persist Recovery

Worker開始時：

```text
ObservationSet exists
↓
reconcileRawLogDeletion
↓
reconcileExecutionAfterPersist
↓
return
```

となっている。

このBranchから、

```text
persistAnalyzerSuccess
persistAnalyzerFailure
```

へFall-throughしない。

```text
PASS
```

---

# 5. Streaming

API：

```text
multipart stream
↓
storage.putObject
```

Worker：

```text
storage.getObjectStream
↓
linesFromStream
↓
analyzeAccessLog
```

Full Raw Log Buffer Pathは見当たらない。

```text
PASS
```

---

# 6. CAS

```text
uploaded
↓
compareAndSetStatus
↓
analyzing
```

がDB `updateMany`でAtomic Claimされている。

CAS false時：

```text
re-read
+
attemptsStarted > 1
```

でRetry候補判定。

F-07対応：

```text
PASS
```

---

# 7. UploadedAccessLog State

実装：

```text
create
→ uploaded / pending

Worker Claim
→ processing

Normal Delete
→ deleted / success / deletedAt

Cleanup Delete
→ expired / success / deletedAt

Delete Failure
→ deletionStatus failed
```

F-13対応：

```text
PASS
```

---

# 8. Critical C-01
## Non-retryable Analyzer FailureのDB Persist失敗を握りつぶしている

対象：

```text
apps/worker/src/analyzer-job-handler.ts
```

現在：

```typescript
async function finalizeAsFailed(...) {
  try {
    await persistAnalyzerFailure(...);
  } catch {
    return;
  }

  ...
}

async function handleNonRetryableFailure(...) {
  await finalizeAsFailed(...);
  throw new UnrecoverableError(errorCode);
}
```

問題：

```text
Analyzer Fatal
↓
persistAnalyzerFailure()
↓
DB一時障害
↓
catchしてreturn
↓
UnrecoverableError
↓
BullMQ no retry
```

となる。

結果：

```text
Analysis.status = analyzing のまま
ObservationSet = none
Raw Log = retained
BullMQ Job = permanently failed
再試行なし
```

になり得る。

これはSprint 4で設計した、

```text
DB / Infrastructure Failure
→ Retry
```

と正反対。

さらに、

```text
Non-retryableなのはAnalyzer結果
```

であって、

```text
そのFailure StateをDBへPersistする処理
```

までNon-retryableではない。

---

# 9. C-01 修正方針

`persistAnalyzerFailure()`失敗を握りつぶさない。

例えば：

```text
Analyzer Fatal
↓
persistAnalyzerFailure
```

Success：

```text
Raw Log Delete
Execution failed
UnrecoverableError
```

DB Failure：

```text
Retryable Error
↓
BullMQ Retry
```

と分離する。

重要：

```text
Failure Persist成功前に
UnrecoverableErrorへ変換しない
```

こと。

必須Regression Test：

```text
Fatal Analyzer
↓
persistAnalyzerFailureを一時失敗
↓
Job retryable
↓
Analysisがanalyzingのまま永久停止しない
↓
次Attemptでfailed Persist成功
```

---

# 10. Major M-01
## Worker前半のInfrastructure ErrorがRetry Exhaustion Finalizationを通らない

`handleRetryableFailure()`が使われているのは主に、

```text
persistAnalyzerSuccess()
```

のcatchと、

```text
Analyzer failed result
```

だけ。

しかし以下は外側のRetry Classification Boundaryに入っていない。

例：

```text
analysisRepository.findById
ObservationSetRepository.findByAnalysisId
UploadedAccessLogRepository.findByAnalysisId
storage.exists
AnalysisExecution create/update
ProjectKnownInformation load
storage.getObjectStream
```

これらでErrorがthrowされると、

```text
BullMQ自体はRetry
```

するが、

最終Attemptでも、

```text
Analysis.status = failed
AnalysisExecution.status = failed
```

へFinalizeされない。

特に、

```text
getObjectStream
```

のPermanent Error等では、

```text
Analysis = analyzing
Execution = running
BullMQ = failed
```

が残る可能性がある。

---

# 11. M-01 修正方針

Worker Handler全体に、

```text
Stage-aware Failure Boundary
```

を置く。

ただし、

```text
ObservationSet Persist後のDelete Failure
```

をAnalyzer Failureへ戻してはいけない。

概念：

```text
Claim / Load / Storage Read / Analyzer / Persist
↓
typed Error
↓
classifyRetryability
↓
Retry or Finalize
```

とする。

最低限以下をTest：

```text
Storage getObjectStream transient failure
→ retry

Storage getObjectStream failure on final attempt
→ Analysis failed
→ Execution failed
→ Raw Log retained

Known Information DB failure
→ retry

Execution repository failure
→ retry / finalization policy
```

---

# 12. Major M-02
## Cleanup Handlerはあるが定期実行が存在しない

実装済み：

```text
enqueueCleanupJob()
handleCleanupJob()
```

しかしWorker bootstrap / API bootstrap / Scheduler等から、

```text
enqueueCleanupJob()
```

を呼ぶ箇所が存在しない。

つまり現在、

```text
Cleanup Job
```

は自動では1回もQueueへ入らない。

そのため、

```text
Raw Log Delete Retry 5回失敗
```

や、

```text
Delete Retry Job enqueue自体が失敗
```

すると、

```text
expiresAt = Upload + 24h
```

を超えてもRaw Logが残り続ける。

これは、

```text
Raw Logを残し続けない
24h Retention Safety Net
```

というSprint 4の重要要件を満たさない。

---

# 13. M-02 修正方針

最小構成でよい。

例：

```text
BullMQ Job Scheduler / repeatable maintenance job
```

または、

```text
Worker Startupでrepeat Cleanup Job登録
```

する。

例：

```text
cleanup-expired-raw-logs
every 1h
```

程度。

QueueをSource of Truthにはしない。

Cleanup JobはDBの、

```text
expiresAt < now
AND status not deleted/expired
```

を毎回読む。

必須Test：

```text
Scheduler登録
↓
Cleanup Job enqueue
↓
expired Raw Log delete
```

少なくともIntegration Testで、
SchedulerからHandlerまで繋がることを確認する。

---

# 14. Major M-03
## Delete Retry enqueue失敗がAnalyzer Jobへ逆流する

対象：

```text
apps/worker/src/reconcile-recovery.ts
```

現在：

```typescript
catch {
  await markDeletionFailed();
  await enqueueRawLogDeleteJob(...);
}
```

`enqueueRawLogDeleteJob()`が失敗すると、
そのErrorがそのままcallerへthrowされる。

Success Analyzer Flowの場合：

```text
ObservationSet Persist SUCCESS
↓
Raw Log Delete Failure
↓
deletionStatus failed
↓
Maintenance Queue enqueue Failure
↓
Analyzer Job Failure
```

となる。

しかし設計では：

```text
Raw Log Delete Failure
→ Analyzer Resultは有効
→ Cleanup / Maintenance側の問題
```

として分離する予定だった。

Analysis自体は`analyzer_result_ready`を維持するので
データ破壊はしないが、

```text
Analyzer JobだけFailed / Retry
```

になり、責務境界が崩れる。

---

# 15. M-03 修正方針

Nested best-effortにする。

```typescript
catch {
  await markDeletionFailed();

  try {
    await enqueueRawLogDeleteJob(...);
  } catch {
    // deletionStatus=failedを維持
    // periodic CleanupがSafety Net
  }
}
```

ただしApplication Logには、

```text
analysisId
stage
safe errorCode
```

程度は出してよい。

Raw Log / storage secret等は出さない。

M-02のPeriodic Cleanupとセットで修正する。

---

# 16. Major M-04
## 最終プランでCritical扱いしたFailure Testが不足

CIは205 Test PASSだが、
Sprint 4最終Planで要求したFailure Testsの一部が実装されていない。

`analyzer-job-handler.test.ts`は8 Test。

確認できる：

```text
success
partial
fatal
T-03 Crash after Persist
T-02/T-15 CAS loser
T-16 retry candidate
T-20 status transition
T-06/T-17 delete failure
```

一方、明示的な以下のTestが見当たらない。

```text
T-04 Persist Failure → Raw Log remains
T-05 Fatal Persist Failure → Raw Log remains / retry
T-10 Real enqueue failure → Analysis uploaded
T-12 Actual BullMQ retry behavior
T-13 Retry exhaustion → DB failed state
```

`retry-classification.test.ts`はClassification Unit Testであり、

```text
BullMQが実際にRetryした
最終AttemptでDB stateをfailedへした
```

ことの証明ではない。

今回C-01 / M-01が205 Testsを通過している理由でもある。

---

# 17. M-04 修正方針

Mock中心ではなく、
現在と同じReal Infra：

```text
PostgreSQL
Redis
MinIO
```

を使ってFailure Injectionする。

最低：

```text
1. persistAnalyzerFailure transient DB failure
2. storage.getObjectStream failure
3. persistAnalyzerSuccess failure
4. real Queue retry
5. attempts exhaustion
6. maintenance enqueue failure
```

を追加する。

---

# 18. Minor m-01
## T-08がStorage Residueを実際には確認していない

Test名：

```text
oversized upload leaves no Storage/DB/Queue residue
```

だが、Assertionは主に：

```text
Analysis created
UploadedAccessLog null
Queue job undefined
```

であり、

```text
MinIO Objectが本当に残っていない
```

ことを直接確認していない。

Storage keyがrandomなので、
Test helper側でPrefix list可能にするか、
storage put/delete spy / controlled key builder等で確認する。

---

# 19. Minor m-02
## T-20がWorker経由のIntermediate Transitionを確認していない

T-20は、

```text
Worker Claim
→ processing
```

を確認する意図だが、
実際のTestはRepository methodを直接呼んでいる。

Repository methodの動作確認にはなるが、

```text
handleAnalyzerJobがCAS成功後にmarkProcessingを呼ぶ
```

ことのRegression Testとしては弱い。

Fault pointを、

```text
markProcessing後 / Analyzer開始前
```

へ置けるTest Dependency等を使うとより確実。

Sprint 4 Blockerではない。

---

# 20. Minor m-03
## Node 20の将来対応

CIログでAWS SDKから：

```text
2027年1月以降に公開されるAWS SDK v3
→ Node >=22 required
```

というWarningが出ている。

現在は：

```text
Node 20.19.0
CI PASS
```

なのでSprint 4 Blockerではない。

ただし2027年に入る前に、

```text
Node 22+
```

移行をBacklogへ入れることを推奨。

またGitHub Actions側もNode 20 deprecation warningを出しているが、
これはAction runtime側がNode 24へ移行して動作しており、
現時点のProject runtime failureではない。

---

# 21. F-01〜F-14 実装確認

```text
F-01 Job ID colon除去                PASS
F-02 Redis Role Separation           PASS
F-03 Crash-after-Persist Branch      PASS
F-04 Upload DB Transaction           PASS
F-05 AnalysisExecution Unique        PASS
F-06 UnrecoverableError              PARTIAL
F-07 CAS loser guard                 PASS
F-08 attemptsStarted                 PARTIAL
F-09 Delete Retry enqueue            PARTIAL
F-10 Enqueue Recovery function       PASS
F-11 GitHub Actions command          PASS
F-12 MinIO Health / Pin              PASS
F-13 UploadedAccessLog state         PASS
F-14 no duplicate side effects       PASS
```

PARTIAL理由：

```text
F-06:
Failure Persist自体の失敗時にUnrecoverable化してしまう

F-08:
Retry exhaustion処理が全Worker Error Pathを包んでいない

F-09:
enqueue callはあるがenqueue失敗を隔離していない
```

---

# 22. Positive Findings

今回の実装で特に良い点：

```text
ObservationSet既存時のRecovery Branchが明確
DB CASがRepository primitiveとして独立
Upload DB TransactionがSprint 3のPersistence方針と一貫
Job PayloadがanalysisIdのみ
Storage KeyにOriginal File Nameを含めない
Streaming設計
Raw Log deletionStatusの意味単位Repository Method
ObservationSet max 1 DB constraint
AnalysisExecution compound unique
Producer / Worker Redis connection分離
MinIO固定Release
CI real infrastructure
```

Architectureの方向は維持してよい。

大きな作り直しは不要。

---

# 23. 修正Task

```text
S4-FIX-01
persistAnalyzerFailure failureをswallowしない

S4-FIX-02
Worker前半Infrastructure ErrorをRetry / Exhaustion Boundaryへ入れる

S4-FIX-03
Periodic Cleanup Schedulerを実装

S4-FIX-04
Maintenance enqueue failureをAnalyzer Jobから隔離

S4-FIX-05
Failure Injection Integration Tests追加

S4-FIX-06
T-08 Storage residue assertion追加

S4-FIX-07
可能ならT-20をWorker pathとして強化
```

---

# 24. Re-review受入条件

必須：

```text
C-01 resolved
M-01 resolved
M-02 resolved
M-03 resolved
M-04 resolved
```

CI：

```text
Typecheck PASS
Lint PASS
Migration PASS
MinIO Health PASS
Test PASS
Build PASS
```

追加Test：

```text
Fatal Failure Persist transient error
Storage Read Failure
Persist Success Failure
Retry Exhaustion
Maintenance enqueue failure
Scheduled Cleanup
```

---

# 25. 最終判定

```text
SPRINT 4

Architecture
PASS

Happy Path
PASS

Core Persist/Delete Ordering
PASS

Streaming
PASS

CI
PASS

Failure Recovery
FIX REQUIRED

Retention Safety Net
FIX REQUIRED

Critical Failure Tests
FIX REQUIRED
```

最終：

```text
Critical  1
Major     4
Minor     3

SPRINT 4
PASS WITH FIXES

SPRINT 5
HOLD
```

修正後に再レビューする。

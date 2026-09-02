# Project Polaris
# 35_Sprint_4_Plan_Review
## Sprint 4 実装プラン最終再レビュー

レビュー対象：

```text
Sprint 4: Queue / Worker / Temporary Object Storage / Upload Lifecycle
Latest Revised Plan
```

---

# 1. 総合判定

```text
GO WITH FIXES
```

これまでの指摘：

```text
F-01〜F-11
```

は概ね解消済み。

今回の再チェックで、実装前に以下3点のみ追加修正する。

```text
F-12 MinIO CI Healthcheckのcurl依存を除去
F-13 UploadedAccessLog.status遷移を実Flowへ接続
F-14 「Analyzer exactly-once」ではなく「effective side effects exactly-once相当」に定義修正
```

3点反映後：

```text
SPRINT 4 PLAN
GO
```

---

# 2. F-01〜F-11 再確認

```text
F-01 BullMQ Job ID colon除去                 RESOLVED
F-02 Producer / Worker Redis Connection      RESOLVED
F-03 Crash-after-Persist Branch              RESOLVED
F-04 Upload DB Transaction                   RESOLVED
F-05 AnalysisExecution Unique                RESOLVED
F-06 UnrecoverableError                      RESOLVED
F-07 CAS loser first activation              RESOLVED
F-08 attemptsStartedによるAttempt判定        RESOLVED
F-09 Delete Failure Maintenance enqueue      RESOLVED
F-10 Analyzer enqueue recovery               RESOLVED
F-11 GitHub Actions services.command         RESOLVED
```

---

# 3. F-12 — MinIO CI Healthcheck

## 現在案

```yaml
options: >-
  --health-cmd "curl -f http://localhost:9000/minio/health/live || exit 1"
```

## 問題

近年のMinIO Docker Imageには、

```text
curl
wget
```

が含まれないReleaseがある。

MinIO側でも、
Docker Imageからcurlが削除され、
curlベースHealthcheckが動かなくなった事例が確認されている。

したがって、

```text
services.command: server /data
```

自体は正しいが、

```text
health-cmd curl ...
```

は安全ではない。

---

# 4. MinIO Health修正

推奨A：

MinIO公式Composeと同様に、

```text
mc ready local
```

を使える固定ReleaseへPinする。

または推奨B：

GitHub Actions Serviceには、

```yaml
command: server /data
```

だけ設定し、
Job Step側のUbuntu Runnerから、

```bash
curl --retry ...
http://localhost:9000/minio/health/live
```

で起動待ちする。

Sprint 4ではBの方が単純で確実。

理由：

```text
Runner側にはcurlがある
MinIO Image内Tool有無へ依存しない
```

CI Example：

```yaml
services:
  minio:
    image: <pinned-minio-image>
    command: server /data
    env:
      MINIO_ROOT_USER: polaris
      MINIO_ROOT_PASSWORD: polaris123
    ports:
      - 9000:9000
      - 9001:9001
```

Step：

```bash
curl --retry 20 \
  --retry-delay 1 \
  --retry-connrefused \
  --fail \
  http://localhost:9000/minio/health/live
```

---

# 5. MinIO Image Pin

Sprint 4では、

```text
minio/minio:latest
```

よりRelease Tag固定を推奨する。

理由：

```text
CI reproducibility
Image内部Tool変更
MinIO Repositoryの現在の保守状況
```

Local Docker ComposeとCIで同一Releaseを使用する。

Sprint 4 Implementation Plan上で具体Tagを1つ選び、
Docker Compose / CI双方へ固定する。

---

# 6. F-13 — UploadedAccessLog.status

Domain：

```text
uploaded
processing
deleted
expired
```

を定義している。

しかし現在のWorker Flowでは、
主に、

```text
deletionStatus
```

だけ更新する記述になっている。

これだと、

```text
UploadedAccessLog.status = uploaded
```

のままAnalyzer処理や削除が終わる可能性がある。

---

# 7. Raw Log Status遷移

明示的に：

```text
Upload Persist Success
↓
UploadedAccessLog.status = uploaded
deletionStatus = pending

Worker Claim Success
↓
UploadedAccessLog.status = processing

ObservationSet Persist Success
↓
Raw Log Delete Success
↓
UploadedAccessLog.status = deleted
deletionStatus = success
deletedAt = now
```

Delete Failure：

```text
status = processing
deletionStatus = failed
↓
Maintenance Retry
↓
Delete Success
↓
status = deleted
deletionStatus = success
deletedAt = now
```

Fatal Analyzer：

```text
persistAnalyzerFailure SUCCESS
↓
Delete Success
↓
status = deleted
deletionStatus = success
```

Retention Cleanup：

```text
expiresAt < now
↓
Delete Success
↓
status = expired
deletionStatus = success
deletedAt = now
```

`expired`と`deleted`の使い分け：

```text
Normal Lifecycle Delete
→ deleted

Retention / Cleanup Delete
→ expired
```

とする。

---

# 8. Repository API

単に、

```text
updateDeletionStatus()
updateStatus()
```

を別々に順番に呼ぶより、

```typescript
markProcessing()
markDeletionSuccess({ reason: 'normal' | 'expired' })
markDeletionFailed()
```

等の意味単位Methodにしてもよい。

過剰抽象化は不要だが、

```text
status
deletionStatus
deletedAt
```

の更新漏れを防げる。

少なくともTestでは3 Fieldの整合を確認する。

---

# 9. F-14 — Exactly-once表現

## 問題

現在Acceptanceには、

```text
Duplicate WorkerでAnalyzer二重実行なし
```

という表現がある。

BullMQ / Redis Workerは本質的に、

```text
at-least-once
```

系のExecution Model。

Stalled JobやLock Loss、
Worker停止タイミングによっては、

```text
Analyzer処理そのもの
```

が再実行される可能性を完全には排除できない。

CAS + attemptsStartedは通常のDuplicate Worker Raceを大幅に防げるが、

```text
旧WorkerがLockを失った後も処理を継続
+
Stalled Recoveryで新Workerが開始
```

のようなDistributed Failureまで、
Analyzer CPU処理のExactly-onceを保証するものではない。

---

# 10. Sprint 4で保証するもの

保証対象を、

```text
Analyzer exactly-once execution
```

ではなく、

```text
effective side effects are idempotent
```

へ変更する。

具体的には：

```text
ObservationSet = 最大1
Analysis Lifecycleを逆戻りさせない
Raw LogをPersist前に削除しない
Crash Retryで既存ObservationSetを再Persistしない
Duplicate enqueueで二重Resultを作らない
Raw Log DeleteはIdempotent
AnalysisExecutionは1 record/type
```

を保証する。

---

# 11. CAS Acceptance修正

旧：

```text
Duplicate WorkerでAnalyzer二重実行なし
```

修正：

```text
通常のConcurrent ClaimではCAS loserがAnalyzerへ進まない

BullMQ Retry / Stalled Recoveryでは
Analyzerが再計算される可能性は許容するが、
重複Side Effectを発生させない

ObservationSetは最大1
```

これがQueue Systemとして現実的なGuarantee。

---

# 12. Optional Future Hardening

将来、本当にAnalyzer計算自体の重複をさらに減らす場合：

```text
Execution lease
leaseOwner
leaseExpiresAt
heartbeat
```

等をAnalysisExecutionへ追加可能。

ただしSprint 4 MVPでは不要。

BullMQ Lock + DB CAS + Idempotent Persistenceで十分。

---

# 13. Retry Exhaustion

今回Planの、

```text
attemptsStarted >= job.opts.attempts
```

を利用する判断は妥当。

BullMQ公式も、

```text
attemptsStarted
= JobがActiveへ移動した回数

attemptsMade
= 通常ErrorでFailureした回数
```

としている。

Processor中のCurrent Attempt判定には、
`attemptsStarted`の方が適する。

```text
PASS
```

---

# 14. Non-retryable Failure

```text
persistAnalyzerFailure
↓
Raw Log Delete
↓
AnalysisExecution failed
↓
UnrecoverableError
```

は妥当。

BullMQの`UnrecoverableError`は、
`attempts`設定を上書きして即Failedへ移動する。

```text
PASS
```

---

# 15. GitHub Actions command

2026-04以降のGitHub Actionsでは、
Service Containerへ、

```text
command
entrypoint
```

Overrideが追加されている。

したがって、

```yaml
services:
  minio:
    command: server /data
```

という方針自体は正しい。

前回Reviewで述べた、
「servicesではcommand指定できない」は現在は古い。

```text
F-11 RESOLVED
```

今回修正するのは、

```text
command
```

ではなく、

```text
curlをContainer Healthcheck内部で使っている点
```

のみ。

---

# 16. Test追加

T-01〜T-19へ追加：

```text
T-20 Worker claim
      → UploadedAccessLog.status = processing

T-21 Normal delete success
      → status = deleted
      → deletionStatus = success
      → deletedAt set

T-22 Delete retry success
      → processing/failed
      → deleted/success

T-23 Cleanup retention
      → status = expired
      → deletionStatus = success

T-24 CI MinIO health
      → host-side health probe succeeds
```

---

# 17. 最終修正指示

Latest Revised Planへ以下だけ追加する。

```text
1. MinIO healthcheckでContainer内curlへ依存しない
2. MinIO ImageをRelease Tag固定する
3. CI MinIO起動待ちはRunner側curl等で確認する
4. Worker開始時UploadedAccessLog.status = processing
5. Normal Delete成功時status = deleted
6. Cleanup Delete成功時status = expired
7. deletionStatus / deletedAtも同時整合させる
8. Acceptanceの「Analyzer exactly-once」を弱める
9. Guaranteeは「duplicate side effectsなし」と定義する
10. T-20〜T-24を追加する
```

---

# 18. 最終判定

```text
F-01〜F-11   RESOLVED

F-12         FIX
F-13         FIX
F-14         FIX
```

判定：

```text
SPRINT 4 PLAN
GO WITH FIXES
```

3点反映後：

```text
GO
```

これ以上のArchitecture再レビューは不要。

実装時は、

```text
md/34
md/35 最新版
```

を両方参照する。

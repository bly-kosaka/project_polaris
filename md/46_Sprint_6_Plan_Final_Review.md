# 46_Sprint_6_Plan_Final_Review

## Sprint 6 Updated Implementation Plan Re-review

対象：

- `tidy-pondering-stonebraker(3).md`
- 前回レビュー：`45_Sprint_6_Plan_Review.md`
- Repository：`bly-kosaka/project_polaris`
- Review時点 main HEAD：`c0e5fcbf2a1a23efed03aa64b9f6bc461a287d90`

---

# 1. Verdict

```text
GO WITH FIXES
```

前回の F-01〜F-04 は大部分が反映された。

ただし、実装開始前にさらに **3点だけ修正が必要**。

```text
Critical  0
Major     3
Minor     0
```

Architecture全体の再設計は不要。

---

# 2. 前回指摘の解消状況

## F-01 — aiStatus queued persistence

```text
PARTIALLY RESOLVED
```

`scheduleInitialAiExplanation()` が追加され、

```text
not_requested
↓
queued
↓
running
↓
success / failed
```

を明示しようとしている点は正しい。

ただし Queue / DB drift 時の `already_queued` / `already_running` 分岐にまだ欠陥がある。

→ 新 M-01 で後述。

---

## F-02 — AI_MAX_INPUT_BYTES

```text
RESOLVED
```

旧：

```typescript
JSON.stringify(observationSet).length
```

から：

```typescript
Buffer.byteLength(JSON.stringify(observationSet), 'utf8')
```

へ修正された。

さらに日本語を含む Regression Test：

```text
T-AI-05
```

も計画されている。

この修正で問題ない。

---

## F-03 — Retry Lifecycle / completed → explaining

```text
RESOLVED
```

現行 Repository の `status-transition.ts` は実際に：

```typescript
completed: []
```

である。

更新Planでは：

```typescript
completed: ['explaining']
```

へ変更し、

Retry時：

```text
completed / failed-AI
↓ retry enqueue
completed / queued
↓ Worker claim
explaining / running
↓
completed / success | failed
```

を定義した。

同一status update：

```text
completed → completed
```

が現行Guardで許容されることも確認済み。

この方針でよい。

---

## F-04 — Provider / Model Selection Resolver

```text
RESOLVED
```

新規：

```text
resolveAiModelConfig(env)
```

により、

```text
Environment
↓
AIModelConfig
↓
Worker
```

という境界ができた。

将来：

```text
User Selection
+
Entitlement
↓
resolveAiModelConfigForAnalysis()
```

へ差し替え可能。

Provider / ModelをWorker内部で直接`process.env`から読む構造ではなくなった。

方向性は正しい。

---

# 3. Major M-01 — `already_queued` / `already_running` でDB状態がreconcileされない

これは前回M-03の残件。

更新Planの：

```typescript
scheduleInitialAiExplanation()
```

では：

```typescript
if (result === 'enqueued' || result === 'retried') {
  aiStatus = 'queued'
}

// already_queued / already_running / already_completed:
// DB is already consistent, nothing to write.
```

としている。

しかし、そのコメントは成立しない。

`recoverAiExplanationEnqueue()` 自身が想定している Queue / DB drift の例に：

```text
BullMQ job waiting
AIExplanationRecord none
```

がある。

この時DBの`Analysis.aiStatus`が：

```text
not_requested
```

のままである可能性は十分ある。

実際：

```text
Queue job = waiting
DB aiStatus = not_requested
```

で `recoverAiExplanationEnqueue()` は：

```text
already_queued
```

を返す。

現在の `scheduleInitialAiExplanation()` は何も更新しないため：

```text
Queue = waiting
DB = not_requested
```

がそのまま残る。

同様に：

```text
Queue = active
DB = queued / not_requested
```

で `already_running` を返した場合も、Product stateが正しくない可能性がある。

これはPlan自身が宣言している：

> PostgreSQL = Product Lifecycle Source of Truth  
> BullMQ = Execution mechanism

という原則に反する。

## 必須修正

Caller側で結果ごとのDB reconciliationを明示する。

例えば初回：

```text
enqueued
retried
already_queued
→ Analysis.status = analyzer_result_ready
→ aiStatus = queued
```

`already_running`については：

```text
Analysis.status / aiStatusを再読込
```

して、

Worker claim済みで：

```text
explaining / running
```

なら何もしない。

QueueだけactiveでDBがまだ：

```text
analyzer_result_ready / queued
```

なら、Worker側のCASが直後に行われる race として許容するか、
明示的reconciliationするかを決める。

重要なのは：

```text
already_queued = DB already consistent
```

と仮定しないこと。

Retry APIでも同様に、`already_queued`なら`completed / queued`へDBをreconcileする。

## Test修正

現在のT-AI-06：

```text
job waiting + no record → already_queued
```

だけでは不十分。

追加：

```text
Queue waiting
DB aiStatus = not_requested
↓
scheduleInitialAiExplanation
↓
DB aiStatus = queued
```

および：

```text
Queue waiting
DB aiStatus = failed
↓
Retry API
↓
DB aiStatus = queued
```

を確認する。

---

# 4. Major M-02 — Fake AI Providerを注入するDependency seamがPlanに存在しない

Planは複数箇所で：

```text
Fake AI ProviderをDependency Injection
```

するとしている。

特に：

```text
Worker Integration Test
Product Integration Test
CI
```

では実OpenAI APIを呼ばずFake Providerを注入すると明記されている。

しかし更新後の `WorkerDeps` は：

```typescript
WorkerDeps += {
  aiExplanationQueue,
  aiModelConfig
}
```

のみ。

一方 Job Handler は：

```text
configured AIProvider via registry
```

を使う。

現在のPlanでは：

```text
Provider Registry / AIProvider
```

をどこからJob Handlerへ注入するのかが定義されていない。

このままだとHandler内部で：

```typescript
selectProvider(deps.aiModelConfig.provider)
```

を直接呼ぶ構造になり、

Registryが実OpenAI Adapterしか生成しない場合：

```text
Fake Provider injection
```

ができない。

テストだけmodule mockを使う手もあるが、
Planが目指しているProvider Agnostic / DI Architectureと矛盾する。

## 必須修正

`WorkerDeps`にProvider seamを追加する。

推奨は単純に：

```typescript
interface WorkerDeps {
  ...
  aiProvider: AIProvider;
  aiModelConfig: AIModelConfig;
}
```

Sprint 6 bootstrap：

```text
loadEnv
↓
resolveAiModelConfig
↓
Provider Registry
↓
OpenAIResponsesAdapter
↓
WorkerDeps.aiProvider
```

Test：

```text
FakeAIProvider
↓
WorkerDeps.aiProvider
```

これが最も単純。

将来的にAnalysisごとにProviderが変わる場合は：

```typescript
aiProviderResolver:
  (selection: AIProviderSelection) => AIProvider
```

へ発展させてもよい。

Sprint 6で必要以上にFactory化する必要はない。

## Test追加

```text
OpenAI adapterをconstructせず
FakeAIProviderだけでAI Worker success
```

を明示的に確認する。

---

# 5. Major M-03 — Frontend Retry PollingのAPI契約が成立していない

更新Planは：

```text
useAIExplanation.retry()
↓
GET /analyses/:id/explanation をpoll
↓
aiStatus reaches success / failed
```

としている。

しかし、同じPlanのGET Explanation APIは：

```text
not_requested / queued / running
→ 404 AI_EXPLANATION_NOT_READY
```

であり、

成功時だけ：

```text
AIExplanationDetailDto
```

を返す。

つまり：

```text
GET /explanation
```

のResponseには、pending中の：

```text
aiStatus = queued
aiStatus = running
```

が存在しない。

さらにterminal AI failureは：

```text
409 AI_EXPLANATION_FAILED
```

なので、

```text
aiStatus reaches failed
```

という値をGET Explanationレスポンスから観測することもできない。

したがって：

> GET explanationをpollしてaiStatusがsuccess/failedになるまで待つ

という記述はAPI contract上成立しない。

## 必須修正

推奨は既存：

```text
GET /analyses/:id
```

をAI status pollingに使用する。

```text
Retry
↓
GET /analyses/:id
↓
aiStatus
  queued
  running
  success
  failed
```

`success`になったら：

```text
GET /analyses/:id/explanation
```

を1回取得。

これは既存DTOに：

```text
aiStatus
```

を追加する今回のPlanとも自然に合う。

## 推奨Frontend Flow

```text
Result Page
↓
GET Analysis
↓
aiStatus

queued / running
→ loading表示
→ GET Analysis polling

success
→ GET Explanation
→ AI content表示

failed
→ AI failed panel
→ Aggregationは維持
```

Retry後も同じComposableで処理できる。

## Test修正

```text
retry
↓
Analysis aiStatus queued
↓
poll Analysis
↓
running
↓
success
↓
fetch Explanation
```

および：

```text
retry
↓
queued
↓
running
↓
failed
↓
AI failure panel
```

をテストする。

---

# 6. `completed → explaining` 変更について

現行Repositoryでは：

```typescript
completed: []
```

であり、コメントも：

```text
'completed' and 'failed' are terminal
```

となっている。

更新Planで：

```typescript
completed: ['explaining']
```

へ変更すること自体は今回のAI Retry要件上妥当。

ただし実装時はコメントも必ず変更すること。

旧：

```text
completed and failed are terminal
```

を残すとコードと説明が矛盾する。

例えば：

```text
failed is terminal.
completed may re-enter explaining only for AI Explanation retry.
```

等へ更新する。

---

# 7. AI Input Size Guard

承認。

```typescript
Buffer.byteLength(
  JSON.stringify(observationSet),
  'utf8'
)
```

でよい。

将来Prompt固定文が大幅に増えた場合には：

```text
PromptDocument全体
```

のbyte/token budgetへ発展させる余地を残す。

Sprint 6ではObservationSet byte guardで十分。

---

# 8. Provider Agnostic Design

承認。

```text
AIProvider
↓
OpenAI Adapter
```

をSprint 6で実装し、

```text
Anthropic
Gemini
```

は将来Adapterのみ追加する。

今回新M-02のDI seamだけ追加すれば、
このArchitectureは綺麗に成立する。

---

# 9. Persistence

承認。

```text
AIExplanationRecord
+
provider
model
promptVersion
schemaVersion
usage
```

を保存する。

Raw Prompt / Raw AI Response / Raw Logを保存しない。

また：

```text
AIExplanationRecord persist
```

をLifecycle commit pointとする方針も正しい。

---

# 10. Final Fix List

実装前に以下だけPlanへ反映する。

## F-05

`already_queued` / `already_running` を：

```text
DB already consistent
```

と仮定しない。

Queue state結果から`Analysis.aiStatus`をreconcileする契約を追加。

## F-06

`WorkerDeps`へ：

```typescript
aiProvider: AIProvider
```

または同等のProvider Resolverを追加し、
Fake Providerを本当にDI可能にする。

## F-07

Frontend pollingを：

```text
GET /analyses/:id
→ aiStatus
```

ベースへ変更。

`success`時だけ：

```text
GET /explanation
```

を取得する。

---

# 11. Review Result

```text
Previous F-01  PARTIAL → F-05 required
Previous F-02  RESOLVED
Previous F-03  RESOLVED
Previous F-04  RESOLVED

New Major M-01  Queue/DB drift reconciliation
New Major M-02  Provider DI seam missing
New Major M-03  Frontend polling/API mismatch
```

---

# 12. Final Assessment

```text
Architecture             PASS
Analyzer / AI Boundary   PASS
Provider Agnostic        PASS WITH SMALL FIX
Structured Output        PASS
Grounding                PASS
Persistence              PASS
Initial Lifecycle        PASS WITH FIX
Retry Lifecycle          PASS
Queue Reconciliation     FIX REQUIRED
Frontend AI State        FIX REQUIRED
Security                 PASS
Testing                  PASS WITH FIX
```

結論：

```text
SPRINT 6 PLAN
GO WITH FIXES
```

今回の3点は局所修正であり、再設計は不要。

F-05〜F-07を反映したPlanであれば、
その後はImplementationへ進んでよい。

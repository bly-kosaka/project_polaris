# Project Polaris
# 41_Sprint_5_Plan_Final_Review
## Sprint 5 更新版 Implementation Plan 最終確認

レビュー対象：

```text
tidy-pondering-stonebraker(1).md
```

前回レビュー：

```text
40_Sprint_5_Plan_Review.md
GO WITH FIXES
F-01 ～ F-05
```

---

# 1. 総合判定

```text
GO WITH ONE FIX
```

前回の必須修正：

```text
F-01 ObservationSet JSON Validation
F-02 Web / Analyzer Type Dependency
F-03 Root Script / CI Double Run
F-04 CORS Bootstrap Boundary
F-05 Product Integration Test Boundary
```

はすべてPlan上で適切に反映されている。

Architecture、Product Scope、UI、API、Testing方針について再設計は不要。

ただし現行RepositoryのRoot Vitest設定と照合した結果、
1点だけ追加修正が必要。

```text
F-06 Root Backend Testから
     apps/web / apps/product-e2eを除外する
```

これを反映すれば：

```text
SPRINT 5 PLAN
GO
```

実装開始してよい。

---

# 2. F-01 ～ F-05確認

## F-01

更新版では：

```text
ObservationSetRecord
↓
toDomainObservationSetRecord()
↓
validateObservationSet()
↓
overview.totalRequests
```

となった。

Validation失敗した1行だけ：

```text
requestCount = undefined
```

へdegradeし、Project全体のAnalysis Listを落とさない方針もMVPとして妥当。

```text
F-01 RESOLVED
```

---

## F-02

`apps/web`から`@polaris/analyzer`へのtype dependencyを削除。

Frontend自身の：

```text
Zod Wire Schema
↓
z.infer
```

をType Sourceとする。

Clean Install時のAnalyzer `dist/index.d.ts`依存が消える。

```text
F-02 RESOLVED
```

---

## F-03

Root Scriptを：

```text
*:backend
*:frontend
```

へ分離し、Umbrella ScriptはLocal convenience用。

CIではspecific commandだけを呼ぶ構造になった。

方向は正しい。

ただし後述F-06により
`test:backend = vitest run`
の対象範囲だけ修正が必要。

```text
F-03 RESOLVED
```

---

## F-04

```text
index.ts
↓
loadEnv()
↓
ApiDeps.corsOrigin
↓
buildServer(deps)
```

となった。

`buildServer()`はEnvironment非依存のFactoryとして維持。

```text
F-04 RESOLVED
```

---

## F-05

Product Flow Testを：

```text
apps/product-e2e
```

へ分離。

`apps/web`自身のTestはFrontend-onlyとする。

API / Workerもbare bootstrap entrypointではなく
side-effect-free subpathからImportする方針。

```text
F-05 RESOLVED
```

---

# 3. F-06
## Root VitestのIncludeが新しいTest Suiteを全部拾う

現行Root `vitest.config.ts`：

```typescript
test: {
  include: ['{apps,packages}/*/src/**/*.test.ts'],
  exclude: ['**/node_modules/**', '**/dist/**'],
  fileParallelism: false,
}
```

したがって更新Planのまま：

```text
apps/web/src/**/*.test.ts
apps/product-e2e/src/product-flow.test.ts
```

を追加すると、

```bash
yarn test:backend
```

の実体である：

```bash
vitest run
```

が両方を拾う。

結果：

```text
Backend Test
↓
Web Testsまで実行

Backend Test
↓
Product Integration Testまで実行

Frontend Test
↓
Web Testsを再実行

Product Integration Test
↓
Product Integration Testを再実行
```

となる。

これはF-03で解消しようとした
「CI二重実行」をRoot Vitest側から再導入してしまう。

さらにRoot Vitest ConfigはNode-orientedで
Vue Plugin / happy-domを持たないため、
Web `.vue` Testを誤って拾うとTransform失敗の可能性もある。

---

# 4. F-06 修正

Root VitestをBackend専用に明示する。

推奨：

```typescript
test: {
  include: [
    'packages/*/src/**/*.test.ts',
    'apps/{api,worker}/src/**/*.test.ts',
  ],
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
  ],
  fileParallelism: false,
}
```

これにより：

```text
yarn test:backend
→ packages/*
→ apps/api
→ apps/worker
```

のみ。

Frontend：

```text
yarn test:frontend
→ apps/web/vitest.config.ts
```

Product Integration：

```text
yarn workspace @polaris/product-e2e run test
→ apps/product-e2e/vitest.config.ts
```

と完全分離できる。

---

# 5. Product E2E subpath exports

更新版では：

```text
@polaris/api/server
@polaris/api/deps

@polaris/worker/analyzer-job-handler
@polaris/worker/deps
```

というside-effect-free subpathを追加する。

これは目的として妥当。

ただし`exports`が`dist/*.js`を向く場合、
Product Integration Test単独実行前にBackend build/typecheckが必要になる。

今回のVerification / CI順：

```text
Backend Typecheck
↓
Tests
```

なら成立する。

Implementation時にはClean Environmentで：

```text
yarn typecheck:backend
↓
yarn workspace @polaris/product-e2e run test
```

が確実に通ることを確認する。

これは追加Blockerとはしない。

---

# 6. UI / API / Product Scope

以下はそのままGO。

```text
Vue 3 + Vite + TypeScript
No Pinia

Project Create
Analysis Create
Upload
Processing Polling
Result
Aggregation Drill-down

Parse Warning
Data Limitation

Path
Source IP
Status
Method
User-Agent
Time

Known Information
Detail Drawer

No AI
No Fake Finding
No Urgency
No Risk
No Severity
No Priority
No Raw Log Viewer
```

---

# 7. Final Checklist

実装前にPlanへF-06だけ追記。

```text
F-01 RESOLVED
F-02 RESOLVED
F-03 RESOLVED
F-04 RESOLVED
F-05 RESOLVED

F-06 REQUIRED
Root backend Vitest includeを
packages/* + apps/api + apps/workerへ限定
```

---

# 8. 最終判定

```text
Critical 0
Major    1
Minor    0
```

Major 1件はTest Configの局所修正のみ。

```text
Architecture       PASS
Product Scope      PASS
UI Direction       PASS
API Direction      PASS
Testing Direction  PASS WITH ONE FIX
```

最終：

```text
SPRINT 5 PLAN
GO WITH ONE FIX
```

F-06はImplementation開始時に同時反映してよい。

この点だけ明示したうえで、
追加のPlan提出・再レビューは不要。

```text
F-06反映
↓
IMPLEMENTATION GO
```

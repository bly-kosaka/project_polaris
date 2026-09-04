# Project Polaris
# 40_Sprint_5_Plan_Review
## Sprint 5 Implementation Plan レビュー

レビュー対象: `tidy-pondering-stonebraker.md`

## 1. 総合判定

```text
GO WITH FIXES

Critical 0
Major    5
Minor    0
```

大枠は正しい。特に、AIをSprint 6へ分離し、Fake AI / Risk / Severityを作らないこと、Project → Upload → Processing → Result → Aggregation Drill-downをSprint 5の中心にすること、Parse Warning / Data Limitationを上位表示することは既存設計と整合する。

実装前に以下5点を修正する。

```text
F-01 ObservationSet JSONを未検証のまま一覧DTOへ使わない
F-02 apps/webの@polaris/analyzer type依存と「独立toolchain」が矛盾
F-03 Root scriptsとCIでFrontend処理が二重実行になる
F-04 buildServer()内部でloadEnv()しない
F-05 Product E2EのCross-App import boundaryを明示する
```

この5点反映後は `GO`。

---

## 2. 依存バージョン

主要Versionは2026-09-04時点で確認できた。

```text
vue-router          5.3.1
@vitejs/plugin-vue  6.0.8
vue-tsc             3.3.11
```

Version自体はBlockerではない。Vue Router 5は新しいMajorなのでImplementation開始時にInstalled APIを再確認する。

---

## 3. F-01 — ObservationSet JSON未検証読取

Planでは `AnalysisRepository.listSummariesByProjectId()` が `observationSet.data.overview.totalRequests` を直接読み、`toDomainObservationSetRecord()` / `validateObservationSet()`を通さないとしている。

これはSprint 3以降の

```text
ObservationSet = Persistent Source of Truth
Deserialize時にValidation
```

という方針と一致しない。

Prisma JSONから直接 `overview.totalRequests` を読むと、古いSchema・破損データ・Unexpected Shapeで一覧APIだけRuntime Errorになる可能性がある。

### 修正

推奨:

```text
ObservationSetRecord
↓
既存Deserializer / Validator
↓
overview.totalRequests
```

Project内Analysis数はboundedなのでMVPではValidation Costを優先的に問題視しなくてよい。

どうしてもFull Validationを避ける場合でも、最低限 `schemaVersion` / `overview` / `totalRequests` を安全にNarrowすること。

---

## 4. F-02 — Web type依存と独立Toolchainの矛盾

Planでは `apps/web` が `@polaris/analyzer` をtype-only dependencyとして使う。

しかし現在の `packages/analyzer/package.json` は:

```json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

なので、Clean Install直後の

```bash
yarn workspace @polaris/web run typecheck
```

ではAnalyzerの`dist/index.d.ts`がまだない可能性がある。

つまり実際には:

```text
Backend tsc build
↓
Analyzer declarations生成
↓
Web typecheck
```

という隠れ依存になる。

これは「apps/webは独立toolchain」というPlanと矛盾する。

### 修正

Sprint 5ではFrontend Wire SchemaをWeb側Zod Schemaから定義するのが最も単純。

```typescript
const observationSetSchema = z.object(...);
type ObservationSetDto = z.infer<typeof observationSetSchema>;
```

全Analyzer内部Schemaを複製する必要はなく、Presentationが実際に使用するFieldを正確にValidationする。

将来Wire Contract共有が増えたら `packages/contracts` を検討する。Sprint 5だけのために新Packageを作る必要はない。

---

## 5. F-03 — Root scripts / CI二重実行

Plan前半ではRoot `typecheck` / `test` / `build` にweb workspaceも追加するとしている。

一方CI sectionでは、既存のTypecheck/Test/Buildに加えて

```text
Frontend typecheck
Frontend test
Frontend build
```

を別Stepで追加するとしている。

両方実装するとFrontend処理が二重に走る。

### 修正

推奨:

```text
typecheck:backend
test:backend
build:backend
```

をRootに追加し、

通常のRoot command:

```text
typecheck = backend + frontend
test      = backend + frontend
build     = backend + frontend
```

CI:

```text
Backend Typecheck
Frontend Typecheck
Backend Test
Frontend Test
Backend Build
Frontend Build
```

と明示的に分離する。

---

## 6. F-04 — buildServer内部でEnvを読まない

現行 `apps/api/src/server.ts` は:

```typescript
buildServer(deps)
```

としてProcess Bootstrapから分離され、TestからInject可能な構造になっている。

Planでは `CORS_ORIGIN` を `server.ts` で直接 `loadEnv()` するとしているが、これは現在の良いBoundaryを崩す。

### 修正

`ApiDeps`またはServer Configへ:

```typescript
corsOrigin: string
```

を追加。

```text
index.ts
↓
loadEnv()
↓
buildServer({ ..., corsOrigin })
```

とする。

`buildServer`はEnvironment非依存のdeterministic factoryとして維持する。

---

## 7. F-05 — Product E2EのCross-App Boundary

Planは:

```text
apps/web/src/__tests__/e2e/product-flow.test.ts
```

からReal Fastify API + Real Worker Handler + Vue Test Utilsを動かすとしている。

しかし `apps/web` から `apps/api` / `apps/worker` をどうImportするかが未定義。

Application同士を相対Pathで直接Importする構造は避ける。

### 修正

推奨:

```text
tests/product-e2e/
```

または

```text
integration/product-flow/
```

へProduct Integration Testを分離する。

このTestだけが:

```text
apps/api buildServer
apps/worker handleAnalyzerJob
apps/web page/components
```

を組み合わせる。

Web workspace内は:

```text
API Client Test
Composable Test
Component Test
Page Test
```

に集中する。

PlaywrightをSprint 5で必須にしない判断は問題ない。ただしこのテストを「literal browser E2E」とは呼ばず、`Product Integration Test / Browser-equivalent Flow` と表現する。

---

## 8. API / DTO

以下は妥当。

```text
POST /projects
GET /projects
GET /projects/:projectId
GET /projects/:projectId/analyses
```

N+1を避ける方針も正しい。

`GET /analyses/:id` をRaw Domain Objectから `AnalysisDetailDto`へ変更し、Original File Name / SizeをUploadedAccessLogから取得する方針も良い。

API Error Contract:

```json
{
  "error": {
    "code": "...",
    "message": "..."
  }
}
```

への統一も、このタイミングなら問題ない。

---

## 9. ObservationSet → UI Mapping

現行Schemaには:

```text
overview.totalRequests
overview.firstSeen
overview.lastSeen

aggregations.paths
aggregations.sourceIps
aggregations.sourceIpPaths
aggregations.statuses
aggregations.methods
aggregations.userAgents
aggregations.time.oneMinute
aggregations.time.fiveMinute
```

が存在するため、PlanのResult Header / Aggregation Mappingは現行実装と整合している。

Default Sort:

```text
requestCount desc
Time bucket asc
```

もRisk / Severityではなく表示Sortなので問題ない。

Source IP Tableの4xx / 5xx countを既存statusDistributionから算出するのもPresentationであり、新しいRisk判定ではない。

---

## 10. Empty / Unavailable

Planの:

```text
array.length === 0 → Empty
parseSummary.parsedLines === 0 → Unavailable
```

はMVP Simplificationとして許容。

ただし `parsedLines === 0` の場合は通常Analyzer FatalとなりObservationSet自体が存在しない可能性が高いため、Implementation時にReachabilityを確認する。

到達不能ならUnavailable Stateは将来用Componentとして残してよい。

---

## 11. UI / Security

以下はPASS。

```text
No AI Summary / Finding / Urgency
No Risk / Severity / Priority
No Raw Log Viewer
No storageKey / S3 credentials / Redis details
Known InformationをDanger Labelにしない
Desktop First / Mobile accessible
Parse Warning / Data Limitation visible
Polling MVP
No Pinia
```

---

## 12. 必須修正

Implementation Planへ以下を反映する。

```text
1. listSummariesByProjectId()でObservationSet JSONを未検証読取しない
2. apps/webから@polaris/analyzer dist typeへ直接依存する案を再設計
3. Root scriptsとCI scriptsの二重Frontend実行を解消
4. CORS_ORIGINはbootstrapでloadしbuildServerへ渡す
5. Product Integration Testの置き場所とCross-App boundaryを明確化
```

---

## 13. Optional

Blockerではない。

```text
O-01 Vue Router 5のInstalled API再確認
O-02 Unavailable StateのReachability確認
O-03 将来必要ならpackages/contracts検討
```

---

## 14. 最終判定

```text
Architecture       PASS
Product Scope      PASS
UI Direction       PASS
API Direction      PASS WITH FIXES
Testing Direction  PASS WITH FIXES

Critical 0
Major    5
Minor    0

SPRINT 5 PLAN
GO WITH FIXES
```

F-01〜F-05反映後:

```text
GO
```

再設計は不要。Plan修正版を1回確認してから実装開始する。

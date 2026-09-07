# Project Polaris
# 42_Sprint_5_Review
## Sprint 5 実装レビュー

レビュー対象HEAD：

```text
6953e18f5f4e237722083326aa9041b3e6df0cf7
```

Sprint 4完了HEAD：

```text
a285bf53cae77dd6156f590d1c63e6106e99ffe3
```

## 1. 総合判定

```text
PASS WITH FIXES

Critical  0
Major     3
Minor     1

SPRINT 5
PASS WITH FIXES

SPRINT 6
HOLD
```

実装の大枠は正しい。F-01〜F-06、Vue Product UI、Project / Analysis API、Upload / Processing / Result Flow、ObservationSet Zod Validation、Aggregation 6 Tabs、Detail Drawer、Product Integration Test、CI分離は概ね成立している。

最新CIもPASS。

---

## 2. CI

```text
Run ID 33858481720
Conclusion success
```

成功Step：

```text
Backend Typecheck
Frontend Typecheck
Lint
Run database migrations
Wait for MinIO
Backend Test
Frontend Test
Backend Build
Product Integration Test
Frontend Build
```

---

## 3. F-06 確認

Root `vitest.config.ts` はBackend専用へ修正済み。

```typescript
include: [
  'packages/*/src/**/*.test.ts',
  'apps/{api,worker}/src/**/*.test.ts',
]
```

Frontend / Product Integration Testの二重実行は解消。

```text
F-06 PASS
```

---

## 4. Major M-01
### APIのUnhandled Errorが統一Error Contractを迂回する

Sprint 5では全API Errorを：

```json
{
  "error": {
    "code": "...",
    "message": "..."
  }
}
```

へ統一した。

`sendApiError()`は実装されているが、`buildServer()`にGlobal Error Handlerがない。

現在：

```typescript
const app = Fastify();
registerProjectsRoutes(app, deps);
registerAnalysesRoutes(app, deps);
```

であり、

```typescript
app.setErrorHandler(...)
```

が存在しない。

Project Route等もRepository呼び出しを直接awaitしている。

DB接続障害などでPrismaがthrowすると、Fastify標準Error Responseへ落ち、統一Contractを外れる可能性がある。Exception messageによっては内部情報がResponseへ含まれる可能性もあり、`raw server errorsをFrontendへ返さない`というSprint 5要件とも一致しない。

### 修正

Global Error Boundaryを追加。

```typescript
app.setErrorHandler((error, request, reply) => {
  return sendApiError(
    reply,
    500,
    'INTERNAL_ERROR',
    'An internal error occurred',
  );
});
```

Raw Prisma message / Storage message / Stack Trace / Raw Log contentをResponseへ返さない。

Regression Test：

```text
Repository throws
↓
500
↓
error.code = INTERNAL_ERROR
↓
safe generic message
```

```text
M-01 OPEN
```

---

## 5. Major M-02
### Analysis Result Header / Overviewが欠落

Sprint 5設計ではResult Headerに最低限：

```text
Project Name
File Name
Analysis Date
Analyzed Period
Request Count
Analyzer Status
```

を表示する予定だった。

現在の`AnalysisResultPage.vue`は：

```text
PageHeader
  File Name
  StatusBadge

DataLimitationPanel
Aggregation Tabs
```

であり、

```text
Request Count
Analyzed Period
Analysis Date
Project Name
```

が表示されていない。

ObservationSetには既に：

```text
overview.totalRequests
overview.firstSeen
overview.lastSeen
```

があるため、Backend追加は最小で済む。

### 修正

Result Header直下にOverview Panelを追加。

最低限：

```text
解析Request数
ObservationSet.overview.totalRequests

解析期間
firstSeen ～ lastSeen

Analysis作成日時
AnalysisDetailDto.createdAt

Analyzer状態
AnalysisDetailDto.analyzerStatus
```

Project Nameは`AnalysisDetailDto`へ追加するか、Projectを別fetchする。単一画面なので単純な方でよい。

Regression Testで`totalRequests / firstSeen / lastSeen`の表示を確認。

```text
M-02 OPEN
```

---

## 6. Major M-03
### Detail DrawerからのCross-Aggregation NavigationがSearchを消す

現在：

```typescript
watch(activeTab, () => {
  searchQuery.value = '';
});
```

一方：

```typescript
function goToPath(path: string): void {
  activeTab.value = 'path';
  searchQuery.value = path;
  closeDrawer();
}
```

```typescript
function goToSourceIp(sourceIp: string): void {
  activeTab.value = 'sourceIp';
  searchQuery.value = sourceIp;
  closeDrawer();
}
```

となっている。

VueのwatchはScheduler経由で動くため、

```text
activeTab変更
↓
searchQueryへPath設定
↓
watch(activeTab)
↓
searchQuery = ''
```

となり得る。

つまり「関連するPathを見る」「関連するSource IPを見る」でTabは切り替わるが、対象Rowを絞り込む検索条件が消える。

### 修正

Tabを手動変更した時だけSearchをclearする。

最も単純なのは`watch(activeTab)`を削除し、TabNav change handlerでclearすること。

Cross Navigation側は：

```typescript
activeTab.value = 'path';
searchQuery.value = path;
```

を維持。

Regression Test：

```text
Source IP Drawer
↓
関連するPathを見る
↓
Path Tab
↓
Search Input = selected path
↓
対象Rowだけ表示
```

逆方向も確認。

```text
M-03 OPEN
```

---

## 7. Minor m-01
### Frontend File Size Validationが未実装

Sprint 5設計では：

```text
Frontend Validation
file exists
size <= MAX_UPLOAD_BYTES相当
```

としていた。

現在Upload Pageは`file exists`のみで、File SizeのClient-side UX Validationがない。

API側のauthoritative limitは維持されているためSecurity問題ではなくMinor。

### 修正

例えば：

```text
VITE_MAX_UPLOAD_BYTES
```

を追加し、File選択時またはSubmit時に上限超過をAPI送信前に表示する。

```text
Frontend validation = UX
API validation = authoritative
```

は維持。

---

## 8. その他確認

以下はPASS。

```text
Analyzer Failed表示
Parse Warning
Data Limitation
ObservationSet Runtime Validation
Path / Source IP / Status / Method / User-Agent / Time
Known Information
Raw Log / Sensitive Data非公開
Product Integration Test
```

Analyzer Failed時も「安全です」「問題ありません」「異常なし」といった誤解を招く表現はない。

---

## 9. Fix Tasks

```text
S5-FIX-01
Fastify Global Error Handler追加

S5-FIX-02
Unhandled ExceptionをApiError Contractへ変換

S5-FIX-03
Result Overview Panel追加

S5-FIX-04
Cross Aggregation NavigationのSearch reset bug修正

S5-FIX-05
Cross Navigation Regression Test追加

S5-FIX-06
Frontend File Size Validation追加

S5-FIX-07
Unhandled API Error Integration Test追加

S5-FIX-08
Result Overview Rendering Test追加
```

---

## 10. Re-review Acceptance

必須：

```text
M-01 resolved
M-02 resolved
M-03 resolved
```

m-01は可能なら同時修正。

CI：

```text
Backend Typecheck PASS
Frontend Typecheck PASS
Lint PASS
Migration PASS
Backend Test PASS
Frontend Test PASS
Backend Build PASS
Product Integration Test PASS
Frontend Build PASS
```

---

## 11. Final Status

```text
F-01 PASS
F-02 PASS
F-03 PASS
F-04 PASS
F-05 PASS
F-06 PASS

Project API          PASS
Analysis API         PASS
Upload Lifecycle     PASS
Processing Polling   PASS
ObservationSet Zod   PASS
Parse Warning        PASS
Data Limitation      PASS
Aggregation Tabs     PASS
Detail Drawer        PASS
Known Information   PASS
CI                   PASS

API Error Boundary   FIX REQUIRED
Result Overview      FIX REQUIRED
Cross Navigation     FIX REQUIRED
File Size UX         MINOR FIX
```

最終：

```text
Critical  0
Major     3
Minor     1

SPRINT 5
PASS WITH FIXES

SPRINT 6
HOLD
```

Architectureの再設計は不要。今回の残件はAPI Boundary / Result Header / Cross Navigation / Upload UXの局所修正のみ。

# 54_Sprint_7_Review.md

## Sprint 7 Authentication / Ownership (Clerk) — Implementation Review

対象：

- Repository: `bly-kosaka/project_polaris`
- Review HEAD: `cfbadbeabc3a58628855f4d99b54e55316d2a162`
- Sprint 7 backend: `1726cc49cbae92dce2f64607eb514239bfe8518d`
- Sprint 7 frontend: `97eee3e0ba260857cefd69baedbf4c3d4cb147bf`
- Product E2E拡張 + Race修正: `f74715e7a78cf8181c6331662d203cbfe2d1643d`
- README追記: `658ef9253a437c6a4ae51c64a1c44f375c922866`
- Smoke Test中に発見したBug修正: `cfbadbeabc3a58628855f4d99b54e55316d2a162`
- 基準: `50_Development_Setup_and_Seventh_Sprint.md`
- Plan Reviews: `51_Sprint_7_Plan_Review.md`, `52_Sprint_7_Plan_Final_Review.md`, `53_Sprint_7_Plan_Implementation_GO.md`

**注記**：本ドキュメントは実装担当（本セッション）自身によるImplementation Summaryであり、これまでの `_Review.md` 系ドキュメントのような第三者Reviewerによる独立採点ではない。Verdictは自己検証（Static Analysis / Test Suite / CI / 手動Smoke Test）の結果に基づく。

---

# 1. Verdict

```text
PASS

Critical  0
Major     0
Minor     0 blocking

SPRINT 7 COMPLETE
```

Plan（`50_Development_Setup_and_Seventh_Sprint.md`、F-01〜F-08 / m-01〜m-04 反映済み）どおりの実装が完了し、Static Analysis / 自動Test / CI / 手動Clerk Smoke Testすべてで検証済み。

Smoke Test中に1件のBug（後述、Frontend Routing起因）を発見・修正済み。

---

# 2. 実装範囲

Planの14個のArchitecture Decisionに対する実装状況：

| # | Decision | 実装 |
|---|---|---|
| 1 | `packages/auth`（Provider非依存`AuthAdapter`、`ClerkAuthAdapter`、Session-bound Token検証） | 実装済み |
| 2 | `Account`モデル + Prisma Migration（`authSubject` @unique、`Project.ownerAccountId`） | 実装済み |
| 3 | `AccountRepository.getOrCreateByAuthSubject`（原子的Upsertによる Lazy Provisioning） | 実装済み（後述の通り追加Hardening済み） |
| 4 | Ownership-aware Repository Query（SQLの`WHERE`句でFilter、fetch-then-compareなし） | 実装済み |
| 5 | `apps/api`のFastify Global Hook（`authenticate` / `requireVerifiedEmail`） | 実装済み |
| 6 | `ApiDeps.authAdapter`注入、`CORS_ORIGIN`を`authorizedParties`に再利用（F-03） | 実装済み |
| 7 | 全RouteのOwnership Helper化（`requireOwnedProject` / `requireOwnedAnalysis`） | 実装済み |
| 8 | `ApiErrorCode`への4種追加（`AUTHENTICATION_REQUIRED` / `_INVALID` / `_UNAVAILABLE` / `EMAIL_VERIFICATION_REQUIRED`） | 実装済み |
| 9 | `CORS_ORIGIN`維持（リネームなし） | 実装済み（設計どおりの意図的差異） |
| 10 | Worker / Analyzer / AI非変更 | 確認済み（該当3パッケージへの差分なし） |
| 11 | Frontend Clerk統合（`App.vue`のInitial Navigation Race対処、F-05/F-07） | 実装済み |
| 12 | Testing（`FakeAuthAdapter`、T-AUTHマトリクス） | 実装済み（下記5節） |
| 13 | Product E2E拡張（Account A/B分離） | 実装済み |
| 14 | CI（追加Secret不要） | 確認済み（変更不要） |

---

# 3. Smoke Test中に発見したBug — RESOLVED

問題：

```text
SignInPage.vue / SignUpPage.vue で routing="path" を指定
↓
Clerkが確認コード等の各StepをURL Sub-path（例: /sign-up/verify-email-address）として遷移させようとする
↓
Vue Router側に対応するRouteが存在しない
↓
[VUE_ROUTER_R0004] No match found for location
↓
Email確認コード入力画面が描画されない
↓
Sign Up自体が完了しない（Clerk Dashboard上にUserが1件も作成されない）
```

自動Test（Unit Test / Component Test）では検出できなかった — `@clerk/vue`の`SignIn`/`SignUp`をMockしているため、実際のVue Router連携までは検証範囲外だった。手動Clerk Smoke Testで初めて顕在化。

修正：

```text
routing="path" path="/sign-in" (または /sign-up) を削除
↓
既定の routing="virtual" を使用
↓
ClerkがURLを変更せず内部StateのみでMulti-step Flowを管理
↓
Vue Router側の対応不要
```

`apps/web/src/pages/SignInPage.vue` / `SignUpPage.vue`を修正（`cfbadbe`）。

判定：

```text
RESOLVED（手動Smoke Testで再現・修正確認済み）
```

---

# 4. Account Lazy Provisioningの追加Hardening

Product E2Eの新規Flow（Account B → Account AのProject URL直接アクセス）を実装中、真の並行HTTP Request下（Fastifyの`.inject()`ではなく実`app.listen()` + `fetch()`）で、`getOrCreateByAuthSubject`の原子的Upsertが理論上は安全なはずが、稀に（約1/15回程度）Race由来のUnique Constraint Conflictが`authenticate.ts`のHookで未Catchのまま500として露出する事象を観測した（F-01の意図— 「この種のRaceで500を返さない」— に対する残存Gap）。

`apps/api/src/auth/authenticate.ts`に、`DbError('CONFLICT')`発生時に`findByAuthSubject`で再読込するFallbackを追加（`f74715e`）。以降、同一条件で8並行〜連続15回のE2E再実行を含め再現なし。

---

# 5. Automated Test Coverage

```text
Backend (typecheck/lint/test/build)      PASS   341 tests / 67 files
Frontend (typecheck/lint/test/build)     PASS   73 tests / 21 files
Product E2E                              PASS   2 tests
```

T-AUTHマトリクス（`apps/api/src/__tests__/authorization.test.ts`他）：

```text
T-AUTH-01   Unauthenticated -> 401 AUTHENTICATION_REQUIRED         PASS
T-AUTH-02   Own-resource -> 200                                    PASS
T-AUTH-03/08 Cross-account -> 404（全Route種別、403は存在しない）   PASS
T-AUTH-04   List Isolation（他Accountの一覧に非表示）               PASS
T-AUTH-05   Client供給ownerAccountIdの無視                          PASS
T-AUTH-06   Unverified Email -> 403 EMAIL_VERIFICATION_REQUIRED    PASS
T-AUTH-10   並行初回Requestでの原子的Lazy Provisioning（F-01）      PASS
T-AUTH-11   Auth Provider Unavailable -> 503（401ではない, F-02）  PASS
T-AUTH-12a/12b/15  packages/auth内でClerk Adapterの分類Test        PASS
T-AUTH-13a/13b     apps/web内でInitial Navigation Race Test        PASS
T-AUTH-14   CORS PreflightはAuthorizationなしで成立（m-03）        PASS
```

Queue Payload Token-freedom（`AnalyzerJobData` / `AIExplanationJobData`に`analysisId`以外のFieldが存在しないこと）はTypeの構造そのものにより保証（Worker/Analyzer/AI三Packageへの差分ゼロで確認済み）。

---

# 6. CI

Review HEAD：

```text
cfbadbeabc3a58628855f4d99b54e55316d2a162
```

GitHub Actions：

```text
Run #16 (658ef92, Sprint 7 Backend/Frontend/Product-E2E/README一式)
Status      completed
Conclusion  success
Duration    2m 38s

Run #17 (cfbadbe, Routing Bug修正)
Status      completed
Conclusion  success
Duration    2m 8s
```

追加Secretなし（Fake Auth Adapterのみ使用、Plan Decision 14どおり）。

---

# 7. Manual Clerk Smoke Test

実Clerk Key（Development Instance）を用いて、実User操作で以下を確認：

```text
Sign Up（Email + Password + 確認コード入力）           PASS
Sign In                                                PASS
Project作成 -> Analysis作成 -> Access Log Upload        PASS
実Worker処理 -> 解析結果画面表示                        PASS
サインアウト -> Protected Page直接アクセスでSign Inへ    PASS
別Accountでの2件目User作成                              PASS
Account Bから Account AのProject URLへ直接アクセス -> 404 PASS
```

3節のBug発見・修正はこのSmoke Test中に起きたもので、実装のGapを実際に検出できたことを含め、Smoke Test自体の価値を確認した。

---

# 8. Sprint 7 Final Assessment

```text
Provider-neutral AuthAdapter Boundary       PASS
ClerkAuthAdapter (verifyToken)              PASS
Session-bound Token Check (F-06)            PASS
401 / 503 Error Classification (F-02/F-08)  PASS
Account Lazy Provisioning (F-01)            PASS
  + Residual Race Hardening                 PASS
Ownership-scoped Repository Query           PASS
404 Anti-enumeration (no 403 code)          PASS
Global Authentication Hook                  PASS
Global Email Verification Hook (F-04)       PASS
Client-supplied ownerAccountId Rejection    PASS
CORS_ORIGIN Reuse as authorizedParties(F-03) PASS
Worker / Analyzer / AI Isolation            PASS
Frontend Initial Navigation Race (F-05/F-07) PASS
Frontend Token Injection (apiFetch)         PASS
503 Never Triggers Sign-out                 PASS
Product E2E Account Isolation               PASS
Backend Test Suite (341 tests)              PASS
Frontend Test Suite (73 tests)              PASS
Product E2E (2 tests)                       PASS
Backend / Frontend Build                    PASS
GitHub Actions CI (#16, #17)                PASS
Manual Clerk Smoke Test                     PASS
```

---

# 9. Final Decision

Sprint 7で要求した：

```text
Clerk Sign Up / Sign In
↓
Provider-neutral Auth Boundary (packages/auth)
↓
Account Lazy Provisioning
↓
Project.ownerAccountId によるOwnership
↓
apps/api 全RouteへのAuthentication/Ownership強制
↓
apps/web のClerk統合 + Initial Navigation Race対処
↓
apps/product-e2e でのAccount分離検証
```

が成立し、非所有のProject/Analysisへのアクセスは常に404（存在の有無を推測させない）、Auth Provider障害はToken不正と区別して503を返す、という不変条件も自動Test・実Clerk Smoke Testの両方で確認できた。

Smoke Test中に発見したFrontend Routing Bugは実装のGapであったが、その場で修正・再検証済みであり、残存Blockerはない。

したがって：

```text
SPRINT 7 COMPLETE

Critical  0
Major     0
Minor     0 blocking
```

次Sprint（Billing/Entitlement等、README「含まない」節参照）へ進行可能。

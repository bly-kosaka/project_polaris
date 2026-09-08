# 55_Sprint_7_Independent_Review.md

# Sprint 7 Independent Implementation Review
## Authentication / Ownership（認証・所有権境界）

対象：

- Repository: `bly-kosaka/project_polaris`
- Current HEAD: `034560bfa10946c7cfab21bb6edae125573f41ae`
- Implementation Summary: `md/54_Sprint_7_Review.md`
- Design baseline: `md/50_Development_Setup_and_Seventh_Sprint.md`
- Plan Reviews:
  - `md/51_Sprint_7_Plan_Review.md`
  - `md/52_Sprint_7_Plan_Final_Review.md`
  - `md/53_Sprint_7_Plan_Implementation_GO.md`
- Sprint 6 baseline: `6f7a450f0ea9c18bd6901fe695396e45925042af`

---

# 1. Verdict

```text
PASS WITH FIX

Critical  0
Major     1
Minor     1

SPRINT 7 COMPLETE HOLD
SPRINT 8 GO HOLD
```

`md/54_Sprint_7_Review.md`の自己レビュー内容は大部分で実装と一致している。

以下は独立確認でもPASS：

```text
Clerk Provider Boundary
Session-bound Token Check
authorizedParties
401 / 503 Backend Classification
Account Lazy Provisioning
Residual Race Hardening
Project Ownership
Analysis Ownership
SQL-level Owner Filtering
404 Anti-enumeration
Global Authentication Hook
Global Email Verification Hook
CORS Preflight
Frontend Initial Navigation Race
Product E2E Account Isolation
Real Clerk Smoke Test記録
Current HEAD CI
```

ただし、Frontend Authentication Lifecycleに1件Majorが残る。

---

# 2. Current HEAD / CI

Current HEAD：

```text
034560bfa10946c7cfab21bb6edae125573f41ae
```

Sprint 6 final baselineとの差分：

```text
base 6f7a450f0ea9c18bd6901fe695396e45925042af
↓
6 commits
↓
head 034560bfa10946c7cfab21bb6edae125573f41ae
```

Current HEADに対するGitHub Actions：

```text
Workflow    CI
Run         #18
Run ID      34209525572
Status      completed
Conclusion  success
```

したがって`md/54`記載のRun #16 / #17だけでなく、
Review文書追加後のCurrent HEAD自体もCI Green。

---

# 3. Authentication Boundary — PASS

実装：

```text
@clerk/backend
↓
ClerkAuthAdapter
↓
AuthAdapter
↓
AuthenticatedPrincipal
↓
apps/api Fastify Auth Glue
```

`packages/auth/src/clerk/clerk-auth-adapter.ts`のみがClerk Backend SDKへ依存。

以下を確認：

```text
authorizedParties configured
sid required
sub required
invalid token → AUTHENTICATION_INVALID
provider/JWKS failure → AUTHENTICATION_UNAVAILABLE
users.getUser() failure → AUTHENTICATION_UNAVAILABLE
primary email verification fallback
```

PlanのF-02 / F-03 / F-06 / F-08に沿っている。

---

# 4. Session-bound Token Check — PASS

実装では`verifyToken()`成功後：

```typescript
if (
  typeof verified.sid !== 'string' ||
  verified.sid.length === 0 ||
  typeof verified.sub !== 'string' ||
  verified.sub.length === 0
) {
  throw AUTHENTICATION_INVALID
}
```

となっている。

Sprint 7のBrowser Session Authentication境界として承認。

---

# 5. Account Lazy Provisioning — PASS

実装：

```text
Account.authSubject @unique
↓
Prisma upsert
```

に加え、実HTTP Product E2Eで発見されたresidual unique conflictに対し：

```text
DbError(CONFLICT)
↓
findByAuthSubject()
↓
existing Account reuse
```

を追加している。

これはPlan F-01の目的：

> concurrent first requestsで500を返さない

を満たすHardeningとして妥当。

---

# 6. Ownership — PASS

Project：

```text
Project.ownerAccountId
```

Analysis：

```text
Analysis.projectId
↓
Project.ownerAccountId
```

Repositoryは：

```text
findByIdForOwner()
listAllWithSummaryForOwner()
Analysis.findByIdForOwner()
```

を用意し、Prisma `where`自体へOwnership条件を含めている。

Route Handlerで取得後にowner比較する方式ではない。

承認。

---

# 7. Cross-account IDOR — PASS

以下すべてでOther Accountは404：

```text
GET Project
GET Project Analyses
POST Analysis Create
GET Analysis
GET ObservationSet
POST Upload
GET AI Explanation
POST AI Retry
```

`403 FORBIDDEN`等の存在推測用Error Codeは追加されていない。

Product E2Eでも：

```text
Account B
↓
Account A Project URL
↓
404
```

を確認している。

---

# 8. Email Verification — PASS

Global Hook：

```text
authenticate
↓
requireVerifiedEmail
↓
route
```

Source of Truth：

```text
req.principal.emailVerified
```

DBの`Account.emailVerified` snapshotではない。

Plan F-04どおり。

---

# 9. Frontend Initial Navigation — PASS

Initial Navigationについて：

```text
router.beforeEach
↓
!isAuthLoaded
→ redirectしない
↓
App.vue
↓
Clerk isLoaded
↓
token getter install
↓
current route再評価
↓
signed-outならSign In
↓
isAuthLoaded=true
↓
RouterView mount
```

となっている。

T-AUTH-13a / 13bもあり：

```text
signed-in initial Protected URL
→ premature Sign In redirectなし

signed-out initial Protected URL
→ Protected Component / API callなし
```

を確認。

前回F-07は解消。

---

# 10. Smoke Test Routing Bug — RESOLVED

`md/54`記載の：

```text
routing="path"
↓
/sign-up/verify-email-address
↓
Vue Router no match
↓
verification UI inaccessible
```

はcommit：

```text
cfbadbeabc3a58628855f4d99b54e55316d2a162
```

でClerk default virtual routingへ変更済み。

Current HEADにも反映されている。

手動Smoke Testで実際に検出・修正された点として評価できる。

---

# 11. Major M-01 — Runtime Authentication LossのFrontend Recoveryが未実装

## Plan Contract

Sprint 7 Plan / Final GOではFrontend Error Handlingを：

```text
401 AUTHENTICATION_REQUIRED / AUTHENTICATION_INVALID
↓
Session再確認
↓
必要ならSign In

503 AUTHENTICATION_UNAVAILABLE
↓
Temporary Error
↓
Sign-outしない
```

としていた。

503側は満たしている。

しかし401側は満たしていない。

---

## Current Implementation

`apps/web/src/api/client.ts`は401を含む全Backend Errorを：

```typescript
throw new ApiError(status, code, message)
```

するだけ。

Authentication-specific callback / session re-check / router redirectは存在しない。

各Pageは例えば：

```text
listProjects()
↓
catch(error)
↓
ErrorState
```

となる。

`ErrorState.vue`にも：

```text
AUTHENTICATION_REQUIRED
AUTHENTICATION_INVALID
```

専用分岐はない。

したがって：

```text
User signed in
↓
Protected Page mounted
↓
session revoked / expired / backend sees invalid token
↓
API returns 401 AUTHENTICATION_INVALID
↓
Frontend
→ Sign Inへ遷移しない
→ generic ErrorState
```

となる。

---

## Reactive Clerk Sign-outでも現在Routeは自動退避しない

`App.vue`には：

```typescript
watch(clerkSignedIn, value => {
  isSignedIn.value = value ?? false;
});
```

がある。

しかし`isAuthLoaded === true`になった後：

```text
clerkSignedIn
true → false
```

へ変化しても、

```text
current protected route
→ sign-in redirect
```

する処理はない。

Router Guardは：

```text
次のNavigation時
```

にしか発火しない。

よってcurrent Protected Componentはそのまま残る。

Account Settingsの明示的Sign Outだけは：

```text
signOut()
↓
router.replace(sign-in)
```

を行うため問題ないが、

```text
session expiration
session revocation
Clerk側sign-out state change
401 from Backend
```

には対応できない。

---

## Impact

Security BoundaryはBackendなので、Unauthorized Data Leakは起きない。

したがってCriticalではない。

しかし：

```text
Authentication Lifecycle
```

のProduct Contractを満たさず、ユーザーが復帰不能に近いgeneric error状態へ落ちる。

Sprint 7の中心機能そのものに関するためMajorとする。

---

## Required Fix

Authentication Error HandlerをFrontendで一箇所へ集約する。

推奨は`api/client.ts`へRouterを直接importするのではなく、
tokenGetterと同じPatternでCallback注入：

```typescript
let authenticationFailureHandler:
  | ((error: ApiError) => Promise<void> | void)
  | undefined;

export function setAuthenticationFailureHandler(handler): void {
  authenticationFailureHandler = handler;
}
```

`apiFetch()`：

```text
401
+
AUTHENTICATION_REQUIRED / AUTHENTICATION_INVALID
↓
authenticationFailureHandler()
↓
throw ApiError
```

App.vue：

```text
Clerk session re-check / signed-in state確認
↓
invalidならSign Inへreplace
```

あるいはより単純にApp.vueで：

```typescript
watch(clerkSignedIn, async (value) => {
  isSignedIn.value = value ?? false;

  if (
    isAuthLoaded.value &&
    !isSignedIn.value &&
    router.currentRoute.value.meta.requiresAuth
  ) {
    await router.replace({
      name: 'sign-in',
      query: { redirect: router.currentRoute.value.fullPath },
    });
  }
});
```

を追加し、

さらにBackend 401を受けた場合の再確認Triggerを用意する。

最低限：

```text
AUTHENTICATION_INVALID
→ Sign Inへ安全に復帰
```

を保証する。

---

## Required Tests

追加：

```text
T-AUTH-16a

Protected Page mounted
↓
clerkSignedIn true → false
↓
Sign Inへredirect
```

追加：

```text
T-AUTH-16b

apiFetch receives
401 AUTHENTICATION_INVALID
↓
Authentication recovery handler invoked
↓
503ではinvokeされない
```

既存：

```text
503 AUTHENTICATION_UNAVAILABLE
→ sign-outしない
```

Regressionも維持する。

---

# 12. Minor m-01 — Sign In redirect queryが消費されていない

Router Guard / App Gateは：

```text
/sign-in?redirect=<original-path>
```

を生成する。

しかし`SignInPage.vue`ではこの`redirect` queryを明示的にClerkへ渡していない。

Clerk default redirect behaviorにより通常のSign In後導線は成立している可能性が高く、
Manual SmokeもPASSしている。

ただし：

```text
original Protected URL
↓
Sign In
↓
original URLへ戻る
```

というUXをPolaris側で保証してはいない。

Sprint 7 Blockingにはしない。

後続で必要ならCurrent Clerk APIに合わせてredirect設定を追加する。

---

# 13. `md/54_Sprint_7_Review.md`との差分

`md/54`の以下の判定は独立Reviewでも支持する：

```text
Provider-neutral AuthAdapter Boundary       PASS
Session-bound Token Check                   PASS
401 / 503 Backend Classification            PASS
Account Lazy Provisioning                   PASS
Ownership-scoped Repository Query           PASS
404 Anti-enumeration                        PASS
Global Authentication Hook                  PASS
Global Email Verification Hook              PASS
Worker / Analyzer / AI Isolation            PASS
Frontend Initial Navigation Race            PASS
Product E2E Account Isolation               PASS
Automated Tests                             PASS
CI                                          PASS
Manual Clerk Smoke                          PASS
```

一方：

```text
SPRINT 7 COMPLETE
Critical 0 / Major 0
```

は現時点では承認しない。

理由：

```text
Runtime Authentication Loss
↓
Frontend recovery missing
```

の1点。

---

# 14. Current CI Assessment

Current HEAD `034560b...`：

```text
CI Run #18
completed
success
```

Automated Test Greenは確認済み。

今回のM-01は：

```text
未テストのRuntime Auth Lifecycle Case
```

なので、CI Greenと矛盾しない。

---

# 15. Final Decision

```text
SPRINT 7 IMPLEMENTATION

PASS WITH FIX

Critical  0
Major     1
Minor     1

SPRINT 7 COMPLETE HOLD
SPRINT 8 GO HOLD
```

必要な修正はFrontend Authentication Lifecycleの局所修正のみ。

Backend / DB / Ownership / Clerk Adapterの再設計は不要。

修正後に：

```text
T-AUTH-16a
T-AUTH-16b
Frontend tests
Product E2E
CI
```

を確認すれば、Sprint 7 Final PASSへ進める。

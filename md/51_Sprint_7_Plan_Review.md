# 51_Sprint_7_Plan_Review.md

# Sprint 7 Implementation Plan Review
## Authentication / Ownership（認証・所有権境界）

対象：

- Plan: `tidy-pondering-stonebraker(5).md`
- Design baseline: `50_Development_Setup_and_Seventh_Sprint.md`
- Current Repository HEAD: `6f7a450f0ea9c18bd6901fe695396e45925042af`
- Previous Sprint: `49_Sprint_6_Final_Review.md` — Sprint 6 COMPLETE

---

# 1. Verdict

```text
GO WITH FIXES

Critical  0
Major     5
Minor     3
```

全体Architectureは承認する。

特に以下は良い：

```text
Clerk SDK
↓
packages/auth
↓
AuthenticatedPrincipal
↓
Api Auth Glue
↓
Account
↓
Ownership-aware Repository
```

という境界、

```text
Account
↓ owns
Project
↓ owns
Analysis
```

というOwnership Chain、

```text
Worker / Analyzer / AIProvider
```

へClerk / Accountを流さない方針はSprint 7の設計目的と一致している。

再設計は不要。

ただしAuthenticationはセキュリティ境界なので、下記5点はPlanへ反映してから実装すること。

---

# 2. APPROVED Architecture

## 2.1 packages/auth

Provider-neutral：

```typescript
AuthAdapter
AuthenticatedPrincipal
```

を定義し、

```text
ClerkAuthAdapter
```

だけが`@clerk/backend`をimportする方針を承認。

```text
apps/api
packages/db
packages/domain
Worker
Analyzer
AI
```

へClerk SDK型を漏らさない。

---

## 2.2 Account / Project Ownership

以下を承認：

```text
Account
Project.ownerAccountId
```

OwnershipはProjectへ持たせ、

```text
Analysis
ObservationSet
AIExplanation
UploadedAccessLog
```

にはownerAccountIdを重複保存しない。

---

## 2.3 SQL-level Ownership Filter

以下を承認：

```typescript
findByIdForOwner(...)
listAllWithSummaryForOwner(...)
findAnalysisByIdForOwner(...)
```

Routeで：

```text
findById()
↓
JavaScriptでowner比較
```

するのではなく、Prisma queryの`where`自体へOwnership条件を入れる方針は重要。

---

## 2.4 404 Ownership Policy

Other Account Resource：

```text
403 Forbidden
```

ではなく：

```text
404 PROJECT_NOT_FOUND
404 ANALYSIS_NOT_FOUND
```

へ統一する方針を承認。

IDOR対策とResource existence leak抑止に合っている。

---

## 2.5 Worker Boundary

Queue payload：

```text
analysisId
```

のみで、

```text
JWT
Clerk Token
Session Token
Account Credential
```

を含めない方針を承認。

Sprint 1〜6のAnalyzer / AI Contractは変更しない。

---

# 3. Major M-01 — Lazy Provisioningをatomic / idempotentにする

Planは初回authenticated requestで：

```text
findByAuthSubject()
↓
not found
↓
create()
```

としている。

これは並行Requestでraceする。

Frontend起動直後には普通に：

```text
GET /projects
GET account/session-related state
other page requests
```

等が重なる可能性がある。

同じClerk subjectから2 Requestが同時に来ると：

```text
Request A → find null
Request B → find null
Request A → Account create success
Request B → Account create P2002
```

となり、正しいユーザーなのに片方が500になる。

## Required Fix

Account Provisioningは必ずidempotentにする。

推奨：

```typescript
getOrCreateByAuthSubject(...)
```

をRepository/Application Boundaryへ作る。

実装候補：

### Option A — Prisma upsert

```text
unique authSubject
↓
upsert
```

### Option B — create conflict recovery

```text
find
↓
create
↓
P2002
↓
refetch
```

どちらでもよい。

重要なのは：

> First authenticated API requests can safely race.

## Required Test

```text
same auth subject
↓
parallel authenticated requests
↓
Account row = exactly 1
↓
all requests succeed
```

を実DBで確認する。

---

# 4. Major M-02 — Authentication InvalidとAuthentication Unavailableを分離する

Planでは`packages/auth`に：

```text
AUTHENTICATION_INVALID
AUTHENTICATION_UNAVAILABLE
```

を用意している。

しかしAPI Hook側の説明は：

```text
verifyToken throws
↓
401 AUTHENTICATION_INVALID
```

へまとめている。

これは不正確。

Clerk / JWKS / Network等の一時障害は：

```text
token invalid
```

ではない。

ここを401へするとFrontendが：

```text
valid session
↓
Clerk backend temporary outage
↓
401
↓
Sign Inへredirect
```

となる。

## Required Fix

明示的に：

```text
Missing Authorization
→ 401 AUTHENTICATION_REQUIRED

Invalid / expired / malformed token
→ 401 AUTHENTICATION_INVALID

Auth Provider / JWKS temporary unavailable
→ 503 AUTHENTICATION_UNAVAILABLE
```

とする。

Frontendも：

```text
401
→ session/sign-in処理

503 AUTHENTICATION_UNAVAILABLE
→ temporary error
→ sign-outしない
```

とする。

## Required Tests

```text
FakeAuthAdapter invalid
→ 401

FakeAuthAdapter unavailable
→ 503

503でFrontendがsign-in redirectしない
```

を追加する。

---

# 5. Major M-03 — Clerk token verificationへ authorizedParties を必須化する

Current Clerk Backend documentationでは、session authentication時：

```text
authorizedParties
```

を明示することが推奨されている。

Planの`ClerkAuthAdapter.verifyToken(token)`にはこの設定がない。

Sprint 7はAuthentication Boundaryを作るSprintなので、ここは初期実装から固定する。

## Required Fix

Clerk Adapterを例えば：

```typescript
new ClerkAuthAdapter({
  secretKey,
  authorizedParties: [corsOrigin],
})
```

のように構築する。

または専用env：

```text
CLERK_AUTHORIZED_PARTIES
```

を導入してもよい。

MVPでFrontend Originが1つなら：

```text
CORS_ORIGIN
```

と同じ値を利用するのが単純。

さらにAccepted Token Typeは：

```text
session token
```

に限定する。

Sprint 7のBrowser User Authenticationで：

```text
API key
M2M
OAuth machine token
```

を受け入れる理由はない。

## Required Test

```text
valid Clerk token
+
unexpected authorized party
→ AUTHENTICATION_INVALID
```

をAdapter testで確認する。

---

# 6. Major M-04 — Email Verification PolicyをPlan内で統一する

`50_Development_Setup_and_Seventh_Sprint.md`では最終的な推奨MVP Policyとして：

```text
Unverified
→ Product Resource API
→ 403 EMAIL_VERIFICATION_REQUIRED
```

としている。

一方今回Planは：

```text
requireVerifiedEmail()
```

を以下4 Mutationだけへ適用する：

```text
POST /projects
POST /projects/:projectId/analyses
POST /analyses/:id/upload
POST /analyses/:id/explanation/retry
```

としている。

これはPolicyが一致していない。

## Required Fix

実装前にどちらかへ明示的に統一する。

### Recommended

Sprint 7 design baselineどおり：

```text
Authenticated
+
Email Verified
↓
Product Resource APIs
```

とする。

つまりAccount / Verification用のPublic/Auth UI以外：

```text
/projects
/analyses
/observations
/explanation
```

も含めProduct APIを403に統一する。

理由：

- Policyが単純
- Routeごとの例外が減る
- Verification enforcement漏れを防止
- Test Matrixが明確

もしRead-onlyだけ許可する方針へ変えたいなら、Planに**設計変更として明示**すること。

現状の「doc §10の4 route」とする説明はBaselineを正確に反映していない。

---

# 7. Major M-05 — Frontend Auth Initialization順序を確定する

Planでは：

```text
main.ts
→ clerkPlugin

App.vue
→ useAuth()
→ setTokenGetter()

router.beforeEach
→ authentication guard
```

を想定しているが、

```text
router.beforeEachからuseAuth()を呼べるか
```

をOpen Riskとして残している。

Authenticationの中心導線なので、このまま実装開始するのは避ける。

また、Protected Pageが：

```text
Clerk loaded
Token getter installed
```

より先にmountすると、

```text
apiFetch()
↓
tokenGetter undefined
↓
Authorizationなし
↓
401
```

というstartup raceになる。

## Required Fix

Plan段階で次のInvariantを固定する：

> Protected page components must not mount until Clerk auth state is loaded and the API token getter is installed.

推奨実装：

```text
App.vue
↓
useAuth()
↓
isLoaded wait
↓
setTokenGetter(() => getToken.value())
↓
authenticated?
├─ no → Sign In
└─ yes → RouterView
```

Route GuardはUXとして追加してよいが、Security Boundaryではない。

`useAuth()`をplain `router.beforeEach`内で使えるかにArchitectureを依存させない方が安全。

現行Clerk Vue docsでは`getToken`は：

```typescript
Ref<(options?) => Promise<string | null>>
```

なので、Sprint 7で使用する形は：

```typescript
getToken.value()
```

で固定してよい。

---

# 8. Minor m-01 — Primary Email Verificationのmappingを具体化する

Planは：

```text
session claimsにemail/email_verifiedがあれば使用
なければ users.getUser(sub)
```

としているが、default Session Tokenにemail verification情報が必ず含まれるとは限らない。

FallbackのUser mappingをPlanへ明記する。

推奨：

```text
User.primaryEmailAddressId
↓
User.emailAddresses.find(id)
↓
EmailAddress.verification?.status === 'verified'
```

Email：

```text
primary EmailAddress.emailAddress
```

を使う。

「UserにemailVerified booleanがある前提」で実装しない。

---

# 9. Minor m-02 — Best-effort Account profile refreshはUnhandled Promiseを作らない

PlanではDB snapshot：

```text
email
emailVerified
```

をbest-effortでrefreshし、「blockingしない」としている。

Fire-and-forget Promiseにする場合も：

```typescript
void repo.updateProfile(...).catch(...)
```

のように必ずrejectionを処理する。

より単純には：

```text
try
  await updateProfile
catch
  ignore/log-safe
```

でもよい。

Authentication successをprofile snapshot write失敗で落とさない、というContractを明示する。

---

# 10. Minor m-03 — Global preHandler導入後のCORS preflight regression testを追加

現在APIにはglobal Authentication Hookがない。

Sprint 7で：

```text
app.addHook('preHandler', authenticate)
```

を初導入する。

ブラウザの：

```text
OPTIONS preflight
```

がAuthentication Hookによって401にならないことをRegression Testする。

`@fastify/cors`がpreflightを処理する構成でも、Authentication追加時に一度明示テストしておく価値がある。

Test：

```text
OPTIONS /projects
Origin: allowed frontend
Access-Control-Request-Method: GET
without Authorization
↓
CORS preflight succeeds
```

---

# 11. Dependency / Clerk Verification Notes

Implementation前にCurrent Clerk documentationとinstalled package typeを確認する方針は正しい。

Review時点で確認できた事項：

## Backend

Clerkは：

```text
authenticateRequest()
```

を通常のRequest Authenticationとして推奨している。

`verifyToken()`は利用可能だがlower-level API。

今回のArchitectureは：

```text
Bearer token extraction
↓
AuthAdapter.verifyToken(token)
```

をProvider-neutralにしたいので、`verifyToken()`採用自体は許容する。

ただし：

```text
authorizedParties
session-token only
```

を必須にすること。

## Vue

Current Vue SDKでは：

```typescript
getToken
```

はRef。

したがって：

```typescript
await getToken.value()
```

がCurrent documented shape。

PlanのOpen Risk #2は解消済みとしてよい。

---

# 12. Test Matrix — Planへ追加すべき項目

既存T-AUTH-01〜09に加え：

```text
T-AUTH-10
Concurrent Lazy Provisioning
→ same subject, one Account, all requests success

T-AUTH-11
Auth Provider unavailable
→ 503, no sign-out redirect

T-AUTH-12
Authorized Party mismatch
→ 401 invalid

T-AUTH-13
Frontend Clerk initialization
→ Protected API not called before auth loaded/token getter ready

T-AUTH-14
CORS preflight
→ no Authorization headerでもpreflight succeeds
```

を追加する。

---

# 13. Plan Revision Required

実装前に最低限以下をPlanへ反映：

```text
F-01
Lazy Provisioningをatomic/idempotent化

F-02
AUTHENTICATION_INVALID と AUTHENTICATION_UNAVAILABLE をHTTP上で分離

F-03
Clerk authorizedParties + session-token-only verification

F-04
Email Verification PolicyをRead含む全Product APIかMutation-onlyか明示的に統一
推奨：全Product Resource API

F-05
Clerk loaded + token getter initialized beforeProtected Page mountをFrontend invariant化
```

Minor：

```text
m-01
Primary Email verification mapping明示

m-02
Best-effort profile refresh rejection handling

m-03
CORS preflight regression test
```

---

# 14. Final Assessment

```text
Overall Architecture                 PASS
packages/auth boundary               PASS
Account model                         PASS
Project ownership                     PASS
SQL-level ownership filtering         PASS
404 anti-enumeration policy           PASS
Worker/Auth separation                PASS
Analyzer/Auth separation              PASS
AI/Auth separation                    PASS
Fake Auth test approach               PASS
Product E2E direction                 PASS

Lazy provisioning concurrency         FIX REQUIRED
Auth provider outage semantics        FIX REQUIRED
Clerk authorizedParties               FIX REQUIRED
Email verification policy             FIX REQUIRED
Frontend auth initialization race     FIX REQUIRED
```

---

# 15. Final Verdict

```text
SPRINT 7 IMPLEMENTATION PLAN

GO WITH FIXES

Critical  0
Major     5
Minor     3
```

Architectureの作り直しは不要。

F-01〜F-05をPlanへ反映し、Test Matrixを追加したRevisionをもう一度確認してからImplementation GOとする。

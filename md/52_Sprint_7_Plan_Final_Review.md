# 52_Sprint_7_Plan_Final_Review.md

# Sprint 7 Implementation Plan — Final Re-review
## Authentication / Ownership（認証・所有権境界）

対象：

- Revised Plan: `tidy-pondering-stonebraker(6).md`
- Design baseline: `50_Development_Setup_and_Seventh_Sprint.md`
- Previous review: `51_Sprint_7_Plan_Review.md`
- Current Repository HEAD: `6f7a450f0ea9c18bd6901fe695396e45925042af`

---

# 1. Verdict

```text
GO WITH FIXES

Critical  0
Major     3
Minor     1
```

前回の：

```text
Critical 0
Major    5
Minor    3
```

に対し、以下は解消を確認した。

```text
F-01 Lazy Provisioning race                RESOLVED
F-04 Email Verification Policy             RESOLVED
m-01 Primary Email mapping                 RESOLVED
m-02 Best-effort profile refresh           RESOLVED
m-03 CORS preflight regression test        RESOLVED
```

また：

```text
F-02 Auth unavailable semantics
F-03 Clerk token hardening
F-05 Frontend initialization
```

も方向性は改善された。

ただしF-02/F-03/F-05には実装上の保証がまだ不足しているため、
3点だけPlanを補正してからImplementation GOとする。

Architectureの再設計は不要。

---

# 2. F-01 — RESOLVED

Lazy Provisioningは：

```text
find
↓
create
```

から：

```text
Prisma upsert
↓
authSubject unique
```

へ変更された。

これにより同じClerk subjectによる並行初回Requestでも：

```text
Account row = 1
all requests succeed
```

へ収束する。

T-AUTH-10も追加済み。

```text
F-01 RESOLVED
```

---

# 3. F-04 — RESOLVED

Email VerificationはMutation-onlyから：

```text
All Protected Product Resource APIs
```

へ統一された。

Global：

```text
authenticate
↓
requireVerifiedEmail
↓
route
```

となり、`req.principal.emailVerified`をSource of Truthとして使う。

Routeごとの適用漏れが発生しない。

```text
F-04 RESOLVED
```

---

# 4. m-01 / m-02 / m-03 — RESOLVED

## Primary Email

```text
primaryEmailAddressId
↓
emailAddresses.find(...)
↓
emailAddress
verification.status === verified
```

が明示された。

## Profile Refresh

Best-effort updateを：

```typescript
try {
  await updateProfile(...)
} catch {
  // auth successは維持
}
```

としてUnhandled Rejectionを作らない。

## CORS

Authentication global preHandler追加後の：

```text
OPTIONS preflight
without Authorization
```

をT-AUTH-14で検証する。

すべて解消。

---

# 5. Major M-01 — F-03は部分解消：Session Token限定の具体的判定が不足

Revised Planでは：

```text
authorizedParties
+
session-token-only
```

を固定した。

`authorizedParties`追加は正しい。

しかしPlan内には：

> session token only

という要求はあるものの、

```text
verifyToken()成功後に何を見てSession Tokenと判定するか
```

が書かれていない。

Clerkの`verifyToken()` optionsには現在：

```text
authorizedParties
audience
headerType
...
```

はあるが：

```text
tokenType: 'session'
```

のようなSession限定optionは存在しない。

さらにClerk custom JWTも：

```text
azp
sub
```

等を持ち得る。

したがって：

```text
authorizedPartiesだけ
```

ではPlanが要求する「Browser Session Token限定」の保証にはならない。

## Required Fix

`verifyToken()`成功後、Session-bound tokenであることを明示的に検証する。

MVP推奨：

```text
verified.sid exists
+
verified.sub is user subject
```

最低でも`sid`を必須にする。

ClerkのSession Tokenには`sid`がdefault claimとして存在し、
custom JWT templateのtokenには`sid`が含まれない。

例：

```typescript
const verified = await verifyToken(...);

if (
  typeof verified.sid !== 'string' ||
  verified.sid.length === 0 ||
  typeof verified.sub !== 'string' ||
  !verified.sub.startsWith('user_')
) {
  throw new AuthError('AUTHENTICATION_INVALID', ...);
}
```

実際の型に合わせて実装する。

## Test追加

T-AUTH-12を：

```text
A. authorized party mismatch
→ INVALID

B. validly signed token but sid missing
→ INVALID
```

の2ケースにする。

```text
F-03 PARTIALLY RESOLVED
```

---

# 6. Major M-02 — F-05は部分解消：Initial Router Navigation raceが残る

Revised Planでは：

```text
App.vue
↓
useAuth()
↓
isLoaded
↓
setTokenGetter()
↓
RouterView mount
```

へ整理され、

```text
API call before tokenGetter initialization
```

は解消方向。

しかし：

```text
router.beforeEach
```

は`App.vue setup()`より前のInitial Navigationでも実行され得る。

`auth-state.ts`初期値：

```typescript
isAuthLoaded = false
isSignedIn = false
```

のままInitial Protected URLへアクセスすると、
Guardの書き方次第では：

```text
signed-in user
↓
initial navigation
↓
isAuthLoaded false / isSignedIn false
↓
/sign-inへredirect
↓
その後Clerk load
```

となる。

つまり：

> `useAuth()`をRouter Guardから除いた

だけではInitial Navigation raceは完全には閉じていない。

## Required Fix

Guard behaviorをPlanへ具体化する。

推奨：

```typescript
router.beforeEach((to) => {
  if (!to.meta.requiresAuth) return true;

  // Clerk未初期化中はredirect判断をしない。
  // App-level Auth GateがRouterView mountを止めている。
  if (!isAuthLoaded.value) return true;

  if (!isSignedIn.value) return { name: 'sign-in' };

  return true;
});
```

さらにApp側でClerk load完了時：

```text
isLoaded = true
↓
if current route requiresAuth && !signedIn
↓
router.replace(sign-in)
```

を行う。

重要なInvariant：

```text
Clerk未load
→ Protected routeへのredirect判定をしない
→ RouterViewもmountしない

Clerk loaded + signed out
→ Protected RouterViewをmountする前にSign Inへ
```

をテストする。

T-AUTH-13は：

```text
signed-in initial protected URL
signed-out initial protected URL
```

の両方を含める。

```text
F-05 PARTIALLY RESOLVED
```

---

# 7. Major M-03 — F-02の503分類をgetUser fallbackにも適用する

Revised Planでは：

```text
verifyToken invalid
→ 401

verifyToken provider unavailable
→ 503
```

が明確になった。

これは正しい。

ただし`ClerkAuthAdapter`にはその後：

```text
session claimsにemail verificationなし
↓
client.users.getUser(sub)
```

というBackend API callがある。

Default Clerk Session Tokenではemail/email_verifiedをcustomizeしていなければ、
このfallbackが通常経路になり得る。

ここで：

```text
Clerk Backend timeout
5xx
rate/network failure
```

が発生した場合もAuthentication Provider dependency failureであり、
500 Internal Errorや401 Invalidにしてはいけない。

## Required Fix

Adapter全体のExternal Clerk calls：

```text
verifyToken()
users.getUser()
```

双方を同じError Classification Contractへ入れる。

```text
invalid token / wrong party / non-session token
→ AUTHENTICATION_INVALID

Clerk/JWKS/Backend API temporary unavailable
→ AUTHENTICATION_UNAVAILABLE
```

とする。

特に：

```text
getUser network / 5xx / timeout
→ 503
```

を明示する。

## Required Test

packages/auth adapter tests：

```text
verifyToken temporary failure
→ UNAVAILABLE

getUser temporary failure after valid token
→ UNAVAILABLE
```

を両方入れる。

### Operational Note

custom Session claimsを設定しない構成では、
Email Verificationを全Product APIでfreshに判定するため
`getUser()`が各requestのClerk Backend API dependencyになり得る。

MVP規模では許容可能だが：

```text
latency
Backend API rate limit
Clerk API availability coupling
```

が発生することはREADME / Deployment noteへ明記しておくとよい。

将来は：

```text
custom session claims
or
short-lived verified profile cache
```

を検討できる。

Sprint 7ではcacheは不要。

```text
F-02 PARTIALLY RESOLVED
```

---

# 8. Minor m-04 — authSubject uniquenessとauthProvider引数の整合

Schema：

```prisma
authProvider String
authSubject  String @unique
```

Repository：

```typescript
findByAuthSubject(authProvider, authSubject)
```

という形になっている。

Sprint 7はClerk onlyなので問題は起きない。

ただし将来Provider追加時：

```text
Provider A subject = xyz
Provider B subject = xyz
```

をDBが区別できない。

一方Sprint 7 baseline自身が：

```text
authSubject unique
```

としているため、Blockingではない。

今回はそのままでよい。

将来multi-providerを本当に実装するとき：

```prisma
@@unique([authProvider, authSubject])
```

へ変更すること。

---

# 9. Current Clerk API確認

Review時点のClerk documentationでは：

## verifyToken

`verifyToken()`はlower-level API。

optionsに：

```text
authorizedParties
```

が存在し、設定推奨。

ただし：

```text
tokenType = session
```

のoptionはない。

## Session Token

Session Token default claimsには：

```text
sid
sub
azp
```

が含まれる。

custom JWT templateには`sid`が含まれないため、
Session-bound token確認には`sid`が有効。

## Vue

`useAuth()`の：

```text
isLoaded
isSignedIn
getToken
```

はいずれもVue `Ref`。

```typescript
await getToken.value()
```

で正しい。

---

# 10. Revised Test Matrix

PlanのT-AUTH-01〜14へ次を補強する。

```text
T-AUTH-12a
authorizedParties mismatch
→ 401 INVALID

T-AUTH-12b
valid Clerk JWT / sid absent
→ 401 INVALID

T-AUTH-13a
signed-in user opens protected URL directly
↓
Clerk not loaded yet
↓
no premature sign-in redirect
↓
after load protected page mounts

T-AUTH-13b
signed-out user opens protected URL directly
↓
Clerk not loaded
↓
protected component never makes API call
↓
after load sign-in redirect

T-AUTH-15
valid token
↓
email claims absent
↓
getUser temporary failure
↓
503 AUTHENTICATION_UNAVAILABLE
```

---

# 11. Final Assessment

```text
Overall Architecture                     PASS
packages/auth boundary                   PASS
Atomic Lazy Provisioning                 PASS
Account / Project ownership              PASS
SQL-level owner filtering                PASS
404 anti-enumeration                     PASS
Global email verification policy         PASS
Primary email mapping                    PASS
Profile refresh failure isolation        PASS
CORS preflight coverage                  PASS
Worker / Analyzer / AI isolation         PASS
Fake Auth test approach                  PASS

Session-token-only enforcement           FIX REQUIRED
Initial Router navigation ordering       FIX REQUIRED
getUser outage classification            FIX REQUIRED
```

---

# 12. Final Verdict

```text
SPRINT 7 IMPLEMENTATION PLAN

GO WITH FIXES

Critical  0
Major     3
Minor     1
```

今回残った3点はいずれも局所修正。

Architecture変更は不要。

以下をPlanへ反映すればImplementation GO：

```text
F-06
verified tokenのsidを必須にし、
session-bound tokenであることを明示検証

F-07
router.beforeEachのClerk未load時挙動と
App-level redirect順序を明文化

F-08
users.getUser() fallback failureも
AUTHENTICATION_UNAVAILABLEへ分類
```

F-06〜F-08反映後は、追加の大きなPlan Reviewなしで実装へ進める見込み。

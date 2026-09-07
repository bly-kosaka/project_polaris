# 53_Sprint_7_Plan_Implementation_GO.md

# Sprint 7 Implementation Plan — Final Approval
## Authentication / Ownership（認証・所有権境界）

対象：

- Final Revised Plan: `tidy-pondering-stonebraker(7).md`
- Design baseline: `50_Development_Setup_and_Seventh_Sprint.md`
- First review: `51_Sprint_7_Plan_Review.md`
- Second review: `52_Sprint_7_Plan_Final_Review.md`
- Current Repository HEAD at planning baseline: `6f7a450f0ea9c18bd6901fe695396e45925042af`

---

# 1. Final Verdict

```text
PASS

Critical  0
Major     0
Minor     1 non-blocking

SPRINT 7 IMPLEMENTATION GO
```

2回のPlan Reviewで指摘したBlocking項目はすべて最終Revisionへ反映された。

Architectureの再設計、追加Plan Reviewは不要。

このPlanをSprint 7実装のAuthoritative Baselineとして扱う。

---

# 2. Previous Findings Resolution

## First Review

```text
F-01 Atomic / Idempotent Lazy Provisioning       RESOLVED
F-02 Invalid vs Provider Unavailable              RESOLVED
F-03 Clerk Token Hardening                        RESOLVED
F-04 Email Verification Policy                    RESOLVED
F-05 Frontend Auth Initialization                 RESOLVED

m-01 Primary Email Verification Mapping           RESOLVED
m-02 Best-effort Profile Refresh                  RESOLVED
m-03 CORS Preflight Regression                    RESOLVED
```

## Second Review

```text
F-06 Session-bound Token Check                    RESOLVED
F-07 Initial Navigation Race                      RESOLVED
F-08 getUser() Failure Classification             RESOLVED
```

残る：

```text
m-04 authProvider + authSubject compound unique
```

はClerk-onlyのSprint 7ではBlockingではない。

---

# 3. F-06 — RESOLVED

最終Planでは：

```text
verifyToken()
↓
authorizedParties validation
↓
sid required
↓
sub required
↓
AuthenticatedPrincipal
```

となった。

ClerkのSession Tokenにはsession-bound claimとして`sid`が含まれる。一方Custom JWT Templateには`sid`が含まれない。

したがって：

```text
verified token
+
sid absent
→ AUTHENTICATION_INVALID
```

というMVP判定は妥当。

T-AUTH-12a / 12b：

```text
wrong authorized party
→ 401 INVALID

verified JWT but no sid
→ 401 INVALID
```

も明示された。

---

# 4. F-07 — RESOLVED

Initial Navigation raceへの対処がArchitectureとして具体化された。

```text
Initial URL Navigation
↓
router.beforeEach
↓
auth not loaded
→ redirectしない
↓
App.vue Auth Gate
↓
Clerk isLoaded
↓
Token Getter install
↓
actual signed-in state resolve
↓
current route再評価
├─ signed-in → original protected route
└─ signed-out → Sign Inへreplace
↓
isAuthLoaded = true
↓
RouterView mount
```

これにより、signed-in userのpremature Sign In redirectと、signed-out userのProtected Component/API実行を両方防ぐ。

T-AUTH-13a / 13bもこの2ケースへ分離された。

---

# 5. F-08 — RESOLVED

Auth Provider Availability classificationが`verifyToken()`だけではなく`users.getUser()`へも統一された。

```text
Invalid / expired / malformed / wrong-party / non-session token
→ AUTHENTICATION_INVALID
→ HTTP 401

JWKS / network / timeout / Clerk Backend temporary failure
→ AUTHENTICATION_UNAVAILABLE
→ HTTP 503
```

Email claim fallbackで`users.getUser()`が一時障害になった場合も、T-AUTH-15で503へ分類する。

---

# 6. Authentication Boundary — APPROVED

```text
@clerk/backend
↓
ClerkAuthAdapter
↓
AuthAdapter
↓
AuthenticatedPrincipal
↓
Fastify Authentication Glue
↓
Account
```

Clerk SDK型は`packages/domain`、`packages/db`、`packages/analyzer`、`packages/ai`、`packages/queue`、`apps/worker`へ漏らさない。

---

# 7. Ownership Boundary — APPROVED

```text
Account
↓
Project.ownerAccountId
↓
Analysis.projectId
↓
ObservationSet / AIExplanation / UploadedAccessLog
```

Ownership FilterはPrisma `where`自体へ含める。

Other Accountは：

```text
404 PROJECT_NOT_FOUND
404 ANALYSIS_NOT_FOUND
```

へ統一する。

---

# 8. Account Provisioning — APPROVED

`authSubject @unique` + Prisma `upsert`でConcurrent First Requestsを安全に処理する。

T-AUTH-10でparallel requestsが1 Account rowへ収束し、全Requestが成功することを確認する。

---

# 9. Email Verification — APPROVED

```text
Authenticated
+
Verified Email
↓
Product Resource API
```

Global hookで統一し、Source of Truthは`req.principal.emailVerified`とする。

Persisted Account snapshotはAuthorization decisionへ使用しない。

---

# 10. Worker / Analyzer / AI Isolation — APPROVED

Sprint 7でもWorker / Analyzer / AIProviderはClerk / Account / JWT / Sessionを知らない。

Queue payloadは`analysisId`のみ。

Sprint 1〜6 Contractを変更しない。

---

# 11. Frontend Authentication — APPROVED

```text
@clerk/vue
↓
App.vue useAuth()
↓
Auth Gate
↓
setTokenGetter()
↓
apiFetch Authorization
```

Router GuardはUXであり、Security BoundaryはBackend。

Current Clerk Vueの`getToken`は`Ref<(options?) => Promise<string | null>>`なので`await getToken.value()`を使用する。

---

# 12. Auth Provider Outage UX — APPROVED

```text
401 AUTHENTICATION_REQUIRED / INVALID
→ session re-check
→ Sign In if necessary

503 AUTHENTICATION_UNAVAILABLE
→ temporary error
→ retry
→ sign-outしない
```

---

# 13. Test Matrix — APPROVED

Final PlanではT-AUTH-01〜15が定義された。

重要Regression：

```text
T-AUTH-09  Cross-account IDOR
T-AUTH-10  Concurrent Lazy Provisioning
T-AUTH-11  Provider unavailable → 503
T-AUTH-12a authorizedParties mismatch
T-AUTH-12b sid absent
T-AUTH-13a signed-in initial protected navigation
T-AUTH-13b signed-out initial protected navigation
T-AUTH-14  CORS OPTIONS preflight
T-AUTH-15  getUser fallback unavailable → 503
```

Coverageとして十分。

---

# 14. Minor m-04 — NON-BLOCKING

Current：

```prisma
authSubject String @unique
```

Sprint 7はClerk onlyなので問題なし。

将来複数Auth ProviderをProduct Accountへ結び付ける場合は：

```prisma
@@unique([authProvider, authSubject])
```

への変更を検討する。

---

# 15. Implementation-time Verification

以下はPlan defectではなく、installed packageに合わせて実装時に確認する事項：

```text
@clerk/backend exact error classes/status
verified JWT exact TypeScript claim shape
users.getUser() exact error shape
@clerk/vue installed type signatures
```

ContractはすでにPlanで固定されているため、Adapter内部をSDK型へ合わせればよい。

---

# 16. Definition of Implementation Review

Sprint 7実装後のReviewでは最低限：

```text
1. Current GitHub HEAD
2. Prisma Account / Project ownership migration
3. packages/auth boundary
4. authorizedParties + sid validation
5. 401 / 503 classification
6. getUser fallback classification
7. atomic account provisioning
8. SQL-level ownership filtering
9. all Product APIs authentication
10. all Product APIs verified-email enforcement
11. Cross-account IDOR tests
12. Frontend initial-navigation tests
13. Queue payload token isolation
14. Worker / Analyzer / AI unchanged
15. Product E2E
16. GitHub Actions CI
17. Real Clerk Smoke Test
```

を確認する。

---

# 17. Real Clerk Smoke Gate

Automated CIはFake Auth Adapterを使用する。

Sprint 7 Final Close前のみReal Clerkで：

```text
Sign Up
↓
Email Verification
↓
Sign In
↓
Project Create
↓
Analysis Create
↓
Upload
↓
Analyzer
↓
AI Explanation
↓
Result
↓
Sign Out
```

を確認。

さらにAccount B：

```text
Account A Project URL
↓
Account B
↓
404 / access不可
```

を確認する。

---

# 18. Final Decision

```text
SPRINT 7 IMPLEMENTATION PLAN

PASS

Critical  0
Major     0
Minor     1 non-blocking

IMPLEMENTATION GO
```

このPlanをそのままClaude Codeへ渡して実装開始してよい。

次回はPlan ReviewではなくSprint 7 Implementation Reviewへ進む。

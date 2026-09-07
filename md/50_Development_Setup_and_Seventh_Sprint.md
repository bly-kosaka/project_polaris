# 50_Development_Setup_and_Seventh_Sprint.md

# Project Polaris — Development Setup and Sprint 7
## Authentication / Ownership（認証・所有権境界）

---

## 1. Sprint 7 の目的

Sprint 6まででPolarisは、

```text
Access Log
↓
Analyzer
↓
ObservationSet
↓
AI Explanation
↓
Result UI
```

という主要Product Flowを成立させた。

Sprint 7では、このProduct Flowを**実際のユーザーアカウントへ安全に結び付ける**。

Sprint 7の中心テーマは単なるLogin画面追加ではない。

> **「誰が、どのProject / Analysisへアクセスできるか」をBackendで保証すること**

を目的とする。

Sprint 7はMVP Backlogの：

```text
M6 Authentication / Ownership
E15 Authentication
```

を実装するSprintとする。

---

# 2. Sprint 7 Completion Definition

Sprint 7完了時：

```text
Sign Up / Sign In
↓
Authenticated Account
↓
Project Create
↓
Project Ownership
↓
Analysis Create / Upload
↓
ObservationSet
↓
AI Explanation
↓
Result
```

までが、認証済みユーザーの所有権境界内で成立すること。

別Accountから：

```text
Project
Analysis
ObservationSet
AIExplanation
Known Information
Raw Log Lifecycle
```

へアクセスできてはならない。

---

# 3. Authentication Provider

MVPでは：

```text
Clerk
```

を採用する。

理由：

- Sign Up / Sign Inを自前実装しない
- PasswordをPolaris DBへ保存しない
- Email VerificationをProviderへ委譲できる
- Vue Frontendとの統合が容易
- BackendでJWT / Session Tokenを検証できる
- 将来Team / Organizationへ拡張可能

Sprint 7ではClerk固有処理をAuthentication Boundaryへ閉じる。

```text
Frontend
↓
Clerk SDK
↓
Token

Backend
↓
Auth Adapter
↓
AuthenticatedPrincipal
↓
Application / Repository
```

Domain / RepositoryへClerk SDK型を漏らさない。

---

# 4. Account Model

Polaris DBにはProviderのCredentialではなく、Product Accountを保持する。

推奨：

```prisma
model Account {
  id             String   @id @default(cuid())
  authProvider   String
  authSubject    String   @unique
  email          String?
  emailVerified  Boolean  @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  projects Project[]
}
```

MVPでは：

```text
authProvider = clerk
authSubject = Clerk userId / subject
```

Password / OAuth Token / Session Tokenは保存しない。

---

# 5. Project Ownership

現在のProjectにはOwnerが存在しない。

Sprint 7で：

```prisma
model Project {
  ...
  ownerAccountId String
  ownerAccount   Account @relation(...)
}
```

を追加する。

MVPでは：

```text
1 Project = 1 Owner Account
```

とする。

まだ以下は実装しない：

```text
Organization
Team
Project Member
Role
Invitation
RBAC
```

将来Team化するときにOwnership Modelを拡張する。

---

# 6. Ownership Chain

認可の基本Chain：

```text
Account
↓ owns
Project
↓ owns
Analysis
↓ owns
ObservationSet / AIExplanation / UploadedAccessLog
```

ObservationSet等へAccount IDを重複保存しない。

Ownershipは：

```text
Analysis.projectId
↓
Project.ownerAccountId
```

から解決する。

---

# 7. Backend Authorization Principle

Frontendでボタンを隠すことはAuthorizationではない。

すべてのProtected APIでBackendがOwnershipを検証する。

```text
Request
↓
Authentication
↓
AuthenticatedPrincipal
↓
Resource Ownership Resolution
↓
Authorized
↓
Route Handler
```

禁止：

```text
Frontendが送ったaccountIdを信用
Query StringのownerIdを信用
Request BodyのuserIdを信用
Client-side Route Guardだけで保護
```

---

# 8. Authenticated Principal

Backend内部ではProvider-neutralな型を使用する。

```typescript
export interface AuthenticatedPrincipal {
  provider: 'clerk';
  subject: string;
  email?: string;
  emailVerified: boolean;
}
```

Clerk SDK型を：

```text
packages/domain
packages/db
Analyzer
AI
Queue
Worker
```

へ流さない。

---

# 9. Account Resolution

Authenticated Requestごとに：

```text
Verified Clerk Identity
↓
authSubject
↓
Account lookup
↓
Account
```

を行う。

初回Sign In後のAccount生成方法は：

```text
Lazy Provisioning
```

を推奨する。

```text
First authenticated API request
↓
Account not found
↓
Create Account
↓
continue
```

Webhook同期はSprint 7 MVPでは不要。

理由：

- AuthenticationとProduct Account同期を単純化
- Webhook failureによるLogin不能状態を避ける
- MVPでAccount profile同期を必要としない

将来Billing / Teamで必要ならWebhookを追加する。

---

# 10. Email Verification

PolarisでAnalysisを実行するには：

```text
Email Verified = true
```

を必須とする。

未Verifyユーザー：

```text
Sign In可能
Account画面表示可能
Verification案内表示可能
```

ただし：

```text
Project Create
Analysis Create
Upload
AI Retry
```

等のProduct Mutationは拒否する。

Read-only範囲については実装時に統一Policyを決める。

推奨MVP：

```text
Unverified
→ Product Resource APIは403 EMAIL_VERIFICATION_REQUIRED
```

とし、例外を増やさない。

---

# 11. API Authentication

Protected APIは：

```text
Authorization: Bearer <token>
```

を検証する。

Authentication失敗：

```text
401 AUTHENTICATION_REQUIRED
401 AUTHENTICATION_INVALID
```

Email Verification：

```text
403 EMAIL_VERIFICATION_REQUIRED
```

Ownership違反：

```text
404 RESOURCE_NOT_FOUND
```

を推奨する。

別AccountのResourceが存在すること自体を漏らさないため：

```text
403 FORBIDDEN
```

より404を基本とする。

---

# 12. Protected API Scope

Sprint 7完了時、Product APIは原則Protected。

対象：

```text
POST /projects
GET  /projects
GET  /projects/:projectId

POST /projects/:projectId/analyses
GET  /projects/:projectId/analyses

POST /analyses/:analysisId/upload
GET  /analyses/:analysisId
GET  /analyses/:analysisId/observations

GET  /analyses/:analysisId/explanation
POST /analyses/:analysisId/explanation/retry
```

Known Information APIをSprint 7で実装する場合も同じOwnership Boundaryを使用する。

Health Check等のInfrastructure EndpointはPublicでよい。

---

# 13. Repository Ownership API

Routeごとに：

```text
findById()
↓
project.ownerAccountId check
```

を手書きで繰り返さない。

Repository / Application BoundaryへOwnership-aware queryを追加する。

例：

```typescript
findProjectByIdForOwner(projectId, accountId)
listProjectsForOwner(accountId)

findAnalysisByIdForOwner(analysisId, accountId)
listAnalysesForProjectOwner(projectId, accountId)
```

重要：

> **Ownership FilterをSQL Query自体へ含める。**

「取得してから比較」より、誤実装時のData Leak Riskを下げる。

---

# 14. Create Ownership

Project Create：

```text
Authenticated Account
↓
POST /projects
↓
ownerAccountId = authenticated account.id
```

Clientは`ownerAccountId`を指定しない。

Analysis Create：

```text
Authenticated Account
↓
Project ownership check
↓
Analysis create
```

Clientが知っているProject IDだけでは作成できない。

---

# 15. Worker Boundary

WorkerはBrowser User Sessionを持たない。

したがってWorker JobへClerk Tokenを入れない。

```text
API
↓ Authentication / Authorization
↓
Business Resource created
↓
Queue Job
↓
Worker
```

Workerは：

```text
analysisId
```

等のInternal Identifierを使い、既に許可されたProduct Lifecycleを処理する。

Queue payloadへ：

```text
JWT
Session Token
Clerk Token
```

を保存しない。

---

# 16. Analyzer / AI Boundary

Authentication追加によって：

```text
Analyzer
AIProvider
PromptBuilder
Grounding Validator
ObservationSet
```

のInterfaceを変更しない。

特に：

```text
Account
Plan
Clerk User
Billing
```

をAnalyzerへ渡してはならない。

Sprint 7でも：

> Analyzer CoreはAuthenticationを知らない。

同様にAIProviderもAccountを知らない。

---

# 17. Frontend Authentication

追加画面：

```text
S01 Sign Up
S02 Login
S50 Account Settings（minimum）
```

既存Product Route：

```text
/projects
/projects/:id
/analyses/...
```

はAuthentication Guard対象。

Frontend flow：

```text
App Start
↓
Clerk initialization
↓
Session Loading
├─ unauthenticated → Login
└─ authenticated
      ↓
   Product UI
```

---

# 18. API Client

既存API ClientへToken Injectionを追加。

```typescript
async function apiFetch(...) {
  const token = await getToken();

  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...
    }
  });
}
```

各ComponentからTokenを手動指定しない。

Token取得処理は1箇所へ集約する。

---

# 19. Frontend Unauthorized Handling

```text
401
↓
Session再確認
↓
Sign Inへ

403 EMAIL_VERIFICATION_REQUIRED
↓
Verification UI

404
↓
Not Found
```

Ownership違反と本当の不存在をUI上で区別しない。

---

# 20. Current Data Migration

現在のDBにはAccountなしで作成されたProjectが存在し得る。

Migrationで：

```text
ownerAccountId NOT NULL
```

をいきなり追加すると既存Rowで失敗する。

Development DBを破棄可能なら：

```text
Reset DB
```

が最も単純。

既存Dataを維持する必要がある場合：

```text
1. ownerAccountId nullable追加
2. Development Ownerへbackfill
3. NOT NULL化
```

とする。

Sprint 7実装Plan作成時に現在のDevelopment Data運用を確認して選択する。

---

# 21. Security Requirements

必須：

- JWT/Session Tokenをログへ出さない
- Authorization headerをログへ出さない
- Clerk Secret KeyをFrontendへ出さない
- FrontendにはPublishable Keyのみ
- Error responseへToken / subjectを含めない
- Account existence enumerationを避ける
- Ownership failureは404
- Upload APIもOwnership検証
- AI RetryもOwnership検証
- ObservationSet / Explanation取得もOwnership検証

---

# 22. CORS

Sprint 5で導入したCORSをAuthentication導入後も見直す。

MVPでは：

```text
Allowed Frontend Origin
```

をEnvironment Variableで明示する。

Wildcard：

```text
Access-Control-Allow-Origin: *
```

をProductionで使用しない。

Bearer Token方式なのでCookie Credential前提にはしない。

---

# 23. Environment Variables

Backend：

```text
CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY      # 必要なSDK構成の場合
CLERK_JWT_ISSUER           # Adapter方式に応じて
CORS_ALLOWED_ORIGIN
```

Frontend：

```text
VITE_CLERK_PUBLISHABLE_KEY
VITE_API_BASE_URL
```

実際に必要なClerk環境変数名は、実装時に採用するClerk SDKの最新版公式Documentationに合わせる。

不要なSecretをFrontendへコピーしない。

---

# 24. Package Boundary

推奨：

```text
packages/auth/
  src/
    types.ts
    auth-provider.ts
    clerk/
      clerk-auth-adapter.ts
    errors.ts
    index.ts
```

ただしSprint 7時点でClerk以外のAuth Providerを実装する予定がなく、抽象化が薄い場合は：

```text
apps/api/src/auth/
```

でもよい。

重要なのはDirectory数ではなく：

```text
Clerk SDK type
↓
Authentication Boundary
↓
Provider-neutral Principal
```

の境界。

過剰なAuth Frameworkを作らない。

---

# 25. Prisma Changes

最低限：

```text
Account
Project.ownerAccountId
Project.ownerAccount relation
```

追加。

推奨Index：

```prisma
@@index([ownerAccountId])
```

Account：

```text
authSubject unique
```

必須。

EmailをIdentity Keyにしない。

Email変更・複数Provider等を考慮し：

```text
authSubject
```

を外部Identityの主キーとする。

---

# 26. Domain Types

追加候補：

```typescript
type AccountId = string;

interface Account {
  id: string;
  authProvider: 'clerk';
  authSubject: string;
  email?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

既存Project Domainへ：

```typescript
ownerAccountId: string
```

を追加。

Analyzer DomainへAccount型を追加しない。

---

# 27. Error Contract

既存：

```json
{
  "error": {
    "code": "...",
    "message": "..."
  }
}
```

を維持。

追加候補：

```text
AUTHENTICATION_REQUIRED
AUTHENTICATION_INVALID
EMAIL_VERIFICATION_REQUIRED
PROJECT_NOT_FOUND
ANALYSIS_NOT_FOUND
```

Ownership違反専用：

```text
PROJECT_FORBIDDEN
```

等は作らない。

Resource enumeration防止のためNot Foundへ統一。

---

# 28. Test Strategy

実Clerk Networkへ依存するテストをCIに入れない。

Auth Adapter Interfaceを用意し：

```text
Production
→ ClerkAuthAdapter

Tests
→ FakeAuthAdapter
```

を使用する。

Fake Authでは：

```text
Account A
Account B
Unverified Account
Unauthenticated
```

を明示的に作る。

---

# 29. Mandatory Authorization Tests

最低限：

### T-AUTH-01 Unauthenticated

```text
GET /projects
without token
→ 401
```

### T-AUTH-02 Own Project

```text
Account A
↓
Project A
↓
GET
→ 200
```

### T-AUTH-03 Other Account Project

```text
Account B
↓
Project A
↓
GET
→ 404
```

### T-AUTH-04 Analysis Ownership

```text
Account B
↓
Analysis under Project A
↓
GET / upload / observations / explanation / retry
→ 404
```

### T-AUTH-05 Project List Isolation

```text
Account A list
→ only A projects

Account B list
→ only B projects
```

### T-AUTH-06 Create Ownership

```text
Account A
↓
POST /projects
↓
ownerAccountId = Account A
```

Client cannot override owner.

### T-AUTH-07 Email Unverified

```text
Unverified Account
↓
Product API
→ 403 EMAIL_VERIFICATION_REQUIRED
```

### T-AUTH-08 Queue Token Isolation

Queue Job payloadに：

```text
JWT
Authorization
Session
```

が含まれない。

### T-AUTH-09 Cross-account IDOR

Account BがAccount Aの実在IDを知っていても：

```text
Project
Analysis
ObservationSet
Explanation
Upload
Retry
```

へアクセス不能。

---

# 30. Product E2E

Product E2EではReal Clerkを使わない。

```text
Fake Auth Adapter
↓
Account A login context
↓
Project Create
↓
Analysis
↓
Analyzer
↓
AI
↓
Result
```

を維持。

さらに：

```text
Account B context
↓
Account A Project
↓
404
```

を追加する。

Real Clerkの手動Smoke Testは別枠。

---

# 31. Manual Clerk Smoke Test

Sprint 7 Final Review前に：

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
Result
↓
Sign Out
↓
Protected Pageへ戻れない
```

を1回実施する。

可能なら別Accountを作り：

```text
Account B
↓
Account AのProject URL
↓
Not Found / access不可
```

も確認する。

---

# 32. Sprint 7 Implementation Order

推奨：

```text
Phase 1
Account / Ownership Domain + Prisma

Phase 2
Auth Adapter + Fake Auth

Phase 3
API Authentication Middleware

Phase 4
Ownership-aware Repository Queries

Phase 5
全Product RouteへAuthorization適用

Phase 6
Frontend Clerk Integration

Phase 7
Route Guard / API Token Injection

Phase 8
Verification / Error UI

Phase 9
Authorization Integration Tests

Phase 10
Product E2E

Phase 11
Real Clerk Smoke Test
```

---

# 33. Scope

Sprint 7に含む：

```text
Clerk Sign Up
Clerk Sign In
Sign Out
Email Verification
Account Persistence
Project Ownership
Analysis Ownership
Backend Authentication
Backend Authorization
Frontend Route Guard
API Token Injection
Cross-account Isolation
Auth Tests
Product E2E
Manual Clerk Smoke
```

---

# 34. Explicitly Out of Scope

Sprint 7では実装しない：

```text
Stripe
Free / Pro Entitlement
Usage Limit
Team
Organization
Invitation
Role / RBAC
Admin Console
Social Graph
Multiple Auth Providers
API Key Authentication
Service Account
SSO / SAML
MFA独自実装
Account Deletion Workflow
Data Export
```

これらは後続Sprint。

---

# 35. Non-negotiable Invariants

```text
1. Frontend authorizationを信用しない
2. Protected ResourceはBackendでOwnership検証
3. Other Account Resourceは404
4. Account IDをClientに決めさせない
5. Password / Session TokenをPolaris DBへ保存しない
6. QueueへUser Tokenを入れない
7. WorkerはClerkを知らない
8. AnalyzerはAccountを知らない
9. AIProviderはAccountを知らない
10. Authentication追加でSprint 1〜6のAnalyzer/AI Contractを変更しない
```

---

# 36. Sprint 7 Definition of Done

以下すべてを満たすこと：

```text
[ ] Account model exists
[ ] Project ownership persisted
[ ] Clerk identity maps to Account
[ ] Email verification enforced
[ ] Product APIs require authentication
[ ] Ownership enforced server-side
[ ] Cross-account resource access returns 404
[ ] Project list isolated by owner
[ ] Analysis child resources inherit Project ownership
[ ] Queue payload contains no auth token
[ ] Worker remains auth-provider independent
[ ] Frontend Sign Up / Login / Sign Out works
[ ] Protected route guard works
[ ] API token injection centralized
[ ] Unverified UI works
[ ] Auth integration tests pass
[ ] Product E2E passes with Fake Auth
[ ] Existing Analyzer tests pass
[ ] Existing AI tests pass
[ ] GitHub Actions CI passes
[ ] Real Clerk smoke test passes
```

---

# 37. Sprint 7 Completion Gate

Sprint 7をCloseできる条件：

```text
Authentication
+
Ownership
+
Cross-account Isolation
+
Existing Analyzer / AI regression safety
+
CI
+
Real Clerk Smoke
```

すべてPASS。

このSprint完了後：

```text
Authenticated Polaris MVP Core
↓
Sprint 8
Entitlement / Billing
```

へ進む。

---

# 38. Claude Code Implementation Planへの指示

この文書をClaude Codeへ渡した後、いきなり実装させず：

> `50_Development_Setup_and_Seventh_Sprint.md` と現在のRepositoryを確認し、Sprint 7の詳細Implementation Planを作成してください。まだコード変更は行わないでください。

とする。

Planには最低限：

```text
変更ファイル一覧
Prisma Migration
Auth Adapter構造
Account Provisioning
Ownership-aware Repository API
RouteごとのAuthentication / Authorization
Frontend Clerk Integration
Email Verification
Error Contract
Fake Auth Test Strategy
Cross-account IDOR Test Matrix
Product E2E
CI
Real Clerk Smoke Test
```

を含める。

Implementation Planをレビューしてから実装へ進む。

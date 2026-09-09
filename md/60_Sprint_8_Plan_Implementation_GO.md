# 60_Sprint_8_Plan_Implementation_GO.md

# Project Polaris
# Sprint 8 Implementation Plan — Final Approval

対象：

```text
tidy-pondering-stonebraker(10).md
```

基準：

```text
57_Development_Setup_and_Eighth_Sprint.md
58_Sprint_8_Plan_Review.md
59_Sprint_8_Plan_Final_Review.md
Sprint 7 Final HEAD: 88bb6954f58623b947c6713ab3364f4b15e4182b
```

---

# 1. Final Verdict

```text
PASS

Critical  0
Major     0
Minor     0 blocking

SPRINT 8 IMPLEMENTATION GO
```

今回のRevisionで、前回までに残っていた：

```text
F-09 Concurrent BillingCustomer Provisioning
F-10 Canonical Subscription Identity Contract
```

は解消された。

Architectureの再レビューは不要。

このPlanをSprint 8実装のAuthoritative Baselineとして扱う。

---

# 2. F-09 — RESOLVED

`ensureBillingCustomer()`は：

```text
findByAccountId
↓
missing
↓
Stripe createCustomer
↓
DB create
├─ success
│   → return
└─ CONFLICT
    ↓
   findByAccountId
    ↓
   winner row reuse
```

となった。

これにより：

```text
same Account
↓
parallel Checkout
↓
Stripe Customer idempotency
+
DB unique-conflict recovery
↓
one BillingCustomer
↓
all requests success
```

が成立する。

T-BILL-18も追加されている。

承認。

---

# 3. F-10 — RESOLVED

Gatewayのcanonical Subscription return typeが：

```typescript
ProviderSubscriptionSnapshot
```

としてLocal Entitlement Snapshotから分離された。

必須：

```text
providerSubscriptionId
stripeCustomerId
status
cancelAtPeriodEnd
```

を含む。

Webhook Account Mapping：

```text
canonical getSubscription()
↓
ProviderSubscriptionSnapshot.stripeCustomerId
↓
BillingCustomer
↓
Account
```

となり、

```text
webhook event.data.customer
```

をPrimary Mappingとして使用しない。

T-WEBHOOK-05では：

```text
Webhook payload customer = A
Canonical Subscription customer = B
↓
B Accountのみ更新
```

を確認する。

承認。

---

# 4. Previous Review Findings

すべて解消済み。

```text
M-01 FakeBillingGateway Source of Truth        RESOLVED
M-02 Signature/Event Interpretation            RESOLVED
m-01 Stripe Gateway DB orchestration           RESOLVED
m-02 speculative Usage count API               RESOLVED
F-09 Concurrent BillingCustomer Provisioning   RESOLVED
F-10 Canonical Subscription identity           RESOLVED
```

---

# 5. Architecture — APPROVED

```text
Stripe
↓
Webhook
↓
Local Subscription Snapshot
↓
Entitlement Resolver
↓
Feature Gate
```

Product-side Source of Truth：

```text
Local Subscription Snapshot
```

Stripe Gateway internal stateやCheckout callbackは
Entitlement Source of Truthではない。

---

# 6. Analyzer Boundary — APPROVED

最重要不変条件：

```text
Free / Pro
↓
same Analyzer behavior
↓
same ObservationSet
```

以下はPlan差分にしない：

```text
Parser
Aggregation
Candidate Selection
Known Information
Redaction
ObservationSet Schema
Fatal judgment
```

Analyzer / Workerへ：

```text
Account
Plan
Stripe
Subscription
```

を渡さない。

---

# 7. Entitlement — APPROVED

Pure Resolver：

```text
Subscription Snapshot
↓
resolveEntitlement()
↓
Effective Entitlement
```

Mapping：

```text
active
trialing
past_due
→ Pro

everything else
→ Free
```

Unknown Stripe Status：

```text
Fail Closed
→ Free
```

---

# 8. Ownership before Entitlement — APPROVED

AI Retry：

```text
Authentication
↓
Ownership
↓
Entitlement
↓
Business State
↓
Retry
```

Other Account：

```text
404 ANALYSIS_NOT_FOUND
```

Free Owner：

```text
403 ENTITLEMENT_REQUIRED
```

Resource existence leakを作らない。

---

# 9. Billing Customer Provisioning — APPROVED

```text
Authenticated Account
↓
BillingCustomer lookup
↓
Stripe Customer ensure
↓
DB persistence
```

Stripe：

```text
Account-based Idempotency Key
```

DB：

```text
accountId @unique
stripeCustomerId @unique
```

Race loser：

```text
DbError(CONFLICT)
↓
findByAccountId
↓
existing row reuse
```

---

# 10. Webhook Boundary — APPROVED

Public Endpoint：

```text
POST /webhooks/stripe
```

Protection：

```text
Stripe Signature Verification
```

not Clerk Authentication.

Flow：

```text
Raw Body
↓
Signature Verify
↓
Generic Event
↓
Supported Event Filter
↓
providerSubscriptionId
↓
Canonical Stripe fetch
↓
ProviderSubscriptionSnapshot
↓
BillingCustomer mapping
↓
DB Subscription Snapshot
```

Valid unsupported events：

```text
200 ignore
```

Checkout completion：

```text
never grants Pro directly
```

---

# 11. Usage Accounting — APPROVED

```text
ObservationSet Persist Success
↓
UsageEvent
```

同一Transaction。

```text
analysisId @unique
```

によりWorker retryでも二重Countしない。

Fatal Analyzer：

```text
UsageEvent 0
```

Sprint 8ではQuota Enforcementなし。

---

# 12. Frontend Billing — APPROVED

Billing Screen：

```text
Free
→ Upgrade

Pro
→ Manage Billing
```

Checkout return：

```text
?checkout=success
↓
GET /billing
```

query paramだけでPro表示しない。

AI Retryの403：

```text
ENTITLEMENT_REQUIRED
↓
Pro案内
```

generic errorだけにしない。

---

# 13. Test Matrix — APPROVED

重要Regression：

```text
T-BILL-16
Gateway active / DB Subscriptionなし
→ Free

T-BILL-17
DB Subscription active
→ Pro

T-BILL-18
parallel Checkout
→ one BillingCustomer
→ all success

T-WEBHOOK-01
unsupported valid event
→ 200

T-WEBHOOK-02
checkout.session.completed
→ no Pro grant

T-WEBHOOK-03
invalid signature
→ 400

T-WEBHOOK-04
supported subscription event
→ canonical fetch
→ DB sync

T-WEBHOOK-05
canonical stripeCustomerId wins
over webhook payload customer
```

Coverageは十分。

---

# 14. Implementation-time Verification

以下はPlan defectではない。

Implementation時にinstalled Stripe SDKで確認する：

```text
Stripe API version behavior
webhook test-signing helper
customers.create idempotency option
Stripe CLI forwarding command
```

Architecture判断は再オープンしない。

---

# 15. Sprint 8 Implementation Review Gate

実装後のReviewでは最低限：

```text
1. Current GitHub HEAD
2. Prisma Billing/Usage Migration
3. Pure Entitlement Resolver
4. Fail-Closed status mapping
5. Stripe SDK isolation
6. BillingCustomer race recovery
7. Checkout callback never grants Pro
8. Public Stripe Webhook scope
9. Raw-body signature verification
10. Unsupported event 200
11. Canonical Subscription fetch
12. canonical stripeCustomerId Account mapping
13. Webhook idempotency
14. Subscription local snapshot
15. Ownership before Entitlement
16. AI Retry Pro Gate
17. UsageEvent transaction
18. Analyzer/Worker billing isolation
19. Frontend Billing Page
20. ENTITLEMENT_REQUIRED UX
21. Product E2E
22. Full Regression
23. GitHub Actions CI
24. Stripe Test Mode Smoke
```

を確認する。

---

# 16. Final Decision

```text
SPRINT 8 IMPLEMENTATION PLAN

PASS

Critical  0
Major     0
Minor     0 blocking

IMPLEMENTATION GO
```

このPlanで実装開始してよい。

次回はPlan Reviewではなく：

```text
Sprint 8 Implementation Review
```

へ進む。

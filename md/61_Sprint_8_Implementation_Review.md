# 61_Sprint_8_Implementation_Review.md

# Project Polaris — Sprint 8 Implementation Review

対象HEAD:

```text
fc6a06fbc418348747bed1958ca2e52f96078d96
```

基準:

```text
57_Development_Setup_and_Eighth_Sprint.md
58_Sprint_8_Plan_Review.md
59_Sprint_8_Plan_Final_Review.md
60_Sprint_8_Plan_Implementation_GO.md
```

## 1. Verdict

```text
CODE REVIEW PASS

Critical  0
Major     0
Minor     0 blocking

External Verification Gate  1
```

実装コード、Automated Test、Product E2E、Current HEAD CIについてはSprint 8の設計・Implementation Planへの適合を確認した。

Blocking Code Defectは見つからなかった。

残るのはDefinition of Doneに含まれる：

```text
Stripe Test Mode Smoke PASS
```

の実環境確認のみ。

したがって現時点では：

```text
SPRINT 8 IMPLEMENTATION PASS
SPRINT 8 COMPLETE HOLD
```

とする。

---

## 2. Entitlement Resolver — PASS

`packages/domain/src/entitlement.ts`はPure Functionであり、Stripe API / Prisma Queryを含まない。

```text
active / trialing / past_due
→ Pro

everything else
→ Free
```

Unknown StatusもFail ClosedでFree。

未実装Feature：

```text
aiChat
reportExport
csvExport
analysisComparison
```

はfalseのまま。

---

## 3. Analyzer Boundary — PASS

Free / ProによるAnalyzer Core変更なし。

Usage Accountingは`persistAnalyzerSuccess()`のPersistence Transactionへ追加されているだけで、WorkerへAccount/Plan/Stripe情報を渡していない。

```text
same input
→ same Analyzer
→ same ObservationSet
```

を維持。

---

## 4. Prisma Billing / Usage — PASS

追加Model：

```text
BillingCustomer
Subscription
BillingWebhookEvent
UsageEvent
```

AccountへStripe固有Columnを直接追加していない。

主要Unique Constraint：

```text
BillingCustomer.accountId
BillingCustomer.stripeCustomerId
Subscription.accountId
Subscription.providerSubscriptionId
BillingWebhookEvent.providerEventId
UsageEvent.analysisId
```

Migration：

```text
20260909061419_add_billing_and_usage
```

を確認。

---

## 5. Usage Accounting — PASS

`persistAnalyzerSuccess()`の同一Transactionで：

```text
ObservationSetRecord
Analysis status
UsageEvent
```

をPersist。

Owner Accountは：

```text
Analysis
↓
Project
↓
ownerAccountId
```

から解決。

Fatal Analyzer側ではUsageEventを作らない。

---

## 6. BillingCustomer Provisioning — PASS

`ensureBillingCustomer()`はConcurrent Checkout Race対策済み。

```text
find
↓
missing
↓
Stripe createCustomer
↓
DB create
├─ success
└─ CONFLICT
    ↓
   findByAccountId
    ↓
   winner reuse
```

Stripe Customer作成も：

```text
polaris-customer:${accountId}
```

のIdempotency Keyを使用。

T-BILL-18：

```text
parallel Checkout
→ all 200
→ BillingCustomer exactly 1
```

を確認。

---

## 7. Stripe Gateway Boundary — PASS

Productionで`stripe` packageを直接扱うのは`apps/api/src/billing/stripe-gateway.ts`。

GatewayはStripe API Callのみで、Prisma依存なし。

---

## 8. Checkout / Portal — PASS

Checkout：

```text
mode=subscription
customer=BillingCustomer
price=STRIPE_PRO_PRICE_ID
client_reference_id=accountId
subscription metadata=accountId
```

Checkout callbackだけではProにならない。

Customer PortalもStripe-hosted UIへ委譲。

---

## 9. Fastify Public / Protected Scope — PASS

```text
Root
├─ Public
│  └─ POST /webhooks/stripe
└─ Protected
   ├─ Authentication
   ├─ Email Verification
   ├─ Project / Analysis
   ├─ AI Explanation
   └─ Billing
```

WebhookだけClerk Authentication外。

Path例外方式は採用していない。

---

## 10. Raw-body Signature Verification — PASS

Webhook Scopeだけ`application/json`をBufferとして取得。

Stripe署名はRaw Bodyに対して検証。

Dedicated Unit TestではStripe SDK本体の署名生成Helperを使い、valid / wrong secret / tampered payload / malformed signatureを確認。

---

## 11. Webhook Event Filtering — PASS

処理対象：

```text
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
```

Unsupported valid event：

```text
invoice.paid
checkout.session.completed
```

は200でignoreし、Subscriptionを更新しない。

---

## 12. Canonical Subscription / Account Mapping — PASS

Supported EventではWebhook PayloadからSubscription IDだけを読み、その後Stripeへcanonical re-fetch。

戻り値は`ProviderSubscriptionSnapshot`で、`stripeCustomerId`が必須。

Account Mapping：

```text
canonical stripeCustomerId
↓
BillingCustomer
↓
Account
```

Webhook payload上のcustomer値を使用しない。

T-WEBHOOK-05ではpayload customerとcanonical customerを意図的に食い違わせ、canonical側Accountだけ更新されることを確認。

---

## 13. Webhook Idempotency — PASS

```text
BillingWebhookEvent.create
+
Subscription.upsert
```

を同一Transactionで実行。

`providerEventId @unique`のConflictはduplicate deliveryとして200。

---

## 14. Local Subscription Source of Truth — PASS

Product Entitlement判定はLocal DBのみ。

```text
PrismaSubscriptionRepository
↓
resolveEntitlement
```

T-BILL-16 / 17でGateway内部StateがEntitlementへ影響しないことを確認。

---

## 15. Ownership before Entitlement — PASS

AI Retry：

```text
requireOwnedAnalysis
↓
requireEntitlement
↓
Business State
```

Other Accountは404、Free Ownerは403。

Product E2EでもAccount BからAccount A Analysis Retryが404。

---

## 16. AI Retry Pro Gate — PASS

Sprint 8でGateしたのは`aiExplanationRetry`のみ。

Freeでも初回AI Explanation / Summary / Findings / Aggregationは維持。

---

## 17. Frontend Billing — PASS

BillingPageはCurrent Plan / Subscription Status / Period End / Cancel flag / Upgrade / Manage Billingを表示。

`?checkout=success`はBanner + GET /billing再取得のみで、Frontend local stateからPro化しない。

---

## 18. ENTITLEMENT_REQUIRED UX — PASS

AnalysisResultPageはAI Retryの403 `ENTITLEMENT_REQUIRED`を専用Noticeとして表示。

generic Errorだけに落とさず、Aggregationや既存Resultも隠さない。

---

## 19. Product E2E — PASS

Real：

```text
Fastify
PostgreSQL
Redis
MinIO
Analyzer Worker
AI Worker
Vue
```

Fake：

```text
Auth Provider
AI Provider
Billing Provider
```

Flow：

```text
Free
↓
Retry blocked
↓
Upgrade CTA
↓
Local Subscription active
↓
Pro
↓
Retry allowed
↓
AI Explanation success
```

を確認。

Ownership Regressionも確認済み。

---

## 20. Current HEAD CI — PASS

```text
Workflow    CI
Run         #20
Run ID      34323648947
HEAD        fc6a06fbc418348747bed1958ca2e52f96078d96
Status      completed
Conclusion  success
```

以下すべてPASS：

```text
Install dependencies
Backend Typecheck
Frontend Typecheck
Lint
Database migrations
Wait for MinIO
Backend Test
Frontend Test
Backend Build
Product Integration Test
Frontend Build
```

---

## 21. Non-blocking Hardening Note

Current Webhookはduplicate eventでもcanonical Stripe fetchを先に行い、その後DB Unique Conflictでduplicate判定する。

そのため既に処理済みEventでもStripe APIが一時障害ならその回は502となるが、State corruptionは起きず、Provider復旧後に200へ収束する。

Sprint 8 Blockingとはしない。

将来Webhook量が増えた場合はproviderEventId pre-checkによる不要なcanonical fetch回避を検討してよい。

---

## 22. External Verification Gate

Repository / CIから確認できる範囲では、Real Stripe Test Modeの実施結果は確認できない。

Definition of Done上、以下をManual Smokeで確認する必要がある。

```text
Free Account
↓
Stripe Checkout Test Mode
↓
Webhook
↓
Subscription active/trialing
↓
GET /billing → Pro
↓
AI Retry allowed
↓
Customer Portal
↓
cancel_at_period_end
↓
Webhook
↓
Billing表示更新
↓
期間終了まではPro維持
```

Stripe Dashboard上でWebhook delivery successも確認する。

---

## 23. Final Decision

```text
SPRINT 8 IMPLEMENTATION

CODE REVIEW PASS

Critical  0
Major     0
Minor     0 blocking

CI PASS
Product E2E PASS
```

ただし：

```text
STRIPE TEST MODE SMOKE
NOT VERIFIED
```

よって：

```text
SPRINT 8 COMPLETE HOLD
```

Stripe Test Mode SmokeがPASSしたら、追加コード変更が無ければ再度Architecture Reviewは不要。

その結果確認だけで：

```text
SPRINT 8 COMPLETE
SPRINT 9 GO
```

へ進める。

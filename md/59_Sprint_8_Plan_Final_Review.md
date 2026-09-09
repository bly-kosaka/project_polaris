# 59_Sprint_8_Plan_Final_Review.md

# Project Polaris
# Sprint 8 Implementation Plan — Final Re-Review

対象：

```text
tidy-pondering-stonebraker(9).md
```

基準：

```text
57_Development_Setup_and_Eighth_Sprint.md
58_Sprint_8_Plan_Review.md
Sprint 7 Final HEAD: 88bb6954f58623b947c6713ab3364f4b15e4182b
```

---

# 1. Verdict

```text
GO WITH FIXES

Critical  0
Major     2
Minor     0 blocking
```

前回指摘した：

```text
M-01 FakeBillingGateway vs DB Source of Truth
M-02 Signature Verification vs Event Interpretation
m-01 Stripe Gateway DB責務混在
m-02 speculative Usage count API
```

はすべて解消されている。

Architectureの方向も引き続き正しい。

ただし最終確認で、新たに2点のMajorを確認した。

いずれも局所修正であり、
Sprint 8 Architectureの再設計は不要。

---

# 2. Previous Review Findings — RESOLVED

## M-01 — RESOLVED

Test / Product E2EでPro化するSource of Truthが：

```text
FakeBillingGateway internal state
```

から：

```text
DB Subscription Snapshot
```

へ修正された。

```text
createTestSubscription()
↓
Prisma Subscription
↓
resolveEntitlement()
```

になっておりProductionと同じ境界を通る。

さらに：

```text
T-BILL-16
Gateway側だけactive
DB Subscriptionなし
→ Free

T-BILL-17
DB Subscription active
Gateway側stateなし
→ Pro
```

が追加されている。

承認。

---

## M-02 — RESOLVED

Webhook Contractが：

```text
verifyWebhookSignature()
→ { id, type, subscriptionId }
```

から：

```text
verifyWebhookSignature()
→ { id, type, data }
```

へ修正された。

その後：

```text
Signature Verify
↓
Event Type Filter
↓
supported subscription eventのみ解釈
```

となった。

```text
invoice.paid
checkout.session.completed
```

のようなvalid unsupported Eventを200でignoreできる。

T-WEBHOOK-01 / 02も追加されている。

承認。

---

## m-01 — RESOLVED

StripeGatewayからDB Persistence責務が外れた。

```text
ensureBillingCustomer()
↓
BillingCustomerRepository
↓
BillingGateway.createCustomer()
↓
BillingCustomerRepository.create()
```

となり、

```text
Stripe external operation
Local persistence
```

が分離された。

方向は正しい。

ただしこの新Helperに並行実行Raceが残っている。
後述F-09。

---

## m-02 — RESOLVED

Sprint 8のUsageEvent Repositoryは：

```text
create()
```

のみになった。

未決定のQuota期間を前提にした
`countByAccountId()`は削除された。

承認。

---

# 3. Major F-09
# ensureBillingCustomer()にConcurrent Checkout Raceが残る

修正版Plan：

```text
BillingCustomerRepository.findByAccountId(accountId)
↓
missing
↓
billingGateway.createCustomer(accountId, email)
↓
BillingCustomerRepository.create(...)
```

Stripe Customer作成にはAccount単位のIdempotency Keyを使う。

ここまでは良い。

しかし同じAccountからCheckout開始Requestが並行した場合：

```text
Request A
findByAccountId → null

Request B
findByAccountId → null
```

となる。

Stripe側は同一Idempotency Keyにより
同じCustomerへ収束できたとしても、その後：

```text
A → BillingCustomer.create → success

B → BillingCustomer.create
  → accountId @unique / stripeCustomerId @unique conflict
```

となる。

現PlanではこのDB Conflictを：

```text
existing BillingCustomerを再取得して成功扱い
```

へ変換するContractがない。

したがって正常なConcurrent Checkoutで
片方が500になる可能性がある。

Sprint 7 Lazy Provisioningで解消したRaceと同じ種類。

---

## Required Fix

`ensureBillingCustomer()`をIdempotentにする。

推奨：

```text
findByAccountId
↓
exists → return

missing
↓
Stripe createCustomer(idempotency key)
↓
DB create
├─ success
│   → return
│
└─ CONFLICT
    ↓
   findByAccountId
    ↓
   exists
    → return existing
```

重要：

```text
DB CONFLICT
→ generic 500
```

にしない。

Stripe Customer IDが既存DB rowと異なる異常ケースでは
無条件に飲み込まず、整合性Errorとして扱ってよい。

---

## Required Test

```text
T-BILL-18

same Account
↓
parallel POST /billing/checkout
↓
one BillingCustomer row
↓
both requests success
↓
no 500
```

可能なら：

```text
Stripe createCustomer call
```

もIdempotency Contractを満たすことをFake/Mockで確認する。

---

# 4. Major F-10
# Canonical Subscription SnapshotにstripeCustomerIdのContractがない

Webhook処理Planでは：

```text
supported subscription event
↓
providerSubscriptionId取得
↓
billingGateway.getSubscription(providerSubscriptionId)
↓
canonical Subscription取得
↓
stripeCustomerId → BillingCustomer
↓
accountId解決
↓
Subscription upsert
```

としている。

これは方向として正しい。

しかしGateway Interfaceは：

```typescript
getSubscription(
  providerSubscriptionId: string
): Promise<SubscriptionSnapshot>;
```

となっており、
Plan内の`SubscriptionSnapshot`に：

```text
stripeCustomerId
```

を必須で含めるContractが明記されていない。

一方、Webhook処理は：

```text
stripeCustomerId
```

がないとAccountを解決できない。

つまり：

```text
Gateway return type
```

と：

```text
Webhook persistence requirement
```

の接続がPlan上で欠けている。

実装時に：

```text
Webhook event.dataからcustomerを読む
```

へ流れると、

> canonical stateを使い、Webhook payloadをPrimary Mappingとして信用しない

というSprint 8方針も曖昧になる。

---

## Required Fix

External Provider Snapshotと
Local Entitlement Snapshotを分けることを推奨。

例：

```typescript
export interface ProviderSubscriptionSnapshot {
  providerSubscriptionId: string;
  stripeCustomerId: string;
  providerPriceId?: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: string;
  providerUpdatedAt?: string;
}
```

Gateway：

```typescript
getSubscription(
  providerSubscriptionId: string
): Promise<ProviderSubscriptionSnapshot>;
```

Webhook：

```text
ProviderSubscriptionSnapshot.stripeCustomerId
↓
BillingCustomerRepository.findByStripeCustomerId
↓
accountId
↓
Local Subscription upsert
```

Entitlement Resolverへ渡すLocal型は、
必要なら従来の`SubscriptionSnapshot`のままでよい。

重要なのは：

> canonical Stripe fetchの戻り値だけでAccount MappingとSubscription Persistに必要な情報が揃う

こと。

---

## Required Test

```text
T-WEBHOOK-05

supported subscription event
↓
event payload上のcustomer値は使用しない
↓
canonical getSubscription()が返すstripeCustomerId
↓
BillingCustomer解決
↓
correct Account Subscription updated
```

さらに可能なら：

```text
Webhook payload customer = A
Canonical Subscription customer = B
```

のFixtureで、

```text
B側だけ更新
```

されることを確認すると境界が明確になる。

---

# 5. Architecture Assessment

以下は引き続きPASS。

```text
Analyzer Plan-independent                       PASS
Stripe SDK isolation                            PASS
Pure Entitlement Resolver                       PASS
Fail-Closed subscription mapping                PASS
Local Subscription = Product Source of Truth    PASS
Checkout callback never grants Pro              PASS
Public / Protected Fastify scope                PASS
Raw-body signature verification                 PASS
Signature vs Event Interpretation split         PASS
Canonical Subscription re-fetch                 PASS
Ownership before Entitlement                    PASS
AI Retry only Pro gate                          PASS
UsageEvent transactional persistence            PASS
Worker Billing-unaware                          PASS
No Quota enforcement                            PASS
Fake Stripe only in CI                          PASS
```

---

# 6. Required Revision Summary

実装開始前に以下だけ反映する。

```text
F-09
ensureBillingCustomer()を
DB unique conflict recovery込みでIdempotent化

F-10
getSubscription()のcanonical Provider Snapshotへ
stripeCustomerIdを必須Contractとして追加
```

Tests：

```text
T-BILL-18
parallel Checkout
→ one BillingCustomer
→ both success

T-WEBHOOK-05
Account mapping uses canonical stripeCustomerId
not webhook payload customer
```

---

# 7. Final Decision

```text
SPRINT 8 IMPLEMENTATION PLAN

GO WITH FIXES

Critical  0
Major     2
Minor     0 blocking
```

今回もArchitectureの作り直しは不要。

前回指摘事項はすべて閉じているため、
修正対象は新規2点だけ。

```text
Concurrent BillingCustomer provisioning
Canonical Subscription identity contract
```

をPlanへ明記すれば、
次回はImplementation GO判定まで進めてよい。

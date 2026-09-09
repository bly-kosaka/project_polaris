# 58_Sprint_8_Plan_Review.md

# Project Polaris — Sprint 8 Implementation Plan Review

## Review Result

```text
GO WITH FIXES

Critical  0
Major     2
Minor     2
```

対象PlanはSprint 8の基本方針を正しく踏襲しています。特に、Free/ProでAnalyzer品質を変えないこと、StripeのCheckout成功URLをPro付与根拠にしないこと、Local Subscription SnapshotからPureなEntitlement Resolverで権限を決めること、OwnershipをEntitlementより先に検証すること、UsageEventをObservationSet Persist成功と同一Transactionで記録することはそのまま採用して問題ありません。

ただし、実装前に以下のMajor 2点を修正してください。

---

## Major M-01 — FakeBillingGatewayとEntitlement Source of Truthが分裂している

PlanではProduct側の判定を：

```text
PrismaSubscriptionRepository
↓
resolveEntitlement()
```

としている一方、Test/E2Eでは：

```text
FakeBillingGateway.activateSubscription(accountId)
↓
Gateway内のin-memory Mapをactive化
```

してPro化する設計になっています。

しかし`requireEntitlement()`と`GET /billing`はFakeBillingGatewayのMapを読みません。

そのため現Planのままでは：

```text
FakeBillingGateway.activateSubscription()
↓
Gateway内だけactive
↓
DB Subscription = null
↓
resolveEntitlement(null)
↓
Freeのまま
```

となります。

### Required Fix

TestでもProductionと同じくLocal Subscription SnapshotをEntitlementの唯一のSource of Truthにしてください。

```text
FakeBillingGateway
= Stripe外部操作だけのFake

Subscription State
= Prisma test fixture / Webhook処理によってDBへ保存

Entitlement
= DB Subscriptionからのみ解決
```

Product E2Eで簡略化するなら：

```text
createTestSubscription({
  accountId,
  status: 'active'
})
```

等でLocal Subscription Snapshotを作成します。

重要：

> Fake Provider内部状態をProduct EntitlementのSource of Truthにしない。

---

## Major M-02 — verifyWebhookSignature()がEvent Filter前にsubscriptionIdを要求している

PlanのContract：

```typescript
verifyWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string
): {
  id: string;
  type: string;
  subscriptionId: string;
};
```

一方、Webhook Routeは：

```text
Signature Verify
↓
Event Type Filter
├─ customer.subscription.* → process
└─ その他 → 200 ignore
```

です。

`checkout.session.completed`や`invoice.*`なども正しいStripe Eventですが、`data.object`はSubscriptionではありません。

このContractではSignature検証時にsubscriptionId抽出まで要求するため、正しい未対応Eventを200でignoreできない可能性があります。

### Required Fix

Signature VerificationとEvent Interpretationを分離してください。

例：

```typescript
interface VerifiedBillingWebhookEvent {
  id: string;
  type: string;
  data: unknown;
}

verifyWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string
): VerifiedBillingWebhookEvent;
```

その後：

```text
Signature Verify
↓
Event Type Filter
├─ unsupported
│   ↓
│ 200
│
└─ customer.subscription.created/updated/deleted
    ↓
   Subscription Eventとしてparse
    ↓
   providerSubscriptionId取得
    ↓
   canonical Stripe state取得
```

重要：

> 「正しいStripe署名か」と「Polarisが処理対象とするEventか」を同じ判定にしない。

---

## Minor m-01 — BillingGatewayの責務がDB Persistenceまで含まれている

Planの`createCustomerIfNeeded()`はStripe Customer作成だけでなくPrismaへのBillingCustomer保存まで担当します。

これでは：

```text
BillingGateway
= Stripe Gateway
+ Application Service
+ DB orchestration
```

になります。

MVPのBlocking Issueではありませんが、M-01のようなProvider StateとLocal Stateの混同を起こしやすくなります。

推奨：

```text
Application Service / Route
↓
BillingCustomerRepository lookup
↓
StripeGateway.createCustomer()
↓
BillingCustomerRepository persist
```

StripeGatewayは外部Stripe操作に限定してください。

---

## Minor m-02 — UsageEvent.countByAccountId()はSprint 8では不要

Plan自身が：

```text
No Usage Quota Enforcement
```

としている一方、`countByAccountId(accountId, metric?)`をtest/future-use onlyとして追加予定です。

Calendar Month / Subscription Period / Rolling 30 Daysのどれで集計するかも未決定なので、将来Query APIを先に固定する必要はありません。

Sprint 8では：

```text
UsageEvent.create
```

までを推奨します。

実際にUsage表示/Quotaを実装するSprintで必要なQuery Contractを決めてください。

---

## Good Decisions

以下は変更不要です。

- `packages/billing`を新設せずPure Entitlement Resolverを`packages/domain`へ置く。
- Stripe SDKをDomain/Analyzer/Workerへ入れない。
- Stripe raw statusをString保存し、`active/trialing/past_due`だけをProにするFail Closed方式。
- Fastify Public/Protected Scopeを分離し、WebhookだけClerk Auth外に置く。
- Webhook scopeだけRaw BodyをBufferで受ける。
- Webhook payloadをそのままSubscription Snapshotにせず、canonical Subscriptionを再取得する。
- Ownership → Entitlementの順序を守る。
- Sprint 8でPro Gateする既存機能をAI Explanation Retryだけに限定する。
- UsageEventをObservationSet Persist成功Transactionへ追加する。
- WorkerへaccountId/Plan/Stripe情報を渡さない。
- Checkout callbackをPro化根拠にしない。
- CIではReal Stripe Networkを使用しない。

---

## 追加Test Requirement

M-01/M-02修正後、以下を追加してください。

```text
T-BILL-16
FakeBillingGateway側だけactiveでも
DB Subscriptionが無ければFree

T-BILL-17
DB Subscription active
→ Gateway内部状態に依存せずPro

T-WEBHOOK-01
Valid unsupported Stripe Event
→ 200
→ Subscription mutationなし

T-WEBHOOK-02
Valid checkout.session.completed
→ 200
→ Pro付与なし

T-WEBHOOK-03
Invalid Signature
→ 400

T-WEBHOOK-04
Supported subscription event
→ canonical subscription取得
→ DB Snapshot
→ Entitlement反映
```

---

## Required Plan Revision

```text
1. FakeBillingGateway.activateSubscriptionによる
   Product Entitlement切替を廃止

2. Test/E2EのPro化は
   Local Subscription Snapshotを作成して行う

3. verifyWebhookSignature()から
   必須subscriptionIdを除外

4. Signature Verificationと
   Supported Event Interpretationを分離

5. Valid unsupported Stripe Event = 200
   のTestを追加

6. 可能ならStripeGatewayから
   BillingCustomer DB persistence orchestrationを外す

7. countByAccountIdはSprint 8から削除を推奨
```

---

# Final Verdict

```text
Critical  0
Major     2
Minor     2

GO WITH FIXES
```

Architectureの作り直しは不要です。

修正対象は主に：

```text
Test Source of Truth
Webhook Event Contract
Billing Gateway Responsibility
```

です。

Sprint 8本体の：

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

という方向は正しいため、Major 2点を修正版Implementation Planへ反映した後に実装へ進めます。

```text
SPRINT 8 IMPLEMENTATION
GO WITH FIXES
```

# 57_Development_Setup_and_Eighth_Sprint.md

# Project Polaris
# Sprint 8 — Entitlement / Billing（利用権限・課金）

対象Repository：

```text
bly-kosaka/project_polaris
```

Sprint 7 Final HEAD：

```text
88bb6954f58623b947c6713ab3364f4b15e4182b
```

前Sprint：

```text
Sprint 7
Authentication / Ownership
PASS
Critical 0
Major    0
Minor    0 blocking
```

---

# 1. Sprint 8 の目的

Sprint 8では、

```text
Authenticated Account
↓
Subscription State
↓
Plan
↓
Entitlement Resolver
↓
Effective Entitlement
↓
Product Feature
```

を実装する。

このSprintの目的は単にStripe Checkout画面を付けることではない。

最重要目的は：

> **「支払ったかどうか」と「何を使えるか」を分離し、Backendで利用権限を保証すること。**

---

# 2. 最重要不変条件

```text
PlanによってAnalyzerの解析精度を変えない。
```

同じ：

```text
Access Log
Analyzer Config
Known Information
```

なら、

```text
Free
Pro
```

で同じObservationSetを生成する。

以下をPlan差分にしてはいけない：

```text
Parser精度
Aggregation精度
Candidate Selectionロジック
Known Information判定
Redaction
ObservationSet Schema
Analyzer Fatal判定
```

---

# 3. BillingとAnalyzerの境界

禁止：

```text
Analyzer
↓
Account Plan確認
↓
解析内容変更
```

採用：

```text
Account
↓
Entitlement Resolver
↓
Feature / Capacity Gate

Access Log
↓
Analyzer
↓
ObservationSet
```

Analyzer Coreは：

```text
Account
Plan
Stripe
Subscription
Price
Payment
```

を知らない。

---

# 4. Sprint 8 のBilling Provider

採用：

```text
Stripe
```

MVPでは：

```text
Free
Pro
```

の2 Planのみ。

Team / Organization Billingは対象外。

---

# 5. Billing Model

MVP：

```text
Free
↓
Monthly Subscription
↓
Pro
```

Stripe側の実際の金額はCodeへHardcodeしない。

```text
Stripe Product
Stripe Price
```

をDashboard側で作成し、

```text
STRIPE_PRO_PRICE_ID
```

で参照する。

価格変更のためにApplication Codeを変更しない。

---

# 6. Plan Type

```typescript
export type Plan =
  | 'free'
  | 'pro';
```

PlanはAccountの手入力Fieldとして保存しない。

禁止：

```text
Account.plan = pro
```

をFrontend callbackやCheckout success URLから直接設定すること。

---

# 7. Subscription StateがSource of Truth

```text
Stripe
↓
Webhook
↓
Subscription Snapshot
↓
Entitlement Resolver
↓
Effective Plan
```

Checkout完了画面：

```text
?checkout=success
```

はPlan変更の根拠にしない。

Frontendから：

```text
POST /billing/checkout
↓
success URL
↓
Pro化
```

は禁止。

---

# 8. Entitlement Resolver

Stripe固有StatusをProduct Featureから分離する。

```typescript
export interface EffectiveEntitlement {
  plan: 'free' | 'pro';

  features: {
    aiExplanationRetry: boolean;

    // Future
    aiChat: boolean;
    reportExport: boolean;
    csvExport: boolean;
    analysisComparison: boolean;
  };

  billing: {
    status: string | null;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd?: string;
  };
}
```

Sprint 8で実際に使用するFeature：

```text
aiExplanationRetry
```

のみ。

Future FeatureはResolverの拡張先として扱い、
未実装FeatureをBilling UIで「現在利用可能」と表示しない。

---

# 9. Sprint 8で最初にGateする機能

既存：

```text
POST /analyses/:analysisId/explanation/retry
```

を：

```text
Pro Feature
```

とする。

Free：

```text
Initial AI Explanation
AI Summary
Overall Urgency
Findings
Next Check
Aggregation
```

は引き続き利用可能。

つまり：

```text
Free
↓
初回AI Explanationまでは使える

Pro
↓
AI Explanation Retryが使える
```

とする。

---

# 10. Analyzer QualityとPro Featureを混同しない

禁止：

```text
Free
→ Findings 3件

Pro
→ Findings 10件
```

禁止：

```text
Free
→ Candidate Selection少量

Pro
→ Candidate Selection大量
```

Sprint 8ではこうした解析品質差を作らない。

---

# 11. Stripe Subscription Statusの扱い

StripeのRaw StatusはDBに保持する。

Product側は：

```text
Pro Access Status
```

だけをResolverで決める。

MVP推奨：

```text
active
trialing
past_due
→ Pro

それ以外
→ Free
```

`past_due`を即Freeへ落とさない理由：

```text
一時的な支払い失敗
↓
Stripe Retry中
↓
即時Feature停止
```

を避けるため。

ただし：

```text
unpaid
canceled
incomplete
incomplete_expired
paused
unknown
```

はFree。

`cancel_at_period_end = true`でもStripe Statusが`active`である間はProを維持する。

StripeのRetry Policy自体はStripe Dashboard側で管理する。

---

# 12. Unknown Subscription Status

Stripe側に将来Statusが追加されても：

```text
unknown status
↓
Pro
```

としてはいけない。

Fail Closed：

```text
unknown
→ Free
```

とする。

Billing Warningは表示してよいが、
Product Accessを推測で拡張しない。

---

# 13. Prisma Data Model

推奨：

```prisma
model BillingCustomer {
  id               String   @id @default(cuid())
  accountId        String   @unique
  stripeCustomerId String   @unique
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  account Account @relation(...)
}

model Subscription {
  id                   String   @id @default(cuid())
  accountId            String   @unique
  provider             String
  providerSubscriptionId String @unique
  providerPriceId      String?
  status               String
  cancelAtPeriodEnd    Boolean  @default(false)
  currentPeriodEnd     DateTime?
  providerUpdatedAt    DateTime?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  account Account @relation(...)
}

model BillingWebhookEvent {
  id              String   @id @default(cuid())
  provider        String
  providerEventId String   @unique
  eventType       String
  createdAt       DateTime @default(now())
}
```

命名はImplementation PlanでRepository conventionsへ合わせて調整可能。

重要なのは：

```text
Account
1:1 BillingCustomer
1:0..1 Subscription
```

であること。

---

# 14. AccountへStripe IDを直接詰め込まない

避ける：

```prisma
Account {
  stripeCustomerId
  stripeSubscriptionId
  stripeStatus
  ...
}
```

理由：

```text
Authentication Profile
Billing State
```

は別Lifecycle。

AccountはIdentityのまま保つ。

---

# 15. Stripe Customer作成

Checkout開始時：

```text
Authenticated Account
↓
BillingCustomer lookup
├─ exists
│   ↓
│ Stripe Customer reuse
└─ missing
    ↓
  Stripe Customer create
    ↓
  BillingCustomer persist
```

Stripe Customer metadata：

```text
polarisAccountId
```

を保持してよい。

Emailは補助情報であり、
Account MappingのPrimary Keyにしない。

---

# 16. Stripe Customer作成のIdempotency

Concurrent Checkout RequestでCustomerを二重作成しない。

Stripe Customer CreateにはAccount単位のIdempotency Keyを使用する。

Concept：

```text
polaris-customer:${accountId}
```

実際のStripe SDK option形式はImplementation時にCurrent SDK型で確認する。

DB側：

```text
BillingCustomer.accountId @unique
stripeCustomerId @unique
```

も必須。

---

# 17. Checkout Session

Endpoint：

```text
POST /billing/checkout
```

処理：

```text
Authentication
↓
Email Verification
↓
Current Entitlement確認
↓
already Pro?
├─ yes → Conflict / Billing Summaryへ誘導
└─ no
   ↓
BillingCustomer ensure
↓
Stripe Checkout Session create
↓
URL return
```

Stripe Checkout：

```text
mode = subscription
price = STRIPE_PRO_PRICE_ID
customer = stripeCustomerId
```

Success / Cancel URLは：

```text
APP_BASE_URL
```

から生成。

---

# 18. Checkout Metadata

少なくとも：

```text
Account ID
```

をStripe側へ持たせる。

推奨：

```text
client_reference_id = accountId
subscription_data.metadata.polarisAccountId = accountId
```

ただしWebhookの主要Account解決は：

```text
stripeCustomerId
↓
BillingCustomer
↓
Account
```

とする。

Metadataだけを唯一のMapping手段にしない。

---

# 19. Customer Portal

Endpoint：

```text
POST /billing/portal
```

処理：

```text
Authenticated Account
↓
BillingCustomer lookup
↓
Stripe Billing Portal Session
↓
URL return
```

FrontendでStripe subscription cancel/update UIを自作しない。

MVP：

```text
Upgrade
Manage Billing
Cancel
Payment Method
Invoice
```

はStripe Customer Portalへ委譲する。

---

# 20. Public Stripe Webhook

Endpoint：

```text
POST /webhooks/stripe
```

これはClerk Authentication対象外。

代わりに：

```text
Stripe Signature Verification
```

を必須とする。

---

# 21. Fastify Route Scope変更

Sprint 7では：

```text
Global Auth Hook
↓
All Routes Protected
```

だった。

Sprint 8ではStripe WebhookだけPublic Routeが必要。

推奨Structure：

```text
Fastify Root
├─ Public Route Scope
│   └─ POST /webhooks/stripe
│
└─ Protected Product Scope
    ├─ authenticate
    ├─ requireVerifiedEmail
    ├─ Project Routes
    ├─ Analysis Routes
    ├─ AI Explanation Routes
    └─ Billing Routes
```

Auth Hook内に：

```text
if path === /webhooks/stripe
```

のような例外分岐を増やす設計は避ける。

Fastify Encapsulationで分離する。

---

# 22. Webhook Raw Body

Stripe Signature Verificationは：

```text
受信したRaw Request Body
```

に対して行う。

禁止：

```text
JSON parse
↓
JSON.stringify
↓
Signature Verify
```

元Byte列が変わる可能性がある。

Implementation PlanではFastifyでWebhook RouteだけRaw Bodyを安全に取得する方式をCurrent Versionに合わせて確定する。

---

# 23. Webhook Secret

```text
STRIPE_WEBHOOK_SECRET
```

を使用。

Frontendへ絶対に公開しない。

```text
VITE_STRIPE_SECRET_KEY
```

のようなSecret環境変数は禁止。

---

# 24. Webhook Events

Sprint 8 MVPでSubscription同期に必要：

```text
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
```

Checkout Session完了EventをAudit/Link補助として扱ってもよいが：

```text
checkout.session.completed
```

だけでProを付与してはいけない。

---

# 25. Webhook Idempotency

Stripe Webhookは再送される前提。

```text
providerEventId
```

をUnique保存する。

```text
same event
↓
second delivery
↓
already processed
↓
200
```

Product Stateを二重更新しない。

---

# 26. Webhook Event Order

Webhook delivery orderを信用しない。

最低限：

```text
providerUpdatedAt
```

またはStripe Eventの時刻を保持し、
明らかなstale updateで新しいSubscription Stateを巻き戻さない。

より確実な方法として、

```text
Webhook receive
↓
Subscription ID取得
↓
Stripe APIからCurrent Subscription取得
↓
Current Snapshot persist
```

を採用してよい。

実装PlanでCurrent Stripe SDK/API behaviorを確認し、
out-of-orderに強い方式を選択する。

---

# 27. Webhook Transaction Boundary

推奨：

```text
Signature Verify
↓
Stripe Current State Resolve
↓
DB Transaction
  ├─ BillingWebhookEvent insert
  └─ Subscription upsert
↓
200
```

External Stripe API CallをDB Transaction内に保持しない。

---

# 28. Webhook Failure

以下では：

```text
5xx
```

を返しStripe Retryへ委ねる。

```text
DB unavailable
Stripe canonical state取得失敗
Unexpected persistence failure
```

Signature invalid：

```text
400
```

---

# 29. EntitlementはWebhook同期済みDBから解決

Product Requestごとに：

```text
Stripe API
```

へ問い合わせない。

採用：

```text
Account
↓
Local Subscription Snapshot
↓
Entitlement Resolver
```

Stripe障害中でも既存Subscription UserがProductを使用できる。

---

# 30. Entitlement ResolverはPure Function

例：

```typescript
resolveEntitlement(
  subscription: SubscriptionSnapshot | null
): EffectiveEntitlement
```

禁止：

```text
resolveEntitlement()
↓
Stripe API call
```

禁止：

```text
resolveEntitlement()
↓
Prisma Query
```

I/Oは呼び出し側。

ResolverはPure。

---

# 31. APIでのFeature Gate

共通Helper：

```text
requireEntitlement(feature)
```

を用意。

例：

```text
POST /analyses/:analysisId/explanation/retry
↓
Authentication
↓
Ownership
↓
Entitlement
↓
Retry
```

順序は重要。

---

# 32. OwnershipとEntitlementのError順序

他人のAnalysis：

```text
404 ANALYSIS_NOT_FOUND
```

を先に返す。

禁止：

```text
他人のAnalysis
↓
Free Account
↓
403 PRO_REQUIRED
```

これではResource存在を推測できる。

採用：

```text
Ownership
↓
404 if not owner
↓
Entitlement
```

---

# 33. Entitlement Error

候補：

```text
403 ENTITLEMENT_REQUIRED
```

Response：

```json
{
  "error": {
    "code": "ENTITLEMENT_REQUIRED",
    "message": "This feature requires the Pro plan."
  }
}
```

Frontendはmessage文字列をBusiness Logicに使わない。

必要なら：

```json
{
  "error": {
    "code": "ENTITLEMENT_REQUIRED",
    "message": "...",
    "feature": "ai_explanation_retry"
  }
}
```

のような拡張をImplementation Planで検討する。

ただし既存Error Contractとの互換性を壊さない。

---

# 34. Billing Summary API

```text
GET /billing
```

Response候補：

```typescript
interface BillingSummaryDto {
  plan: 'free' | 'pro';

  subscription: {
    status: string | null;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd?: string;
  };

  features: {
    aiExplanationRetry: boolean;
  };

  canManageBilling: boolean;
}
```

Stripe Secret / Customer ID / Subscription IDをFrontendへ返す必要はない。

---

# 35. Billing Screen

既存：

```text
S40 Billing / Plan
```

を実装する。

表示：

```text
Current Plan
Subscription Status
Renewal / Period End
Cancel at Period End
Upgrade Button
Manage Billing Button
```

Pro Feature表示：

```text
現在利用可能
- AI Explanation Retry
```

未実装：

```text
AI Chat
Report Export
CSV Export
Comparison
```

を「利用可能」と表示しない。

---

# 36. Checkout Return

例：

```text
/billing?checkout=success
```

Frontend：

```text
Success Message
↓
GET /billing refresh
```

Webhook同期に少し時間差があれば：

```text
短時間Polling
```

してよい。

ただし：

```text
checkout=success
```

だけでUI上Pro扱いにしない。

---

# 37. Billing Portal Return

```text
/billing
```

へ戻す。

戻った後：

```text
GET /billing
```

を再取得。

---

# 38. Usage Accounting

Sprint 8でUsageの土台も作る。

最重要：

```text
Analysis作成時
```

ではなく、

```text
ObservationSet Persist Success
```

を「Analysis 1回利用」とする。

理由：

```text
Upload失敗
Parser Fatal
Infrastructure failure
```

を成功利用として課金・消費扱いにしないため。

---

# 39. Usage Event

推奨：

```prisma
model UsageEvent {
  id         String   @id @default(cuid())
  accountId  String
  analysisId String   @unique
  metric     String
  occurredAt DateTime @default(now())

  account Account @relation(...)
}
```

Sprint 8 Metric：

```text
analysis_completed
```

`analysisId @unique`により、
Worker retryでも二重Countしない。

---

# 40. Usage EventのTransaction

理想：

```text
ObservationSet Persist
+
UsageEvent insert
```

を同一DB Transactionにする。

```text
ObservationSet成功
Usage記録失敗
```

または：

```text
Usage記録成功
ObservationSet失敗
```

の片側成功を作らない。

---

# 41. Analyzer CoreはUsageを知らない

Usage Event作成に必要なOwnerは：

```text
Analysis
↓
Project
↓
ownerAccountId
```

からPersistence Layer側で解決する。

Analyzer Coreへ：

```text
accountId
plan
billing
```

を渡さない。

---

# 42. Sprint 8でUsage LimitをHardcodeしない

まだBusinessとして：

```text
Free 月何回
Pro 月何回
```

の正式値は決めていない。

したがってSprint 8で：

```text
5回
10回
100回
```

等を勝手に決めない。

Sprint 8：

```text
Usage Eventを正確に記録
Billing Summaryでcount可能
```

まで。

実際の月次Quota Enforcementは正式Limit決定後に有効化する。

---

# 43. 将来のUsage Period

UsageEvent方式なら：

```text
Calendar Month
Subscription Period
Rolling 30 Days
```

のどれでも後から集計可能。

先にCounterへ固定しない。

---

# 44. Billing Customer / Subscription Delete

Account削除WorkflowはSprint 8対象外。

Subscription CancellationはStripe Portalから行う。

Local Subscription rowは削除せず：

```text
status = canceled
```

として履歴Snapshotを残す。

---

# 45. Stripe IDsをLogへ出さない方針

Stripe Customer ID / Subscription IDはPasswordほどのSecretではないが、
通常Application Logへ大量出力しない。

絶対にLogしない：

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
Raw Authorization Header
Card Information
Webhook Raw Body
```

Webhook ErrorでRaw Payloadをdumpしない。

---

# 46. Payment Data

Polarisは：

```text
Card Number
CVC
Payment Method raw details
```

を保持しない。

Checkout / Customer Portalを使用し、
PCI対象範囲を最小化する。

---

# 47. Stripe SDK Boundary

Stripe SDKを：

```text
Analyzer
Worker
Domain
Entitlement Resolver
```

へ広げない。

推奨：

```text
apps/api/src/billing/
  stripe-gateway.ts
  stripe-webhook.ts
```

またはRepository実装に合わせた最小Boundary。

Provider-neutral化のためだけの過剰な抽象化はしない。

Stripeは現時点で唯一のBilling Provider。

---

# 48. packages/billing

作成するなら責務はPure Product Policyのみ。

例：

```text
packages/billing/
  types.ts
  entitlement.ts
  feature.ts
```

ここにStripe SDKを入れない方がよい。

```text
Stripe Integration
→ apps/api

Entitlement Policy
→ packages/billing
```

と分離する。

Implementation Planで現Repo構造と照合し、
package新設が過剰なら`packages/domain` + API Application Layerでもよい。

---

# 49. Environment Variables

候補：

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRO_PRICE_ID
APP_BASE_URL
```

既存の`STRIPE_*` scaffoldがあればCurrent Repoを確認して再利用する。

SecretはFrontendへ置かない。

FrontendにStripe Publishable Keyは、
Checkout Session URLへredirectするだけなら不要。

Sprint 8 MVPではStripe Elementsを使わない。

---

# 50. Stripe API Version

Codeへ推測のAPI Versionを書かない。

Implementation時に：

```text
installed Stripe SDK
Stripe Account API Version
Current official docs
```

を確認し、必要な場合だけ明示固定する。

---

# 51. Webhook Test Strategy

CIでReal Stripe Networkへ接続しない。

Test：

```text
Fake / Stub Stripe Gateway
Signed Webhook Fixture
DB
Fastify
```

を使用。

ただしSignature Verificationは可能な限りStripe SDK本体でTestする。

---

# 52. 必須Backend Tests

```text
T-BILL-01
Free Account
→ GET /billing
→ plan free

T-BILL-02
active Subscription
→ plan pro

T-BILL-03
trialing
→ pro

T-BILL-04
past_due
→ pro

T-BILL-05
canceled/unpaid/incomplete/unknown
→ free

T-BILL-06
Free Account
→ AI Explanation Retry
→ 403 ENTITLEMENT_REQUIRED

T-BILL-07
Pro Account
→ AI Explanation Retry
→ existing retry behavior

T-BILL-08
Other Account Analysis
→ 404
→ ENTITLEMENT_REQUIREDを先に返さない

T-BILL-09
Checkout creates/reuses BillingCustomer

T-BILL-10
Portal requires BillingCustomer

T-BILL-11
Webhook signature invalid
→ 400

T-BILL-12
Duplicate Stripe event
→ idempotent 200

T-BILL-13
subscription.updated
→ local snapshot updated

T-BILL-14
subscription.deleted/canceled
→ effective Free

T-BILL-15
Checkout success URLだけではProにならない
```

---

# 53. Usage Tests

```text
T-USAGE-01
ObservationSet Persist success
→ UsageEvent exactly 1

T-USAGE-02
Worker retry / duplicate delivery
→ UsageEvent still 1

T-USAGE-03
Fatal Analyzer
→ UsageEvent 0

T-USAGE-04
ObservationSet transaction rollback
→ UsageEvent 0

T-USAGE-05
Account A/B usage isolation
```

---

# 54. Frontend Tests

```text
T-WEB-BILL-01
Free Billing Page
→ Upgrade visible

T-WEB-BILL-02
Pro Billing Page
→ Manage Billing visible

T-WEB-BILL-03
ENTITLEMENT_REQUIRED
→ Pro案内
→ generic failure扱いにしない

T-WEB-BILL-04
checkout=success
→ GET /billing再取得
→ URL parameterだけでPro表示しない

T-WEB-BILL-05
cancelAtPeriodEnd
→ current period endまでPro表示
```

---

# 55. Product E2E

Real StripeはProduct E2Eで使用しない。

Fake Billing Gateway + Local Subscriptionを使用。

Flow：

```text
Account A Free
↓
Analysis
↓
Initial AI Explanation
↓
Retry
↓
403 / Upgrade CTA
↓
Fake Subscription active
↓
Billing refresh
↓
Pro
↓
Retry allowed
```

Ownership Regression：

```text
Account B
↓
Account A Analysis retry
↓
404
```

---

# 56. Manual Stripe Smoke Test

Sprint 8 Final Review前に、
Stripe Test Modeで1回確認する。

```text
Free Account
↓
Billing
↓
Upgrade
↓
Stripe Checkout Test Mode
↓
Webhook
↓
Pro反映
↓
AI Retry可能
↓
Customer Portal
↓
Cancel at period end
↓
Billing表示更新
```

可能ならStripe CLI等のCurrent official toolでWebhookをLocalへForwardする。

具体コマンドはImplementation時にCurrent Stripe Docsで確認。

---

# 57. Billing UIで恐怖訴求しない

禁止：

```text
無料プランでは危険を見逃します
```

禁止：

```text
Proでより安全な解析
```

Analyzer精度は同じ。

採用：

```text
Free
基本解析 + 初回AI Explanation

Pro
再確認・継続調査のための追加機能
```

---

# 58. Sprint 8で実装するもの

```text
Plan / Entitlement Types
Subscription Snapshot
BillingCustomer
Stripe Checkout
Stripe Customer Portal
Stripe Webhook
Webhook Signature Verification
Webhook Idempotency
Entitlement Resolver
Billing Summary API
AI Explanation Retry Gate
Billing / Plan Screen
UsageEvent
Usage Recording
Backend Tests
Frontend Tests
Product E2E
Stripe Test Mode Smoke
```

---

# 59. Sprint 8で実装しないもの

```text
AI Chat
Report Export
CSV Export
Analysis Comparison
Team Billing
Organization Billing
Seat Billing
Coupon UI
Usage-based Stripe Metering
Proration独自計算
Invoice独自UI
Card入力UI
Tax独自計算
Refund UI
Admin Billing Console
Lifetime Plan
One-time Purchase
Per-Analysis Payment
Monthly Quota Enforcement
```

---

# 60. One-time Paymentについて

Polaris将来案として：

```text
1 Analysis Purchase
Credit Pack
```

等は検討可能。

ただしSprint 8では：

```text
Free + Pro Subscription
```

だけを成立させる。

Subscription / Entitlement基盤を先に安定させる。

---

# 61. Sprint 8 Implementation Order

```text
1. Billing / Entitlement Domain
2. Prisma Billing Models
3. Entitlement Resolver
4. Stripe Gateway
5. BillingCustomer Ensure
6. Checkout Endpoint
7. Portal Endpoint
8. Public Webhook Scope
9. Signature Verification
10. Subscription Sync
11. Webhook Idempotency
12. Billing Summary API
13. AI Retry Entitlement Gate
14. UsageEvent Persistence
15. Billing Screen
16. Backend Tests
17. Frontend Tests
18. Product E2E
19. Stripe Test Mode Smoke
```

---

# 62. Sprint 8 Architecture

```text
Browser
↓
Frontend
↓
Backend API
├─ Authentication
├─ Ownership
├─ Entitlement
│
├─ Billing API
│   ├─ Checkout
│   └─ Customer Portal
│        ↓
│      Stripe
│
└─ Public Stripe Webhook
     ↓
 Signature Verification
     ↓
 Subscription Snapshot
     ↓
 Database

Product Feature
↓
Entitlement Resolver
↓
Free / Pro Decision
```

---

# 63. Analyzer Flowとの関係

```text
Access Log
↓
Analyzer
↓
ObservationSet Persist
├─ ObservationSetRecord
└─ UsageEvent
↓
AI Explanation
```

Stripe APIはこのFlowに存在しない。

---

# 64. Failure Isolation

Stripe停止時：

```text
Existing User
↓
Local Subscription Snapshot
↓
Entitlement Resolve
↓
Product利用継続
```

Checkout / Portal / Webhook同期は影響するが、
既存Analysisの閲覧やAnalyzerをStripe API依存にしない。

---

# 65. Definition of Done

Sprint 8完了条件：

```text
[ ] Free / Pro Plan model
[ ] Subscription Snapshot persist
[ ] BillingCustomer persist
[ ] Stripe Checkout
[ ] Customer Portal
[ ] Public Stripe Webhook
[ ] Signature Verification
[ ] Duplicate Webhook Safe
[ ] Subscription Status Sync
[ ] Entitlement Resolver
[ ] active/trialing/past_due → Pro
[ ] canceled/unpaid/incomplete/unknown → Free
[ ] AI Retry Pro Gate
[ ] Ownership before Entitlement
[ ] Billing Summary API
[ ] Billing Screen
[ ] Checkout callback never grants Pro
[ ] UsageEvent on ObservationSet Persist Success
[ ] Usage Event idempotent
[ ] Analyzer Core unchanged
[ ] Worker does not call Stripe
[ ] Existing Sprint 1–7 Tests PASS
[ ] Billing Tests PASS
[ ] Product E2E PASS
[ ] CI PASS
[ ] Stripe Test Mode Smoke PASS
```

---

# 66. Sprint 8終了時の状態

```text
Authenticated Polaris
↓
Account Ownership
↓
Free / Pro Entitlement
↓
Stripe Subscription
↓
Backend Feature Gate
↓
Usage Accounting
```

ここまで成立すれば、
次のSprintから：

```text
AI Chat
Report Export
CSV Export
Usage Limit
```

等をEntitlementへ安全に接続できる。

---

# 67. Claude Codeへの次の指示

このファイルをRepositoryの`md/`へ置いた後、
Claude Codeにはまだ実装させない。

以下を依頼する：

```text
57_Development_Setup_and_Eighth_Sprint.md と
現在のRepository HEADを確認し、
Sprint 8 Entitlement / Billingの詳細Implementation Planを作成してください。

まだコード変更は行わないでください。

特に以下を具体化してください。

- Current Stripe SDK versionと必要API
- Stripe Webhook Raw Body取得方式
- Fastify Public/Protected Route Scope
- Prisma Migration
- BillingCustomer / Subscription / WebhookEvent / UsageEvent
- Entitlement Resolver
- Subscription Status mapping
- Checkout / Customer Portal
- Webhook idempotency / out-of-order対策
- AI Explanation Retry Entitlement Gate
- Ownership vs Entitlement判定順
- ObservationSet PersistとUsageEventのTransaction
- Billing Screen
- Backend Test Matrix
- Frontend Test Matrix
- Product E2E
- Stripe Test Mode Smoke Test
- CI

実装前レビューを行うため、
Planだけを提示してください。
```

---

# 68. Final Sprint 8 Principle

```text
Stripe decides payment state.
Polaris decides entitlement.
Analyzer remains the same.
```

日本語：

> **Stripeは支払い状態を管理する。Polarisは利用権限を決める。Analyzerの解析品質は変えない。**

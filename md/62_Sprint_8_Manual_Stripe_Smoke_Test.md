# 62_Sprint_8_Manual_Stripe_Smoke_Test.md

# Project Polaris — Sprint 8 Manual Stripe Test Mode Smoke Test

対象HEAD（テスト開始時点）:

```text
fc6a06fbc418348747bed1958ca2e52f96078d96
```

基準:

```text
61_Sprint_8_Implementation_Review.md §22 External Verification Gate
```

実施日: 2026-09-18

## 1. 結論

```text
STRIPE TEST MODE SMOKE  PASS
```

`61_Sprint_8_Implementation_Review.md` §22 が要求したチェックリストを全て実施し、全項目PASSした。加えて、自動テストでは検出できない実装上の不整合を1件発見し、修正・再検証まで完了した。

```text
SPRINT 8 COMPLETE
SPRINT 9 GO
```

---

## 2. 実施環境

- Stripe CLI (`stripe.exe` v1.50.11) を `winget install --id Stripe.StripeCli` で導入し、Device Pairing (`stripe login` → `stripe login --complete-device`) でユーザー自身のStripeアカウントに認証。
- Test/Sandboxアカウント「BLY PROJECT」（`acct_1UGq5E1DM5Jw8rMX`、Restricted Key経由）上に、Pro Plan用のProduct/Priceを新規作成：
  - Product: `Polaris Pro` (`prod_VHP0nLEfKA14Kn`)
  - Price: `$10.00/月` (`price_1UGqD71DM5Jw8rMX7bEeiStb`)
- Restricted Key（`rk_test_...`）の権限を事前に個別検証（Customers 読み書き / Checkout Sessions 作成 / Billing Portal Sessions 作成 / Subscriptions 読み取り）— 全て成功を確認してから `.env` に設定。
- `stripe listen --forward-to localhost:3001/webhooks/stripe` でWebhookをローカルAPIへ転送し、表示された `whsec_...` を `STRIPE_WEBHOOK_SECRET` に設定。
- Docker Compose（Postgres/Redis/MinIO）、`apps/api`（`node dist/index.js`、実Clerk/実Stripe/実OpenAI設定）、`apps/worker`、`apps/web`（Vite dev server）を全て実プロセスとして起動。
- Clerkの実アカウントでSign In。

## 3. 実施フローと結果

### 3.1 既存機能の回帰確認（Free、AI Explanation初回生成）

Project作成 → `fixtures/access-logs/valid.log` アップロード → 実Analyzer Worker + 実OpenAI Providerで処理 → Result画面にAI Summary / Findings / Overall Urgencyが正しく表示されることを確認。Sprint 8がSprint 6のAI Explanation初回生成パスに影響していないことを実環境で確認した。

### 3.2 Free → Stripe Checkout Test Mode

Billing画面の「Proにアップグレード」→ 実Stripe Checkout Session（`mode=subscription`, Priceは上記Pro Price, `client_reference_id`/Subscriptionメタデータに`accountId`）へ遷移。テストカード `4242 4242 4242 4242` で決済。

**結果**: 決済成功、`http://localhost:5173/billing?checkout=success` へリダイレクト。

### 3.3 Webhook配信

`stripe listen` のログで以下を含む全イベントが `[200]` で処理されたことを確認：

```text
customer.created                    200 (unsupported type -> ignore)
charge.succeeded                    200 (unsupported type -> ignore)
invoice.finalized                   200 (unsupported type -> ignore)
invoice.paid                        200 (unsupported type -> ignore)
payment_method.attached             200 (unsupported type -> ignore)
customer.updated                    200 (unsupported type -> ignore)
customer.subscription.created       200 (supported -> canonical fetch + DB sync)
payment_intent.succeeded            200 (unsupported type -> ignore)
payment_intent.created              200 (unsupported type -> ignore)
checkout.session.completed          200 (unsupported type -> ignore, T-WEBHOOK-02相当)
invoice.created                     200 (unsupported type -> ignore)
invoice.payment_succeeded           200 (unsupported type -> ignore)
invoice_payment.paid                200 (unsupported type -> ignore)
```

Event Type Filtering（§57 M-02）が実Stripeの実際のイベント種別に対しても設計通り機能していることを確認。

### 3.4 Subscription active / GET /billing → Pro

Billing画面「更新」後：

```text
プラン       Pro
ステータス    active
次回更新日    2026-10-18
解約予定      なし
```

DB `Subscription` テーブルも同期を確認。

### 3.5 AI Retry allowed（Ownership/Entitlementゲート）

既にAI Explanationが成功済みのAnalysisに対し、ブラウザのClerkセッション（`window.Clerk.session.getToken()`）から取得した実トークンで `POST /analyses/:id/explanation/retry` を直接呼び出し：

```json
{ "status": 409, "body": { "error": { "code": "AI_EXPLANATION_ALREADY_EXISTS" } } }
```

403 `ENTITLEMENT_REQUIRED` ではなく409が返ったことで、Pro Accountに対してEntitlementゲートが正しく通過し、既存成功結果の再生成を拒否する業務ロジックへ到達していることを実環境で確認した（自動テストT-BILL-07の実環境版）。

### 3.6 Customer Portal → 解約

「お支払い情報を管理」→ 実Stripe Customer Portal（`https://billing.stripe.com/...`）に遷移。「サブスクをキャンセル」→「このサブスクリプションをキャンセルしても、契約期間が終了する2026年10月18日までは引き続きご利用になれます」の確認画面を経て解約を確定。

### 3.7 発見された不整合と修正

解約確定後、Webhook (`customer.subscription.updated`) は `[200]` で処理されたが、Billing画面は **「解約予定: なし」のまま**だった。

**原因調査**：Stripe側の実Subscriptionオブジェクトを直接確認した結果、

```json
{
  "cancel_at_period_end": false,
  "cancel_at": 1792285917,
  "canceled_at": 1789694031,
  "status": "active",
  "billing_mode": { "type": "flexible", ... }
}
```

このStripeアカウントの Billing Mode（`flexible`）では、Customer Portal経由の解約が `cancel_at_period_end: true` ではなく **`cancel_at`（具体的な未来のタイムスタンプ）** で表現されていた。`StripeGateway.getSubscription()`（`apps/api/src/billing/stripe-gateway.ts`）は `cancel_at_period_end` のみを読んでおり、`cancel_at` を見ていなかったため、DBの`Subscription.cancelAtPeriodEnd`も`false`のまま同期され、Billing画面の表示に反映されなかった。

この経路は自動テストで一度も検証されていなかった：Worker/API統合テストは全て `FakeBillingGateway`（`setCanonicalSubscription()`で挙動を直接指定する単純なスタブ）を注入しており、`StripeGateway.getSubscription()`自体のマッピングロジックを実際に実行するテストが存在しなかった。実Stripe環境でのみ露見した、この検証ゲート本来の役割どおりの発見。

**修正**（`apps/api/src/billing/stripe-gateway.ts`）:

```typescript
cancelAtPeriodEnd: subscription.cancel_at_period_end || subscription.cancel_at !== null,
```

`cancel_at_period_end`と`cancel_at`のいずれかが解約予定を示していれば`true`とする。新規テストファイル `apps/api/src/billing/__tests__/stripe-gateway-get-subscription.test.ts`（4件、`vi.mock('stripe', ...)`で`subscriptions.retrieve`をモック）を追加し、両方のケース（真偽値方式／`cancel_at`方式）と、`providerPriceId`/`status`/`currentPeriodEnd`のマッピングを回帰保証した。既存の実SDKベースの署名検証テスト（`stripe-gateway.test.ts`）とはファイルを分離し、影響を与えていない。

修正後、`apps/api`を再ビルド・再起動し、同じCustomer Portal解約フローを再実施（DBは`yarn test:backend`実行により一度リセットされたため、Checkout以降を再実施）した結果：

```text
プラン       Pro
ステータス    active
次回更新日    2026-10-18
解約予定      あり   ← 修正後、正しく反映
```

DB `Subscription` テーブルでも `cancelAtPeriodEnd = t` を確認。

### 3.8 期間終了までPro維持

`ステータス: active` かつ `プラン: Pro` のまま `次回更新日`（契約期間終了日）まで変化しないことを、上記3.7の最終状態で確認（`canceled_at`が設定されていても`status`は`active`のまま、Fail-Closedマッピング上も期間終了までPro扱いが継続することを既存の`resolveEntitlement()`ロジック・自動テストと合わせて確認）。

## 4. 運用上の注意点（今回判明）

- **ローカル環境のPostgresは`yarn test:backend`実行のたびに全テーブルがリセットされる**（各テストファイルの`resetDatabase()`が共有DBに対して実行されるため）。Manual Smoke Test中に自動テストスイートを実行すると、手動で作成したAccount/Project/BillingCustomer/Subscription等のデータが消える。Stripe側のオブジェクト（Customer/Subscription）自体は消えないため、ローカルDB側だけ再構築（再Checkout等）すれば復旧できる。
- **Manual Smoke Test用に起動した`apps/api`/`apps/worker`の実プロセスは、自動テストスイートと同じRedis/BullMQ Queueを取り合い、テストのタイムアウトや誤ったJob奪取を引き起こす**（Sprint 7のManual Clerk Smoke Testで一度発生した既知の問題と同種）。Manual Smoke Test中に`yarn test:backend`等を実行する場合は、必ず先にManual Smoke Test用プロセスを停止すること。
- StripeのRestricted Key（`rk_test_...`）とCLIの`stripe login`で認証されたSandboxアカウントは別アカウントになり得る（今回実際に発生）。Product/Price作成時は、実際に使うAPI Keyの`--api-key`を明示して同一アカウント上に作成する必要がある。

## 5. Definition of Done への反映

`61_Sprint_8_Implementation_Review.md` §22/§23 の要求：

```text
STRIPE TEST MODE SMOKE
NOT VERIFIED
```

は、本ドキュメントの実施結果により：

```text
STRIPE TEST MODE SMOKE
PASS
```

へ更新される。`stripe-gateway.ts`の修正はSprint 8の設計・アーキテクチャ判断（`57_Development_Setup_and_Eighth_Sprint.md`〜`60_Sprint_8_Plan_Implementation_GO.md`）を一切変更しない、Gateway実装内の1マッピング修正であり、`61_Sprint_8_Implementation_Review.md`が明示した「Stripe Test Mode SmokeがPASSしたら、追加コード変更が無ければ再度Architecture Reviewは不要」の条件を損なわない（Architectureレベルの変更ではないため）。

```text
SPRINT 8 COMPLETE
SPRINT 9 GO
```

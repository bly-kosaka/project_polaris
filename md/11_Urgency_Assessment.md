# Project Polaris
# 11_Urgency_Assessment
## 緊急性・確認優先度の評価設計

---

# 1. 目的

本章では、AIが`ObservationSet`および`AIExplanationResult`を基に、

```text
どの程度早く人が確認すべきか
```

を評価する方法を定義する。

ここで扱うものは危険度ではない。

```text
Risk
Threat
Attack Probability
Severity
```

を数値化するものでもない。

PolarisにおけるUrgencyは、

> **人が確認すべき優先度と時間的な緊急性**

を表す。

---

# 2. なぜHealth ScoreではなくUrgencyなのか

従来構想では`Health Score`を想定していた。

しかし08以降の設計では、

```text
Severity
Priority
Risk Score
Intent
Attack Type
```

をAnalyzerから排除している。

そのため、

```text
Health Score = 危険度の総合点
```

とすると、これまでの設計思想と衝突する。

一方、Polarisの主要価値は、

```text
今どこを見るべきか
```

をユーザーへ伝えることである。

そのためScoreではなく、

```text
Urgency Assessment
```

として再定義する。

---

# 3. Urgencyの定義

Urgencyは次を意味する。

```text
この観測結果を
どの程度早く人が確認した方がよいか
```

Urgencyは次を意味しない。

```text
攻撃である確率
侵害された可能性
脆弱性の深刻度
被害額
CVE Severity
```

---

# 4. Urgency Level

初期実装では4段階とする。

```typescript
type UrgencyLevel =
  | 'low'
  | 'normal'
  | 'high'
  | 'immediate';
```

表示例：

```text
Low
→ 急ぎではない

Normal
→ 通常確認

High
→ 早めに確認

Immediate
→ できるだけ早く確認
```

UI文言は将来調整可能。

---

# 5. 数値Scoreを持たない

初期実装では、

```text
73 / 100
42点
Risk 8.4
```

等の数値Scoreを持たない。

理由：

- 精密に見えるが根拠が曖昧
- Count Weight等を再導入しやすい
- ユーザーが数値差を過度に信頼する
- Score算出式の保守が必要になる

4段階のCategoryと理由説明で十分とする。

---

# 6. AIが評価する

UrgencyはAnalyzerではなくAIが生成する。

```text
ObservationSet
↓
AI Explanation
↓
Urgency Assessment
```

AnalyzerはUrgency算出に必要な数値・分布・Known Informationを提供するが、Urgencyそのものは生成しない。

---

# 7. AI Output

```typescript
interface AIUrgencyAssessment {
  level: UrgencyLevel;

  reason: string;

  references: ObservationReference[];

  limitations?: string[];
}
```

Urgencyには必ず、

```text
なぜそのLevelなのか
```

を説明する`reason`を持たせる。

---

# 8. Reference必須

Urgency Assessmentには最低1つのObservation Referenceを持たせる。

例：

```yaml
level: high

reason: >
  /api/orderで500レスポンスが集中しており、
  サービス処理に影響している可能性があるため、
  早めの確認を推奨します。

references:
  - groupId: path:24
    groupType: path
  - groupId: status:500
    groupType: status
```

Referenceなしで、

```text
High
```

と判断してはならない。

---

# 9. Urgency判断の観点

AIは単一のThresholdではなく、複数の観測事実を総合して判断する。

代表的な観点：

```text
サービス影響の可能性
継続性
集中性
対象の性質
既知情報
Status
Method
Source IP / Path分布
時間分布
確認しない場合の影響
```

ただし、これらをWeight付きScoreへ変換しない。

---

# 10. サービス影響

サービス影響が考えられるObservationはUrgencyを上げる要素になり得る。

例：

```text
500が特定APIへ集中
大量の5xx
特定機能Pathでエラー継続
```

ただし、

```text
500が1件ある
```

だけでImmediateにはしない。

AIは分布や継続性を合わせて判断する。

---

# 11. Security関連

Security上確認価値が高いPathでも、Countが少ない場合がある。

例：

```text
/.git/config
/.env
```

Known Informationが一致している場合、

```text
公開状態確認が必要
```

と説明できる。

UrgencyはCountではなく、

```text
対象の意味
実際のStatus
同Pathへのアクセス状況
```

等を合わせて判断する。

---

# 12. Countは補助情報

CountはUrgency判断の一材料ではあるが、単独では使用しない。

禁止：

```text
100件以上 = High
1000件以上 = Immediate
```

許可される考え方：

```text
同一Pathへのアクセスが短時間に集中
+
POST中心
+
Known Information上ログイン処理
```

→ 早めに確認する価値がある可能性

---

# 13. Low

`low`は、

```text
現時点では急いで確認する必要性が低い
```

ことを意味する。

安全を保証するものではない。

例：

```text
静的ファイルへの大量アクセス
Status 200中心
多数IPから分散
特別なKnown Informationなし
```

AIは、

```text
今回の観測範囲では急ぎの確認要素は少なそうです
```

と説明できる。

---

# 14. Normal

`normal`は、

```text
通常の確認対象として見ておく
```

程度。

例：

```text
少数の404
単発のKnown Information一致
継続性なし
サービス影響が見えない
```

---

# 15. High

`high`は、

```text
早めに人が確認した方がよい
```

状態。

例：

```text
特定Pathで5xx集中
同一IPから多数Path
ログイン系PathへのPOST集中
公開不要情報へのアクセス
```

ただしObservation次第でNormalになることもある。

Path名だけでHighに固定しない。

---

# 16. Immediate

`immediate`は慎重に使用する。

意味：

```text
放置せず、できるだけ早く確認した方がよい
```

例として考えられるのは、

```text
サービス影響が強く示唆される継続的5xx
短時間で急激に広範囲へ障害が出ている
明らかに公開状態確認が必要なSensitive Resourceへ200でアクセスが成立している
```

等。

ただしAIはAccess Logだけで侵害を断定しない。

---

# 17. Immediateの乱用防止

AI Promptでは、

```text
Immediateは例外的に使用する
```

ことを明示する。

Highとの違い：

```text
High:
早めに確認

Immediate:
業務・公開状態・継続障害等の観点から、
後回しにしない方がよい
```

---

# 18. Overall Urgencyのみを持つ

初期実装ではUrgencyは解析全体に対して1つだけ持つ。

```typescript
interface AIExplanationResult {
  summary: string;
  overallUrgency: AIUrgencyAssessment;
  findings: AIFinding[];
  overallNotes: string[];
  dataLimitations: string[];
}
```

Finding単位のUrgencyは持たない。

理由：

- Finding LevelがSeverity / Priorityの別名になりやすい
- Finding順序とUrgency Levelの2種類の優先表現が生まれる
- UIがLevel順ソートを始めるとScore設計へ逆戻りしやすい
- ユーザーが最初に知りたいのは解析全体を今すぐ見るべきかどうか

各Findingの確認順はAI Explanation内の並び順で表現する。

---

# 19. Overall Urgency

Overall UrgencyはFindingsの件数や単純な最大値から機械的に算出しない。

AIがObservationSet全体について、

```text
サービス影響
継続性
集中性
Known Information
Status / Method
Path / IP / 時間分布
Data Limitation
```

を踏まえて判断する。

---

# 20. Overall Urgencyの根拠

Overall UrgencyにもReferenceを持つ。

複数Findingを根拠とする場合は、それぞれのObservation Referenceを含める。

Urgency理由に、

```text
Findingが3件あるからHigh
```

のような単純件数基準を使わない。

---

# 21. Data Limitationとの関係

Parse WarningやTruncationがある場合、Urgency判断の確実性が下がることがある。

ただし、

```text
データが不完全だからUrgencyを下げる
```

とはしない。

むしろ、

```text
判断できる範囲が限られている
```

ことを`limitations`へ明示する。

---

# 22. Known Information Failure

Known Information Storeが利用できない場合でもUrgency評価は可能。

ただし、

```text
Pathの意味情報が不足している
```

ため、過度な断定を避ける。

`limitations`へ追加できる。

---

# 23. AI一般知識との関係

Known Informationがない場合、AI一般知識を補助的に使用できる。

ただしUrgencyを上げる根拠にする場合も、Observation事実と分離する。

例：

```text
このPath名は一般に設定ファイルを示す可能性があります。
ただし案件固有の用途は確認できません。
```

---

# 24. User / Project Known Information

Project / User情報がある場合はUrgency判断でも優先する。

例：

```text
/project-admin/
Project Known Information:
社内監視用ダミーPath
```

なら一般知識による「管理画面」推測よりProject情報を優先する。

---

# 25. Security Riskとの分離

Urgencyを、

```text
Security Risk
```

とUI上で表記しない。

例えば、

```text
APIの500継続
```

はSecurity Riskが低くてもUrgencyは高い可能性がある。

逆に、

```text
Sensitive Pathへの単発404
```

はSecurity上確認価値があってもImmediateではない可能性がある。

---

# 26. Presentation

Overviewでは、

```text
確認の緊急性
High
早めの確認を推奨
```

のように表示する。

必ず理由を表示またはすぐ展開できるようにする。

色だけで伝えない。

---

# 27. Finding Card

Finding Cardには個別Urgency Labelを付けない。

個別Findingの確認順はAIが返した順序で表現する。

これにより、FindingごとのSeverity / PriorityをUI側で再生成することを防ぐ。

---

# 28. Free / Paid

UrgencyのPlan別提供範囲は本章では確定しない。

Overall UrgencyはAI生成情報であるため、無料版へ提供する場合もAI実行コストが発生する。

したがって、

```text
無料 = Overall Urgency
有料 = Finding詳細
```

のような境界をArchitectureだけで固定しない。

Product Plan側で、

- AI実行コスト
- 無料版の価値
- AI Chatとの境界
- レポート機能

を踏まえて決定する。

ただしPlanによってAnalyzerのObservationSet自体を変えてはならない。

---

# 29. AI失敗時

AIが利用できない場合、UrgencyをAnalyzerが代替生成しない。

```text
Urgency unavailable
```

とする。

Analyzer Countから仮Scoreを生成するFallbackは禁止する。

---

# 30. Urgency Output Validation

AIが返したUrgencyについて、次を検証できる。

```text
levelがEnum内
reasonが空でない
referenceが存在
Reference先Groupが存在
Immediateの場合は理由が具体的
```

意味的妥当性はAI Testで評価する。

---

# 31. Urgency Testing

## Grounding

- Countだけを理由にしない
- Observation Referenceを持つ
- Known InformationとObservationを混同しない

## Level

- Immediateを乱用しない
- Lowを「安全」と説明しない
- Highを「攻撃確定」と説明しない

## Service Impact

- 5xx集中等でサービス影響可能性を考慮する
- 単発ErrorだけでImmediateにしない

## Security

- Sensitive Path 1件でもCountだけで無視しない
- Path名だけでHigh固定しない
- Statusや分布を合わせて考える

## Limitation

- Parse Warningを考慮する
- Truncationを無視しない
- Known Information欠損時に断定を弱める

---

# 32. 09_AI_Explanationへの反映

09の`AIExplanationResult`へ次を追加する。

```typescript
overallUrgency: AIUrgencyAssessment
```

Finding単位のUrgencyは追加しない。

09の原則、

```text
Severity / Priority / Risk Scoreを持たない
```

は維持する。

UrgencyはPriority Scoreではなく、確認の時間的優先度である。

---

# 33. 10_Output_Presentationへの反映

10のTop Summaryへ、

```text
確認の緊急性
```

を追加する。

Finding Cardには個別Urgencyを表示しない。

従来の`Health Score`表示は初期設計から削除する。

---

# 34. Health Scoreの扱い

初期実装ではHealth Scoreを採用しない。

理由：

- Urgencyと役割が重複する
- 数値Scoreの意味が不明確
- Severity / Risk Scoreを再導入する可能性がある
- ターゲットユーザーには「今確認すべきか」の方が直接的

将来、別目的のHealth Scoreが必要になった場合は独立して再設計する。

---

# 35. 11_Urgency_Assessment 確定事項

1. Health Scoreは初期実装では採用しない。
2. 代わりにUrgency Assessmentを導入する。
3. Urgencyは危険度ではなく確認の緊急性を表す。
4. 初期LevelはLow / Normal / High / Immediateの4段階とする。
5. 数値Scoreは持たない。
6. UrgencyはAIが生成する。
7. AnalyzerはUrgencyを算出しない。
8. Count単独ThresholdでLevelを決めない。
9. Urgencyには理由を必須とする。
10. UrgencyにはObservation Referenceを必須とする。
11. Immediateは例外的に使用する。
12. Lowは安全を意味しない。
13. Security RiskとUrgencyを分離する。
14. Service ImpactもUrgency判断対象とする。
15. 初期実装ではOverall Urgencyのみを持つ。
16. Finding単位Urgencyは持たず、Finding順で確認順序を表現する。
17. Partial / Truncation / Known Information欠損を考慮する。
18. AI失敗時にAnalyzer Scoreで代替しない。
19. 09_AI_ExplanationへUrgency Fieldを追加する。
20. 10_Output_PresentationへOverall Urgency表示を追加する。
21. UrgencyのFree / Paid境界はProduct Plan側で決定する。

---



# 35.1 横断レビューによる補正

08〜11を横断して確認した結果、初期設計ではUrgencyを**Overallのみ**に限定する。

Finding単位Urgencyは、実質的にPriority / Severityの別名となる可能性が高いため採用しない。

また、Overall UrgencyはAI生成情報であり、無料版に含めるかどうかはArchitectureではなくProduct Planの判断とする。

これにより、

```text
Analyzer
→ 観測事実

AI Findings
→ 何を見るべきかの説明順

Overall Urgency
→ 解析全体をどの程度早く確認すべきか

Presentation
→ そのまま表示
```

という責務分離を維持する。

# 36. 次の設計対象

次は11で確定したUrgencyを09 / 10へ正式に差し戻し、そのうえでProduct全体の主要Pipelineをレビューする。

対象：

```text
08 Analyzer
09 AI Explanation
10 Presentation
11 Urgency
```

レビュー観点：

- 責務重複がないか
- Analyzerが再び意味判断していないか
- AIへ判断を寄せすぎていないか
- UIが新しいScoreを勝手に生成していないか
- Free / Paid境界がProduct Visionと整合するか
- 初期実装として過剰設計になっていないか

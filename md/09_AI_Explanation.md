# Project Polaris
# 09_AI_Explanation
## AI説明設計

---

# 1. 目的

本章では、Analyzerが生成した`ObservationSet`をAIがどのように解釈し、ユーザーへ説明するかを定義する。

Analyzerは以下までを担当する。

```text
Parse
Normalize
Group / Aggregate
Known Information Annotation
Selection
Redaction / Size Control
ObservationSet
```

AIはその後段で、

```text
ObservationSet
↓
Explanation
```

を担当する。

AIの役割は、アクセスログを再解析することではない。

AIは`ObservationSet`に整理された観測事実を読み、

- 何が観測されているか
- 既知情報上、それが何であるか
- どのような状況が考えられるか
- 何が断定できないか
- 次に何を確認すべきか

を人が理解できる形へ変換する。

---

# 2. 基本原則

## 2.1 AIはObservationSetを唯一の解析根拠とする

AIは生ログ全体を再解析しない。

初期実装では、説明生成の主要入力は`ObservationSet`とする。

```text
Raw Log
  ↓
Analyzer
  ↓
ObservationSet
  ↓
AI
```

AIがObservationSetに存在しないアクセスや集計結果を「確認した」と説明してはならない。

---

## 2.2 観測事実と解釈を分離する

AI出力では次を混同しない。

```text
Fact
Known Information
Interpretation
Limitation
Next Check
```

例：

```text
Fact:
同一IPから /wp-login.php へ5件のアクセスがあり、
そのうち4件がPOSTでした。

Known Information:
このPathはWordPressで一般的にログイン処理に利用されます。

Interpretation:
自動的なログイン試行である可能性があります。

Limitation:
アクセスログだけでは認証の成否や攻撃目的までは確認できません。

Next Check:
該当時間帯の認証ログやWordPress側のログイン履歴を確認してください。
```

---

## 2.3 AIは断定しすぎない

ObservationSetから直接確認できない事項は断定しない。

禁止例：

```text
ブルートフォース攻撃です。
侵入されました。
脆弱性が悪用されています。
攻撃者はWordPressを狙っています。
```

ObservationSetの内容によっては、次のような表現を使用する。

```text
可能性があります
考えられます
確認が必要です
アクセスログだけでは断定できません
```

---

## 2.4 Countだけで意味を決めない

Countは観測事実であり、危険度ではない。

AIは、

```text
件数が多い = 危険
件数が少ない = 問題なし
```

とは判断しない。

例えば、

```text
/.git/config
Count: 1
```

でも確認価値が高い場合がある。

一方、

```text
/assets/main.css
Count: 12000
```

でも正常アクセスの可能性がある。

AIはPath、Status、Method、IP分布、Known Information、時間分布等を合わせて説明する。

---

# 3. AI Input

## 3.1 必須入力

AIは最低限、次を受け取る。

```typescript
interface AIExplanationInput {
  analyzerStatus:
    | 'success'
    | 'partial';

  observationSet: ObservationSet;

  analyzerErrors: AnalyzerError[];

  analyzerWarnings: AnalyzerWarning[];
}
```

`failed`結果は通常AI Explanationへ送らない。

解析自体が成立していないため、UI側でAnalyzer Errorとして扱う。

---

## 3.2 Partial Result

`analyzerStatus = partial`の場合、AIは欠損情報を必ず考慮する。

例：

```text
250行Parse失敗
Known Information Store unavailable
User-Agent View failed
```

AIは、

```text
解析できた範囲では...
```

のように結果の範囲を明示する。

欠損情報を推測で補完しない。

---

## 3.3 Truncation

ObservationSetにTruncationがある場合、AIは選出済みGroupだけを見ている。

そのため、

```text
全Pathを確認しました
すべてのアクセスを確認した結果
```

と説明してはならない。

必要に応じて、

```text
Analyzerが抽出した代表的な集計結果では...
```

と表現する。

---



# 3.4 Access Log Scope

MVPのAI ExplanationはAccess Log由来の`ObservationSet`を対象とする。

AIはError LogやApplication Logを実際に解析したとは扱わない。

Access Logだけでは原因を判断できない場合、LimitationとNext Checkに分けて説明する。

例：

```text
Limitation:
Access Logだけでは500レスポンスの内部原因は確認できません。

Next Check:
同時間帯のApplication / PHP Error Logを確認してください。
```

この境界を明示することで、「PolarisがError Logまで確認済み」とユーザーが誤認することを防ぐ。

# 4. Explanation Structure

AI出力は次の5層を基本とする。

```text
1. Observation
2. Known Context
3. Interpretation
4. Limitation
5. Next Check
```

ただし、すべての項目を機械的に5段落へ分ける必要はない。

ユーザーにとって読みやすい文章へまとめる。

---

# 5. Observation

## 5.1 定義

ObservationはObservationSetから直接確認できる事実である。

例：

```text
/wp-login.phpへ5件
POST 4件
Source IP 1件
404 220件
Distinct Path 218件
500が/api/orderへ7件
```

Observationに推測を混ぜない。

---

## 5.2 数値の使用

数値は必要なものだけ表示する。

ObservationSetに多数のDistributionが存在していても、すべてを本文へ列挙する必要はない。

AIは説明に必要な数値を選ぶ。

ただし、数値を変更・丸めすぎ・再計算して別値として説明してはならない。

---

# 6. Known Context

## 6.1 Known Informationの扱い

Known InformationはPolarisが事前に保持している一般情報または案件固有情報である。

AIはKnown Informationを優先的に説明へ利用する。

例：

```yaml
path: /wp-login.php

knownInformation:
  label: WordPress Login Path
  description: WordPressで一般的にログイン処理に使用されるPathです。
```

AIは、

```text
/wp-login.phpはWordPressで一般的にログイン処理に使われるPathです。
```

と説明できる。

---

## 6.2 Known Informationは攻撃判定ではない

Known Information一致だけで、

```text
危険
攻撃
脆弱性
```

と判断してはならない。

Known Informationは対象の意味を説明するためのContextである。

---

## 6.3 Primary Information

複数Known Informationが一致した場合、`isPrimary = true`を優先する。

Project / User情報がBuilt-inより優先される場合も同様。

AIは案件固有情報を一般情報より優先する。

---

# 7. Interpretation

## 7.1 定義

InterpretationはObservationとKnown Informationから考えられる状況を説明する。

例：

```text
同一IP
多数Path
404中心
短時間
```

から、

```text
自動化されたPath探索のようなアクセスパターンである可能性があります。
```

と説明することはできる。

ただしAnalyzerが「Scan」と分類したわけではないことに注意する。

---

## 7.2 解釈の根拠

Interpretationには、可能な限り根拠となるObservationを含める。

悪い例：

```text
Botアクセスの可能性があります。
```

良い例：

```text
同一IPから短時間に218種類のPathへアクセスし、
その多くが404となっているため、
自動化されたPath探索のようなアクセスである可能性があります。
```

---

## 7.3 外部知識の利用

AIは一般的なWeb技術知識を説明に利用できる。

ただし、

```text
ObservationSetにない事実を確認済みとして追加する
```

ことは禁止する。

例：

```text
/wp-login.php
```

についてWordPressのログインPathであると説明することは可能。

しかし、

```text
このサイトはWordPress 6.xです
```

のようにObservationSetにないVersionを推定して断定してはならない。

---

# 8. Limitation

## 8.1 目的

Polarisはアクセスログだけでは判断できない事項を明示する。

これは説明品質上重要である。

---

## 8.2 代表例

### 認証結果

Access Logだけでは、

```text
ログイン成功
ログイン失敗
アカウント侵害
```

を確認できない場合がある。

### Request Body

通常のAccess LogではPOST Bodyを確認できない。

そのためCredential Stuffingや入力内容を直接確認できない場合がある。

### Server Internal State

500レスポンスが存在しても、Access Logだけでは具体的なApplication Error内容を確認できない。

### Truncation

ObservationSetが一部Groupのみの場合、全アクセスについて断定できない。

### Parse Warning

Parse不能行がある場合、それらに重要情報が含まれていた可能性を否定できない。

---

# 9. Next Check

## 9.1 目的

AIは単なる説明で終わらず、

```text
次に何を確認すればよいか
```

を提示する。

ただし、根拠なく大掛かりな対応を推奨しない。

---

## 9.2 Next Checkの基本順序

初期方針として、次の順を優先する。

```text
1. 同じログ内の関連情報
2. Application / CMS Log
3. Authentication Log
4. Server Error Log
5. WAF / CDN / Firewall Log
6. 設定・公開状態の確認
7. 必要に応じたブロック等の対応
```

まず確認を促し、その後に対応を提案する。

---

## 9.3 IP Blockの扱い

AIはObservationだけを根拠に即座に、

```text
このIPをブロックしてください
```

と断定しない。

例えば、

- Known monitoring service
- Search crawler
- Shared proxy
- CDN
- 正常利用者

の可能性があるため。

必要に応じて、

```text
他のアクセス内容やIPの利用目的を確認し、
不要なアクセスと判断できる場合はブロックを検討してください。
```

とする。

---

# 10. User-facing Output Model

## 10.1 基本構造

AI出力は、初期実装では次の構造を基本とする。

```typescript
interface AIExplanationResult {
  summary: string;

  overallUrgency: AIUrgencyAssessment;

  findings: AIFinding[];

  overallNotes: string[];

  dataLimitations: string[];
}
```

---

## 10.2 AIFinding

```typescript
interface AIFinding {
  id: string;

  title: string;

  observation: string;

  interpretation?: string;

  limitation?: string;

  nextChecks: string[];

  references: ObservationReference[];
}
```

Severity / Priorityは初期Interfaceへ持たせない。

---



# 10.3 Urgency Assessment

AI Explanationは、Findingの内容とは別に「どの程度早く人が確認した方がよいか」を示すUrgency Assessmentを持つ。

```typescript
type UrgencyLevel =
  | 'low'
  | 'normal'
  | 'high'
  | 'immediate';

interface AIUrgencyAssessment {
  level: UrgencyLevel;

  reason: string;

  references: ObservationReference[];

  limitations?: string[];
}
```

UrgencyはSeverity / Risk / Attack Probabilityではない。

```text
Low       = 急ぎではない
Normal    = 通常確認
High      = 早めに確認
Immediate = できるだけ早く確認
```

数値Scoreは持たない。

Count単独ThresholdでLevelを決めず、Observation全体を根拠にAIが判断する。

Urgencyには必ず理由とObservation Referenceを持たせる。

初期実装ではUrgencyは解析全体の`overallUrgency`のみを持つ。

Finding単位のUrgencyは持たない。FindingごとにUrgencyを付けると、Severity / Priorityを別名で再導入する構造になりやすいためである。

Findingの確認順序はAIの説明順で表現し、数値・Levelによる個別Priorityは生成しない。

`Immediate`は例外的に使用し、Access Logだけで侵害や攻撃成功を断定する意味には使用しない。

# 11. Finding

## 11.1 Findingの定義

Findingは、

```text
ユーザーへ個別に説明する価値がある観測内容
```

である。

AnalyzerのGroupと1対1である必要はない。

AIは複数Groupをまとめて1つのFindingとして説明できる。

例：

```text
Path Group
/wp-login.php

Source IP × Path Group
203.0.113.10 × /wp-login.php

Time Group
10:00-10:05
```

をまとめ、

```text
/wp-login.phpへの集中したPOSTアクセス
```

というFindingにできる。

---

## 11.2 AIによるGroup統合

AnalyzerではGroup間の意味的Relationを作らなかった。

AIはExplanation段階で、ObservationSet内のReferenceや共通値を利用して関連するGroupを1つのFindingへまとめてよい。

これはAnalyzerの解析結果を書き換えることではない。

AI出力上の説明整理である。

---

# 12. Finding Title

Titleは短く、ユーザーが内容を一目で理解できるものにする。

良い例：

```text
/wp-login.phpへの繰り返しアクセス
多数の存在しないPathへのアクセス
/api/orderで500エラーが集中
.git設定ファイルへのアクセス
```

避ける：

```text
Critical Attack Detected
Suspicious Activity
Security Incident
```

根拠なくSeverityやIncidentを断定しない。

---

# 13. Finding Selection

AIはObservationSetのすべてのGroupをFindingにする必要はない。

目的は、

```text
今見るべきこと
```

を絞ることである。

AIは、

- Known Information
- Count
- Distribution
- Status
- Method
- Distinct Path / IP
- Time
- Group間の関連
- Data Limitation

を見て、説明価値のあるFindingを選ぶ。

ただしAIがGroupを省略したからといって、Analyzerデータが消えるわけではない。

UIでは必要に応じてObservationSetの集計Viewを別途表示できる。

---

# 14. Finding数

Finding数を固定値で厳密に制限しない。

ただし大量のFindingを生成するとトリアージ用途を損なう。

初期Promptでは、

```text
重要なものを少数にまとめる
```

ことを指示する。

具体的な最大件数は実UI検証後に決定する。

根拠のない、

```text
必ず5件
```

等は仕様化しない。

---

# 15. Summary

Summaryは解析全体の短い説明である。

目的は、

```text
まず何を見るべきか
```

をユーザーが数秒で理解すること。

例：

```text
同一IPから多数の存在しないPathへのアクセスがあり、
自動化された探索の可能性があります。
また、/api/orderでは少数ですが500エラーが集中しています。
```

Summaryでは詳細な数値を大量に列挙しない。

---

# 16. Overall Notes

Finding単位では表現しにくい全体傾向を必要に応じて保持する。

例：

```text
大半のアクセスは200レスポンスです。
POSTリクエストは全体では少数です。
```

ただし「問題なし」と断定するための欄ではない。

---

# 17. Data Limitations

解析品質に影響する制約をまとめる。

例：

```text
250行をParseできませんでした。
Path Groupは全10,000件中100件がObservationSetへ選出されています。
Known Information StoreのProject情報を取得できませんでした。
```

ユーザーがAI説明の確実性を判断するための情報である。

---

# 18. Reference

各Findingは根拠としたObservation GroupをReferenceする。

```yaml
references:
  - groupId: path:12
    groupType: path
  - groupId: ip_path:8
    groupType: source_ip_path
```

これにより、

```text
AIがなぜそう説明したのか
```

をUIで確認できる。

---

# 19. Explanation Grounding

AIはFindingごとに最低1つのObservation Referenceを持つ。

ReferenceなしのFindingを通常生成しない。

例外は、

```text
Parse Warning
Truncation
Known Information Source Failure
```

などTop Level Metadata自体を説明する場合。

---

# 20. Known Informationがない場合

Unknown PathでもAIはPath文字列や集計情報から説明できる。

ただし、

```text
/client/special-api.php
```

の意味が不明なら、

```text
Path名からAPI関連の可能性があります
```

程度に留める。

案件固有の意味を断定しない。

Known Informationへ自動登録もしない。

---

# 21. Known InformationとAI一般知識の競合

Known InformationとAIの一般知識が異なる場合、Known Informationを優先する。

特にProject / User情報を優先する。

例：

```text
/login
Project Known Information:
キャンペーン応募完了ページ
```

AIが一般的に`/login`を認証Pathと考えても、Project情報を優先する。

---

# 22. AIの禁止事項

AI Explanationでは次を禁止する。

1. ObservationSetにないアクセスを確認済みと説明する
2. Known Information一致だけで攻撃と断定する
3. Countだけで危険度を決める
4. Severity / Priorityを勝手に数値化する
5. 認証成功・侵入成功を根拠なく断定する
6. Unsupported / Failed Viewのデータを推測する
7. Parse Warningを無視する
8. Truncationを無視して全件確認済みと説明する
9. Known Informationを勝手に書き換える
10. Unknown Pathの意味を断定する
11. Observation Referenceのない事実を主要Findingとして生成する
12. User / Project Known Informationより一般知識を優先する

---

# 23. Prompt Responsibility

本章ではAIの振る舞いと入出力契約を定義する。

具体的なSystem Prompt / Prompt Template全文は別途Prompt章またはAI Architecture側へ配置する。

Promptには少なくとも次を含める。

```text
ObservationSetを唯一の観測根拠とする
FactとInterpretationを分離する
Known Informationを利用する
断定できない事項を明示する
Partial / Truncationを考慮する
Next Checkを提示する
Finding Referenceを返す
```

---

# 24. Output Example

入力概要：

```text
/wp-login.php
5 requests
1 source IP
GET 1
POST 4

Known:
WordPress Login Path
```

AI出力例：

```yaml
summary: >
  WordPressのログイン処理に使われるPathへの
  繰り返しアクセスが確認されています。

findings:
  - id: finding-1
    title: /wp-login.phpへの繰り返しアクセス

    observation: >
      /wp-login.phpへ5件のアクセスがあり、
      1つの送信元IPからGET 1件、POST 4件が記録されています。

    interpretation: >
      /wp-login.phpはWordPressで一般的にログイン処理に使用されるため、
      自動的なログイン試行である可能性があります。

    limitation: >
      Access Logだけでは認証の成功・失敗や、
      実際にパスワード試行が行われたかまでは確認できません。

    nextChecks:
      - 該当時間帯のWordPressまたは認証ログを確認する
      - 同一IPからの他Pathへのアクセス内容を確認する

    references:
      - groupId: path:1
        groupType: path
```

この出力には、

```text
攻撃です
ブルートフォースです
Criticalです
```

等の断定を含めない。

---

# 25. 複数Groupの統合例

入力：

```text
IP A
240 requests
218 distinct paths
404: 220

Status 404
4200 requests
1750 distinct paths

Time 10:00-10:05
IP Aが集中
```

AIは、

```text
同一IPから多数の異なるPathへのアクセス
```

という1つのFindingへ統合できる。

Observation:

```text
同一IPから240件、218種類のPathへアクセスしており、
220件が404でした。
```

Interpretation:

```text
短時間に多数の異なるPathを試しているため、
自動化されたPath探索のようなアクセスである可能性があります。
```

Limitation:

```text
アクセスログだけでは使用されたツールや目的までは特定できません。
```

Next Check:

```text
代表Pathを確認
同一IPの前後アクセスを確認
必要に応じてWAF/CDNログを確認
```

---

# 26. 5xx例

入力：

```text
/api/order
120 requests
200: 113
500: 7
```

AI:

```text
/api/orderで120件中7件の500レスポンスが確認されています。
全体の5xx件数が少なくても、このPathに集中しています。

Access Logだけでは500の原因は分からないため、
同時間帯のApplication Error Logを確認してください。
```

AIは、

```text
/api/orderにバグがあります
DB障害です
```

と断定しない。

---

# 27. 「問題なさそう」の扱い

PolarisのOutputには、

```text
問題なさそうなこと
```

も重要である。

ただしAIが、

```text
問題ありません
安全です
```

と断定することは避ける。

例：

```text
今回選出された集計結果では、
特定Pathへの5xx集中は確認されていません。
```

のように、ObservationSetの範囲を明示する。

---

# 28. Negative Evidence

ObservationSetに存在しないことを根拠に、

```text
攻撃はありません
```

とは言わない。

特にTruncationがある場合、ObservationSetは全Groupを含まない。

AIがNegative Evidenceを説明する場合は、

```text
今回Analyzerが選出した範囲では...
```

と限定する。

---

# 29. AI Output Stability

同じObservationSetに対して表現が多少変わることは許容する。

ただし次の構造的要件は安定させる。

- FindingがObservation Referenceを持つ
- ObservationとInterpretationが混ざらない
- Known Informationを優先する
- Limitationを必要時に出す
- Next Checkを出す
- Partial / Truncationを無視しない

これらはPrompt / Schema / Testで保証する。

---

# 30. AI Explanation Testing

## 30.1 Grounding

- ObservationSetにないCountを生成しない
- ObservationSetにないPathを確認済みと説明しない
- Finding Referenceが存在する
- Reference先Groupと説明が一致する

## 30.2 Known Information

- Built-in Known Informationを利用する
- Project / User情報を優先する
- Known Informationだけで攻撃判定しない
- Unknown Pathを断定しない

## 30.3 Limitation

- Parse Warningがある場合に無視しない
- Truncationを考慮する
- Access Logだけでは不明な事項を断定しない

## 30.4 Next Check

- Observationに対応した確認先を提示する
- いきなり強い対応を要求しない
- 確認→判断→対応の順を基本とする

## 30.5 Semantic Separation

- FactとInterpretationを分離する
- Severity / Priorityを勝手に生成しない
- Countだけで結論を決めない

---

# 31. 09_AI_Explanation 確定事項

1. AIはObservationSetを主要な解析根拠とする。
2. AIは生ログ全体を再解析しない。
3. Fact / Known Information / Interpretation / Limitation / Next Checkを分離する。
4. Countだけで危険度を判断しない。
5. Known Informationは対象の意味説明に利用する。
6. Known Information一致だけで攻撃と断定しない。
7. Project / User Known Informationを一般知識より優先する。
8. AIはObservationSetから複数Groupを1Findingへまとめてよい。
9. FindingはObservation Referenceを持つ。
10. Severity / Priority / Risk Scoreは初期AI Outputにも持たせない。
11. 危険度とは分離したOverall Urgency Assessmentを持つ。
12. Urgencyは数値ScoreではなくLow / Normal / High / Immediateとする。
13. Urgencyには理由とObservation Referenceを必須とする。
14. Finding単位のUrgencyは初期実装では持たない。
11. Partial Resultでは欠損を明示する。
12. Truncationがある場合に全件確認済みと説明しない。
13. Access Logだけでは確認できない事項を明示する。
14. Next Checkを提示する。
15. Negative Evidenceで安全を断定しない。
16. AI説明品質はGrounding / Separation / Limitation / Next CheckでTestingする。

---

# 32. 次の設計対象

次は、AI Explanation Resultをユーザーへどう提示するかを定義する。

候補：

```text
10_Output_Presentation
```

対象：

- 「今見るべきこと」
- 「確認できたこと」
- 「考えられること」
- 「断定できないこと」
- 「次に確認すること」
- Parse Warning / Truncation表示
- ObservationへのDrill-down
- AI FindingとAggregation Viewの関係
- 無料 / 有料での表示差

AIが何を説明するかと、UIでどう見せるかを分離して設計する。

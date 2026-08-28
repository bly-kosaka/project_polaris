# Project Polaris
# 23_Wireframe_Specification
## ワイヤーフレーム仕様

---

# 1. 目的

本書では、21_Screen_Architectureおよび22_UI_Interaction_Designで定義した画面設計を、実装可能なWireframe Specificationへ落とし込む。

対象：

```text
Application Shell
Project List
Project Overview
Analysis List
Analysis Upload
Analysis Processing
Analysis Result
Known Information
Billing
Responsive Layout
```

本書では色・装飾・最終Typographyよりも、

```text
位置
幅
順序
情報量
Primary Action
Interaction
```

を優先して固定する。

---

# 2. 最重要画面

最も詳細に設計する画面：

```text
Analysis Result
```

理由：

PolarisのProduct Valueが最も直接伝わる画面だからである。

---

# 3. Desktop基準

Design基準：

```text
Desktop First
```

想定Viewport：

```text
1440px
```

ただし固定幅ではなくResponsive。

---

# 4. Application Shell

```text
┌──────────────────────────────────────────────────────────────┐
│ Header                                                       │
├──────────────┬───────────────────────────────────────────────┤
│              │                                               │
│ Sidebar      │ Main Content                                  │
│              │                                               │
│              │                                               │
│              │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

---

# 5. Header

高さ目安：

```text
56–64px
```

構成：

```text
Logo
Project Context / Breadcrumb
Spacer
Help候補
Account Menu
```

Headerへ大量Actionを置かない。

---

# 6. Sidebar

幅目安：

```text
220–260px
```

構成：

```text
Project Switcher

Overview
Analyses
Known Information

────────

Billing
Account
```

---

# 7. Main Content

最大幅：

```text
1400px程度
```

ただしAnalysis Result / Aggregation Tableは広めに使用可能。

通常画面：

```text
padding 24–32px
```

---

# 8. Page Header Pattern

```text
┌─────────────────────────────────────────────┐
│ Breadcrumb                                  │
│                                             │
│ Page Title                    Primary CTA   │
│ Description                                 │
└─────────────────────────────────────────────┘
```

---

# 9. Project List Wireframe

```text
┌──────────────────────────────────────────────────────────────┐
│ Projects                                      [新規Project] │
│ 案件ごとにAccess Log解析を管理します                        │
├──────────────────────────────────────────────────────────────┤
│ Search                                                       │
├──────────────────────────────────────────────────────────────┤
│ Project A                                                    │
│ Latest: 2026-08-28  High       Completed                     │
│ 12 Analyses                                      [開く →]   │
├──────────────────────────────────────────────────────────────┤
│ Project B                                                    │
│ Latest: 2026-08-20  Normal     Completed                     │
│ 4 Analyses                                       [開く →]   │
└──────────────────────────────────────────────────────────────┘
```

---

# 10. Project List Card

Cardに入れる：

```text
Project Name
Latest Analysis Date
Latest Urgency
Latest Status
Analysis Count
```

入れない：

```text
Chart
大量Statistics
Health Score
```

---

# 11. Project Empty State

```text
┌──────────────────────────────────────────┐
│                                          │
│          Polaris Motif                   │
│                                          │
│  まだProjectがありません                │
│                                          │
│  案件ごとにAccess Log解析を管理できます │
│                                          │
│        [最初のProjectを作成]             │
│                                          │
└──────────────────────────────────────────┘
```

---

# 12. Project Overview Wireframe

```text
┌──────────────────────────────────────────────────────────────┐
│ Project A                         [Access Logを解析する]      │
├──────────────────────────────────────────────────────────────┤
│ Latest Analysis                                              │
│                                                              │
│  High                                                        │
│  早めの確認をおすすめします                                 │
│                                                              │
│  2026-08-28 12:20                                            │
│  125,482 requests                              [結果を見る] │
├──────────────────────────────────────────────────────────────┤
│ Recent Analyses                                              │
│                                                              │
│ Date             Urgency       Status        Requests        │
│ 2026-08-28       High          Completed     125,482         │
│ 2026-08-20       Normal        Completed      82,114         │
│ 2026-08-12       Low           Completed      54,220         │
│                                              [すべて見る]    │
├──────────────────────────────────────────────────────────────┤
│ Known Information                                            │
│ 12 entries                                      [管理する]   │
└──────────────────────────────────────────────────────────────┘
```

---

# 13. Project Overview Priority

最初に見せる：

```text
Latest Analysis
New Analysis CTA
```

Known InformationはSecondary。

---

# 14. Analysis List Wireframe

```text
┌──────────────────────────────────────────────────────────────┐
│ Analyses                          [Access Logを解析する]      │
├──────────────────────────────────────────────────────────────┤
│ Search / Filter                                              │
├──────────────────────────────────────────────────────────────┤
│ Date       Log Period   Requests   Urgency  Parse   Status   │
│ 08/28      10–12        125,482    High     ⚠250    Done     │
│ 08/20      00–24         82,114    Normal   OK      Done     │
│ 08/12      00–24         54,220    Low      OK      Done     │
└──────────────────────────────────────────────────────────────┘
```

Row ClickでResultへ。

---

# 15. Analysis Upload Wireframe

```text
┌──────────────────────────────────────────────────────────────┐
│ Access Logを解析する                                        │
│                                                              │
│ Access Logをアップロードしてください                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────────────────────────────────────────────┐   │
│   │                                                      │   │
│   │   Access Logをここにドロップ                         │   │
│   │                                                      │   │
│   │        または [ファイルを選択]                       │   │
│   │                                                      │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                              │
│   対応: Access Log                                           │
│   最大サイズ: xxx MB                                         │
│                                                              │
│   ✓ Raw Logは解析後削除されます                             │
│   ✓ AIへRaw Logそのものは送信しません                      │
│                                                              │
│                                      [解析を開始]            │
└──────────────────────────────────────────────────────────────┘
```

---

# 16. File Selected State

```text
┌──────────────────────────────────────────────────────────────┐
│ access.log                                                   │
│ 48.2 MB                                          [削除]      │
└──────────────────────────────────────────────────────────────┘

                                    [解析を開始]
```

---

# 17. Upload Error

Drop Area直下に表示。

```text
このファイルはアップロード上限を超えています。
100MB以下のAccess Logを選択してください。
```

Page TopだけにErrorを出さない。

---

# 18. Analysis Processing Wireframe

```text
┌──────────────────────────────────────────────────────────────┐
│ 解析しています                                              │
│ access.log · 48.2 MB                                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ✓ アップロード完了                                        │
│   ✓ ログを解析                                              │
│   ● 解析結果を整理しています                                │
│   ○ AIによる説明を生成                                      │
│                                                              │
│   開始: 13:42                                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Percentは表示しない。

---

# 19. Analyzer Ready / AI Processing

```text
┌──────────────────────────────────────────────────────────────┐
│ ログ解析が完了しました                                      │
│                                                              │
│ AIによる説明を生成しています                                │
│                                                              │
│ [集計結果を先に見る]                                        │
└──────────────────────────────────────────────────────────────┘
```

AI完了までAnalyzer ResultをBlockしない。

---

# 20. Analysis Result
## 推奨基本Wireframe

```text
┌────────────────────────────────────────────────────────────────────┐
│ Project A / Analyses / 2026-08-28                                 │
│                                                                    │
│ 2026-08-28 12:20                              [AIに質問] [Export] │
│ 10:00–12:00 · 125,482 requests · access.log                       │
├────────────────────────────────────────────────────────────────────┤
│ ⚠ 250行を解析できませんでした                         [詳細]      │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ HIGH                                                               │
│ 早めの確認をおすすめします                                        │
│                                                                    │
│ /wp-login.phpへのアクセスと複数IPからの404集中が確認されています │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ 今回の解析概要                                                     │
│                                                                    │
│ WordPressログインパスへのアクセスと、短時間に複数の404レスポンス  │
│ が集中しています。ただしAccess Logだけでは侵入成功の有無までは   │
│ 確認できません。                                                   │
├────────────────────────────────────────────────────────────────────┤
│ 今確認したいこと                                                   │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ WordPressログインパスへのアクセス                             │ │
│ │                                                                │ │
│ │ 確認できたこと                                                 │ │
│ │ /wp-login.phpへ...                                             │ │
│ │                                                                │ │
│ │ 考えられること                                                 │ │
│ │ ...                                                            │ │
│ │                                                                │ │
│ │ このログだけでは分からないこと                               │ │
│ │ ...                                                            │ │
│ │                                                                │ │
│ │ 次に確認すること                                               │ │
│ │ ・...                                                          │ │
│ │                                                                │ │
│ │ [関連データを見る →]                                          │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ 404レスポンスの集中                                           │ │
│ │ ...                                                            │ │
│ └────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────┤
│ 次に確認すること                                                   │
│ ・PHP / Application Error Log                                      │
│ ・WAF Event                                                        │
├────────────────────────────────────────────────────────────────────┤
│ この解析で分からないこと                                           │
│ Access LogだけではApplication内部の原因は確認できません           │
├────────────────────────────────────────────────────────────────────┤
│ 詳細データ                                                         │
│                                                                    │
│ [Path] [Source IP] [Status] [Method] [User-Agent] [Time]           │
│                                                                    │
│ Search   Status ▼   Method ▼                                       │
│                                                                    │
│ Path                 Requests   IPs   Status       First    Last   │
│ /wp-login.php        1,240      82    200/404      10:12    11:58  │
│ /xmlrpc.php            820      44    403/404      10:20    11:42  │
│ ...                                                                │
└────────────────────────────────────────────────────────────────────┘
```

---

# 21. Result First View

1440px Desktopで、Scroll前に最低限、

```text
Metadata
Parse Warning
Overall Urgency
AI Summaryの主要部分
```

が入ることを目標とする。

Finding全部をFirst Viewへ押し込まない。

---

# 22. Result Width

AI Summary / Finding：

```text
Readable Width
```

を優先。

Aggregation：

```text
Full Available Width
```

を使用。

同じContainer Widthに固定しなくてもよい。

---

# 23. Finding Card Width

Main Contentが広すぎる場合、

```text
900–1100px程度
```

を目安に読みやすさを確保する。

---

# 24. Finding Card Detail

```text
┌──────────────────────────────────────────────┐
│ Finding Title                                │
├──────────────────────────────────────────────┤
│ 確認できたこと                               │
│                                              │
│ Observation                                  │
├──────────────────────────────────────────────┤
│ 考えられること                               │
│                                              │
│ Interpretation                               │
├──────────────────────────────────────────────┤
│ このログだけでは分からないこと              │
│                                              │
│ Limitation                                   │
├──────────────────────────────────────────────┤
│ 次に確認すること                             │
│                                              │
│ □ Check A                                    │
│ □ Check B                                    │
├──────────────────────────────────────────────┤
│ 関連データ  Path ×2  IP ×3      [見る →]    │
└──────────────────────────────────────────────┘
```

---

# 25. Next Check Checkbox

Checkbox風UIを使う場合、

```text
実際にTaskとして保存するのか
単なるBulletなのか
```

を混同しない。

MVPでは保存機能がないため、通常Bulletを推奨。

---

# 26. Limitation Placement

Finding内のLimitationに加え、全体LimitationをAggregation直前に配置。

理由：

AI Interpretationを読んだ後、Evidenceを見る前に制約を再確認できる。

---

# 27. Aggregation Section

Result Page内に統合。

別Pageへ遷移させない。

Findingとの往復を簡単にする。

---

# 28. Aggregation Header

```text
詳細データ
AIの説明に使われた集計結果を確認できます
```

のような補助説明を付ける。

---

# 29. Aggregation Tab Wireframe

```text
┌────────────────────────────────────────────────────────────┐
│ [Path] [Source IP] [Status] [Method] [User-Agent] [Time]   │
├────────────────────────────────────────────────────────────┤
│ Search...          Status ▼       Method ▼     Clear       │
├────────────────────────────────────────────────────────────┤
│ Path               Requests       IPs        First   Last  │
│ /wp-login.php      1,240          82         10:12   11:58 │
│ /xmlrpc.php          820          44         10:20   11:42 │
└────────────────────────────────────────────────────────────┘
```

---

# 30. Related Row Highlight

Findingから遷移：

```text
Scroll
↓
Tab switch
↓
Filter reset if necessary
↓
Referenced Row visible
↓
Highlight
```

既存Filterで対象が隠れる場合はUserへ通知して一時解除する。

---

# 31. Path Detail Drawer

```text
                         ┌──────────────────────────────┐
                         │ /wp-login.php          [×] │
                         ├──────────────────────────────┤
                         │ Known Information            │
                         │ WordPress Login              │
                         ├──────────────────────────────┤
                         │ Requests          1,240      │
                         │ Distinct IP          82      │
                         │ First Seen        10:12      │
                         │ Last Seen         11:58      │
                         ├──────────────────────────────┤
                         │ Status Distribution          │
                         │ 200  120                     │
                         │ 404  980                     │
                         │ 403  140                     │
                         ├──────────────────────────────┤
                         │ Related Findings             │
                         │ ・Login Path Access          │
                         └──────────────────────────────┘
```

---

# 32. AI Chat Drawer

```text
                         ┌──────────────────────────────┐
                         │ この解析について質問   [×] │
                         ├──────────────────────────────┤
                         │ このAnalysisの解析結果を     │
                         │ もとに回答します             │
                         ├──────────────────────────────┤
                         │ User                         │
                         │ この404は何を確認すれば？    │
                         │                              │
                         │ Polaris                      │
                         │ ...                          │
                         │ [関連データ]                 │
                         ├──────────────────────────────┤
                         │ 質問を入力...          [送信]│
                         └──────────────────────────────┘
```

---

# 33. Chat DrawerとDetail Drawer

同時に2つ開かない。

```text
Detail Drawer
AI Chat Drawer
```

は同じRight Panel領域を共有する。

---

# 34. AI Chat Open中のResult

Main Contentは残す。

DesktopではResultを読みながらChat可能。

---

# 35. Parse Warning Detail

ModalよりInline ExpandまたはDrawerを推奨。

理由：

Analysis Contextを維持できる。

---

# 36. Known Information List Wireframe

```text
┌──────────────────────────────────────────────────────────────┐
│ Known Information                              [追加]        │
│ このProjectで既知のPathや用途をPolarisに教えます            │
├──────────────────────────────────────────────────────────────┤
│ Search                                                       │
├──────────────────────────────────────────────────────────────┤
│ Path           Match    Label              Source    Enabled │
│ /admin         prefix   Admin Area         Project   ✓       │
│ /member/login  exact    Member Login       Project   ✓       │
│ /wp-login.php  exact    WordPress Login    Built-in  ✓       │
└──────────────────────────────────────────────────────────────┘
```

---

# 37. Known Information Edit

DrawerまたはModal。

```text
Path
Match Type
Label
Description
Enabled
```

Built-inはRead Only。

---

# 38. Billing Wireframe

```text
┌──────────────────────────────────────────────────────────────┐
│ Plan & Billing                                               │
├──────────────────────────────────────────────────────────────┤
│ Current Plan                                                 │
│ FREE                                                         │
│                                              [ProへUpgrade]  │
├──────────────────────────────────────────────────────────────┤
│ 今月の利用状況                                               │
│ Analyses        3 / X                                        │
│ Projects        1 / X                                        │
│ AI Chat         Pro                                          │
├──────────────────────────────────────────────────────────────┤
│ Free                          Pro                            │
│ AI Summary ✓                  AI Summary ✓                   │
│ Findings ✓                    Findings ✓                     │
│ AI Chat —                     AI Chat ✓                      │
│ Export —                      Export ✓                       │
└──────────────────────────────────────────────────────────────┘
```

重要Findingの閲覧差は作らない。

---

# 39. Account Settings

MVPでは簡潔。

```text
Email
Account Status
Logout
Delete Account
```

不要なProfile項目を増やさない。

---

# 40. Responsive Breakpoint方針

厳密値はVisual Design時に決めるが、概念：

```text
Desktop
≥ 1200

Tablet
768–1199

Mobile
< 768
```

---

# 41. Tablet

SidebarをCollapse可能にする。

Right DrawerはOverlay。

Aggregation Tableは横Scrollを許可。

---

# 42. Mobile Result Wireframe

```text
┌─────────────────────────────┐
│ ← Analysis                  │
│ 2026-08-28                  │
├─────────────────────────────┤
│ ⚠ 250行を解析できません    │
├─────────────────────────────┤
│ HIGH                        │
│ 早めの確認をおすすめします │
├─────────────────────────────┤
│ 今回の解析概要              │
│ ...                         │
├─────────────────────────────┤
│ 今確認したいこと            │
│                             │
│ Finding 1                   │
│ ...                         │
├─────────────────────────────┤
│ 次に確認すること            │
├─────────────────────────────┤
│ この解析で分からないこと    │
├─────────────────────────────┤
│ 詳細データ                  │
│ [Path] [IP] [Status] ...    │
└─────────────────────────────┘
```

---

# 43. Mobile Aggregation

Tableをそのまま縮小しない。

候補：

```text
Path
/wp-login.php
1,240 requests · 82 IPs
404 / 403 / 200
>
```

TapでFull Screen Detail。

---

# 44. Mobile AI Chat

Right DrawerではなくFull Screen Panel。

ResultへBackで戻る。

---

# 45. Mobile Primary CTA

Project Overviewでは、

```text
Access Logを解析する
```

を画面上部に維持。

Floating Buttonは必須ではない。

---

# 46. Loading Skeleton

Project List：

```text
Card Skeleton
```

Result：

```text
Header
Summary
Finding
```

の構造を保つSkeleton。

---

# 47. Result AI Loading

Analyzer Result表示後：

```text
AIによる説明を生成しています
```

PlaceholderをSummary / Finding領域に表示。

Aggregationは利用可能。

---

# 48. Result AI Failure

同じ位置に：

```text
AIによる説明を生成できませんでした
[再試行]
```

Aggregationはその下に通常表示。

---

# 49. Fatal Analyzer Failure

Result Layoutへ無理に入れない。

Dedicated Error State：

```text
ログを解析できませんでした
理由
次Action
再アップロード
```

---

# 50. Navigation State

Analysis Result閲覧中：

```text
Sidebar
Analyses = Active
```

BreadcrumbでProject Contextを維持。

---

# 51. Project Switch

Analysis編集中 / Upload中にProject Switchした場合の確認は、未保存状態がある場合のみ必要。

Result閲覧中は即Switch可能。

---

# 52. URLとUI State

URL：

```text
/projects/:projectId/analyses/:analysisId
```

Aggregation TabはQuery Param候補：

```text
?view=path
```

Finding Reference遷移時のDeep Linkにも使える。

---

# 53. Drawer URL State

MVPではDrawer状態をURLへ保存しなくてもよい。

Aggregation Viewは保存価値が高い。

---

# 54. Width Priority

狭くなった場合：

```text
Sidebar
↓
Collapse

Main Content
↓
維持

Right Drawer
↓
Overlay
```

Main Contentの可読幅を最優先。

---

# 55. Result Screen Alternative A
## Linear Report

```text
Urgency
Summary
Finding
Finding
Limitation
Aggregation
```

長所：

```text
理解しやすい
Mobile対応しやすい
```

短所：

```text
大量Findingで縦長
```

---

# 56. Result Screen Alternative B
## Summary + Finding + Detail

```text
Summary
↓
Finding
↓
Evidence
```

長所：

```text
判断順が明確
根拠へ辿れる
Polaris思想と一致
```

短所：

```text
Drill-down Interaction設計が必要
```

---

# 57. Result Screen Alternative C
## Split Pane

```text
Findings | Aggregation
```

長所：

```text
Evidence比較が速い
```

短所：

```text
初見ユーザーには複雑
Mobileに弱い
情報密度が高すぎる
```

---

# 58. 採用案

MVP：

```text
Alternative B
Summary + Finding + Detail
```

を採用する。

理由：

Polarisの、

```text
Analyzer = Fact
AI = Explanation
User = Decision
```

を画面構造そのものとして表現しやすい。

---

# 59. Visual Prototype前の検証

Wireframe段階で以下を確認する。

```text
Primary CTA
First View
Finding理解
Warning視認
Evidence遷移
Drawer
Mobile
```

---

# 60. First View Acceptance

1440px想定で、

```text
Analysis Metadata
Parse Warning
Overall Urgency
Summary
```

が視認できる。

---

# 61. Finding Acceptance

Finding内で、

```text
Observation
Interpretation
Limitation
Next Check
```

を見間違えない。

---

# 62. Evidence Acceptance

Findingから2操作以内で関連Aggregationを確認できる。

例：

```text
関連データを見る
↓
対象Row
```

---

# 63. Upload Acceptance

初見ユーザーが説明なしで、

```text
File Select
↓
Analysis Start
```

できる。

---

# 64. Processing Acceptance

ユーザーが、

```text
Upload中
Analyzer中
AI中
```

を区別できる。

---

# 65. Error Acceptance

AI FailureをAnalyzer Failureと誤解しない。

---

# 66. Mobile Acceptance

Mobileでも、

```text
Urgency
Summary
Finding
Next Check
```

を問題なく読める。

---

# 67. Wireframeで固定しないもの

この段階では未固定：

```text
Final Color
Final Font
Exact Font Size
Exact Border Radius
Exact Shadow
Animation Duration
Icon Set
```

22の原則に従いVisual Design時に決める。

---

# 68. Wireframeで固定するもの

```text
Screen Hierarchy
Component Order
Primary CTA
Information Priority
Navigation
Drill-down Pattern
Drawer Pattern
Responsive Priority
Error Placement
Warning Placement
```

---

# 69. MVP確定事項

1. DesktopはSidebar + Main Contentを基本とする。
2. Sidebarは220–260px程度を目安とする。
3. Analysis ResultはSummary + Finding + Detail型を採用する。
4. Result First ViewにMetadata / Parse Warning / Urgency / Summaryを置く。
5. FindingsをAggregationより前に置く。
6. Findingから関連Aggregationへ直接遷移可能にする。
7. AggregationはResult内に統合する。
8. AggregationはTab + Tableを基本とする。
9. Row DetailはRight Drawerを基本とする。
10. AI Chatも同じRight Drawer領域を利用する。
11. Detail DrawerとAI Chat Drawerを同時表示しない。
12. Uploadは単一の大きなDrop Areaを中心にする。
13. Upload ProgressとAnalyzer Progressを分離する。
14. Analyzer完了後はAI処理中でもAggregationを閲覧可能にする。
15. Parse WarningはResult上部に置く。
16. Billingで重要解析結果をPaywallしない。
17. MobileはSingle Columnとする。
18. Mobile AggregationはSummary Row + Detail方式を許可する。
19. Visual PolishよりInformation Priorityを優先する。
20. Backlog化前のScreen Layout基準として本書を使用する。

---


# 70. Responsive Design Policy
## レスポンシブ対応方針

PolarisはDesktopでの利用をPrimary Use Caseとする。

Access Log解析では、

```text
Finding
Aggregation Table
Path
Source IP
Time Series
AI Explanation
```

など、一定以上の表示領域を必要とするためである。

ただしWeb Applicationとして提供する以上、

> **スマートフォンで積極的に操作することは想定しなくても、画面が破綻しないResponsive Designは必須**

とする。

---

# 71. Responsiveの目的

Responsive対応の目的は、

```text
Desktop UIをそのまま縮小する
```

ことではない。

Viewportに応じて、

```text
情報の優先順位
Navigation
Layout
Table
Drawer
Action
```

を再構成する。

---

# 72. Device Priority

```text
Desktop
Primary

Tablet
Supported

Smartphone
Limited but Supported
```

SmartphoneをPrimary Operation Environmentにはしない。

---

# 73. Desktop

目安：

```text
≥ 1200px
```

基本Layout：

```text
Sidebar
+
Main Content
+
Optional Right Drawer
```

PolarisのFull Function UI。

---

# 74. Tablet

目安：

```text
768px–1199px
```

変更：

```text
Sidebar
→ Collapsible / Overlay

Main Content
→ Full Width寄り

Right Drawer
→ Overlay

Aggregation
→ Horizontal Scroll許可
```

機能自体は原則維持する。

---

# 75. Smartphone

目安：

```text
< 768px
```

基本Layout：

```text
Single Column
```

Sidebarは使用せず、

```text
Header Menu
または
Drawer Navigation
```

へ変更する。

---

# 76. Smartphoneで優先する機能

優先：

```text
Analysis Result閲覧
Overall Urgency
AI Summary
Findings
Next Check
Parse Warning
Data Limitation
```

つまり、

> **外出先等で解析結果を確認できる**

レベルは維持する。

---

# 77. Smartphoneで優先度を下げる機能

```text
大量Aggregation比較
複雑なFiltering
Known Information大量編集
Billing詳細操作
大量Project管理
```

これらはDesktop利用を推奨してよい。

ただしViewportが狭いことを理由に、重要情報そのものを非表示にしない。

---

# 78. Smartphone Analysis Result

情報順はDesktopと同じ：

```text
Parse Warning
↓
Overall Urgency
↓
AI Summary
↓
Findings
↓
Next Check
↓
Data Limitation
↓
Aggregation
```

LayoutだけSingle Columnへ変更する。

---

# 79. Smartphone Finding

Finding Cardは縦積み。

```text
Title

確認できたこと
↓

考えられること
↓

このログだけでは分からないこと
↓

次に確認すること
↓

関連データ
```

Desktopと意味構造を変えない。

---

# 80. Smartphone Aggregation

Desktop Tableを単純縮小しない。

推奨：

```text
Summary Row / Card
↓
Tap
↓
Detail View
```

例：

```text
/wp-login.php

1,240 requests
82 IPs
404 / 403 / 200

[詳細を見る]
```

---

# 81. Horizontal Scroll

複雑なTableについてはHorizontal Scrollも許可する。

ただし、

```text
重要Column
```

を左側へ置く。

可能であればSticky First Columnを検討する。

---

# 82. Smartphone Detail

Desktop Right Drawer：

```text
Right Drawer
```

Smartphone：

```text
Full Screen Detail
または
Bottom Sheet
```

へ変更する。

---

# 83. Smartphone AI Chat

Desktop：

```text
Right Drawer
```

Smartphone：

```text
Full Screen Chat
```

とする。

Resultへ戻るNavigationを明確にする。

---

# 84. Smartphone Upload

Upload自体は禁止しない。

```text
File Select
Analyze
```

は利用可能にする。

ただし巨大Access LogのUploadはMobile Networkとの相性が悪いため、

```text
大きなログファイルの解析はPC環境を推奨します
```

等の補助表示を検討する。

---

# 85. Touch Target

Smartphone / Tabletでは、

```text
Button
Tab
Menu
Close
Row Action
```

のTouch Areaを十分に確保する。

Desktop用の小さなIcon Buttonをそのまま流用しない。

---

# 86. Hover Dependency

Web Applicationとして、

```text
Hoverしないと意味が分からない
Hoverしないと操作できない
```

UIを作らない。

Hoverは補助表現のみとする。

---

# 87. Responsive Typography

画面幅に応じてTitle等を調整する。

ただし本文を極端に小さくしてDesktop Layoutを維持しない。

---

# 88. Responsive Spacing

Desktop：

```text
24–32px
```

程度のMain Padding。

Smartphone：

```text
16px前後
```

を基準候補とする。

Exact ValueはVisual Design Systemで確定する。

---

# 89. Responsive Navigation

Desktop：

```text
Persistent Sidebar
```

Tablet：

```text
Collapsible Sidebar
```

Smartphone：

```text
Header
+
Navigation Drawer
```

---

# 90. Responsive Priority Rule

画面が狭くなった場合、

```text
情報を削除
```

する前に、

```text
横並びを縦並びへ変更
Secondary MetadataをCollapse
TableをSummary Viewへ変更
DrawerをFull Screenへ変更
```

を優先する。

---

# 91. Responsiveで非表示可能な情報

Primary情報は非表示にしない。

Collapse可能：

```text
File Name
Secondary Metadata
Detailed Distribution
Supplementary Description
```

常時確認可能にする：

```text
Parse Warning
Urgency
Summary
Findings
Limitation
Next Check
```

---

# 92. Breakpointの考え方

BreakpointはDevice Nameだけで決めず、

```text
Layoutが成立しなくなる幅
```

を基準に調整する。

したがって、

```text
1200 / 768
```

は初期目安であり、Visual Prototypeで最終調整する。

---

# 93. Responsive Acceptance Criteria

最低限：

```text
320px程度でもHorizontal Page Overflowで画面全体が破綻しない

Primary Navigationへアクセスできる

Analysis Resultの主要情報を読める

Findingの意味構造が維持される

Parse Warningを確認できる

Tableまたは代替Summary Viewへアクセスできる

Modal / Drawerから戻れる

Touch操作可能

Hoverなしで操作可能
```

---

# 94. Responsive Testing

最低限確認するViewport候補：

```text
1440px
1280px
1024px
768px
390px
375px
320px
```

Browser DevToolsだけでなく、可能であれば実機確認も行う。

---

# 95. Responsiveに関するMVP方針

最終方針：

> **PolarisはDesktop Firstだが、Desktop Onlyにはしない。**

Smartphoneで高度なログ調査を行うことはPrimary Use Caseではない。

一方で、

```text
解析結果を確認する
Findingを読む
Urgencyを確認する
Next Checkを確認する
```

という主要な閲覧体験はSmartphoneでも成立させる。

これをMVPのResponsive Design基準とする。

---

# 96. 次の設計対象

次は、

```text
24_Visual_Design_System
```

を作成する。

Responsive DesignについてもVisual System側で、

```text
Breakpoint
Typography Scale
Spacing Scale
Table Density
Touch Target
Navigation
Drawer / Modal
```

まで具体化する。

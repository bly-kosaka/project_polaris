# Project Polaris
# 24_Visual_Design_System
## ビジュアルデザインシステム

---

# 1. 目的

本書では、Project PolarisのVisual Design Systemを定義する。

21〜23で定義した、

```text
Screen Architecture
UI Interaction
Wireframe
Responsive Policy
```

を、実際のUIとして一貫した見た目へ落とし込むための基準とする。

本書の目的は「格好いい画面を作ること」ではない。

> **情報の意味・優先順位・信頼性が、見た目からも正しく伝わること**

を最優先する。

---

# 2. Design Principles

PolarisのVisual Designは以下を優先する。

```text
1. Clarity
2. Trust
3. Information Hierarchy
4. Readability
5. Consistency
6. Brand Identity
7. Decoration
```

Brandや装飾は、可読性より上位に置かない。

---

# 3. Product Character

Polarisの印象：

```text
Professional
Calm
Technical
Reliable
Focused
Modern
```

避ける印象：

```text
Cyber Security Game
Hacker UI
SOC Monitoring Console
Sci-Fi Dashboard
Excessively Futuristic
Alarm-heavy Security Tool
```

---

# 4. Brand Concept

既存方針：

```text
Polaris
北極星
星座
望遠鏡
```

意味：

```text
大量の情報の中から
見るべき方向を示す
```

Brand ConceptはProduct Functionと一致する。

---

# 5. Brand Motifの使い方

使用：

```text
Logo
Login
Empty State
Loading
Background Detail
Section Accent
Illustration
```

抑制：

```text
Analysis Result
Aggregation Table
Finding Card
Warning
Error
```

判断に関係する領域ではDecorationを弱くする。

---

# 6. Color Foundation

既存Base：

```text
#101936
```

Accent：

```text
#7DE2FC
```

これをBrand Foundationとする。

---

# 7. Color Architecture

Exact Color TokenはVisual Prototypeで微調整するが、構造は以下。

```text
Background
Surface 1
Surface 2
Surface 3

Text Primary
Text Secondary
Text Muted

Border Default
Border Strong

Accent Primary
Accent Hover

Success
Warning
Error
Info
```

---

# 8. Background

Base Background：

```text
#101936
```

を基準。

ただし全Surfaceを同じ濃紺にしない。

---

# 9. Surface Layer

Dark UIでHierarchyを作るため、

```text
Background
↓
Surface 1
↓
Surface 2
↓
Raised / Interactive
```

の差を持たせる。

Shadowだけに依存しない。

---

# 10. Accent

`#7DE2FC`は、

```text
Primary CTA
Active Navigation
Link
Focus
Selected Tab
Brand Accent
```

に使用。

大量のTextをAccent Colorにしない。

---

# 11. Semantic Color

Semantic Color：

```text
Success
Warning
Error
Info
```

をBrand Accentと分離する。

---

# 12. Urgency Color

Overall Urgency：

```text
Immediate
High
Normal
Low
```

へ色を使用してよい。

ただし、

```text
Color
+
Label
+
Icon
+
Description
```

を必須とする。

---

# 13. UrgencyとErrorの違い

`Immediate`とSystem Errorを同じ表現にしない。

例：

```text
Immediate
= User Review Urgency

Error
= Application / Processing Failure
```

Semantic MeaningをVisualでも分離する。

---

# 14. Avoid Red Dominance

Security Toolにありがちな、

```text
赤
赤
赤
```

の画面にしない。

赤は本当に必要なError / Immediate等へ限定する。

---

# 15. Typography

Typography Role：

```text
Display
Page Title
Section Title
Card Title
Body
Label
Metadata
Code
```

---

# 16. Font Direction

日本語UIで読みやすいSans SerifをPrimary。

候補方向：

```text
Noto Sans JP
system-ui
sans-serif
```

実装時はWeb Font Costも考慮する。

---

# 17. Monospace

以下はMonospaceを検討：

```text
Path
Source IP
User-Agent
HTTP Method
Status
Log Sample
Technical Identifier
```

ただし長文説明はSans Serif。

---

# 18. Typography Scale

初期候補：

```text
Page Title       24–28
Section Title    18–20
Card Title       16–18
Body             14–16
Metadata         12–14
Code             13–14
```

巨大なHero TypographyはApplication内部では使用しない。

---

# 19. Line Height

本文：

```text
1.6前後
```

Technical Table：

```text
1.4–1.5
```

を目安。

---

# 20. Font Weight

多用しない。

基本：

```text
Regular
Medium
Semi Bold
```

程度。

Boldだらけにしない。

---

# 21. Spacing System

4pxまたは8px系Scaleを使用する。

候補：

```text
4
8
12
16
24
32
40
48
64
```

---

# 22. Main Layout Spacing

Desktop Main Padding：

```text
24–32px
```

Tablet：

```text
20–24px
```

Smartphone：

```text
16px
```

を初期基準とする。

---

# 23. Section Spacing

Section間：

```text
32–48px
```

Finding内部：

```text
16–24px
```

Table内部はよりCompact。

---

# 24. Radius

過度なRounded UIを避ける。

候補：

```text
Small 4–6px
Medium 8px
Large 12px
```

Application全体を丸いCardだらけにしない。

---

# 25. Border

Dark UIではBorderを重要なStructureとして使う。

```text
1px Subtle Border
```

を基本。

Selected / Focus時のみStrong。

---

# 26. Shadow

Shadowは控えめ。

使用：

```text
Drawer
Modal
Floating Element
```

通常PanelではBorder中心。

---

# 27. App Shell

Desktop：

```text
Header
Sidebar
Main
```

SidebarとMainはBackground差 + Borderで分離。

---

# 28. Sidebar Visual

Active：

```text
Accent Marker
+
Text Emphasis
```

を使用。

Background全面を強いAccentにしない。

---

# 29. Page Header

Page Titleを明確にするが、巨大化しない。

Primary CTAは右側。

SmartphoneではTitle下へ移動可能。

---

# 30. Button System

種類：

```text
Primary
Secondary
Tertiary
Danger
Icon
```

---

# 31. Primary Button

用途：

```text
Access Logを解析する
解析を開始
Upgrade
```

1画面1Primary Actionを基本。

---

# 32. Secondary Button

用途：

```text
関連データを見る
AIに質問
管理する
```

---

# 33. Tertiary Button

用途：

```text
詳細
Cancel
Close
```

---

# 34. Danger Button

用途：

```text
Delete Analysis
Delete Project
Delete Account
```

通常Actionから距離を取る。

---

# 35. Button State

必須：

```text
Default
Hover
Focus
Active
Disabled
Loading
```

Hoverのみで状態を表さない。

---

# 36. Focus

Keyboard Focusは明確に表示。

Accent Colorを使ったFocus Ringを候補とする。

---

# 37. Status Badge

用途：

```text
Analyzer Status
AI Status
Subscription Status
```

Compact。

---

# 38. Status BadgeとUrgency Badge

別Componentとする。

Status：

```text
Processing State
```

Urgency：

```text
Human Review Timing
```

意味が違う。

---

# 39. Overall Urgency

巨大Cardではなく、Result Summary Areaの重要Labelとして扱う。

構成：

```text
Urgency Label
Short Meaning
Reason
```

---

# 40. Parse Warning

Warning Banner：

```text
Icon
Title
Short Detail
Action
```

背景色だけに依存しない。

---

# 41. Warning Hierarchy

例：

```text
Info
Warning
Critical Processing Notice
```

ただしAnalyzerのSeverityとして使わない。

これはUI Messageの種類。

---

# 42. AI Summary Panel

Visual Priorityは高い。

ただしAccent Border程度で、

```text
AIだから光る
```

等の演出はしない。

---

# 43. AI Label

必要なら、

```text
AIによる説明
```

と明示。

Analyzer FactとAI Interpretationを混同させない。

---

# 44. Finding Card

Finding CardはPolarisのSignature Componentとする。

構造：

```text
Title

Observation
Interpretation
Limitation
Next Check

References
```

---

# 45. Finding Visual Hierarchy

Observation：

```text
最もNeutral
```

Interpretation：

```text
AI Label
```

Limitation：

```text
Muted Warning
```

Next Check：

```text
Action-oriented
```

---

# 46. Findingを色分けしすぎない

4領域を、

```text
青
黄
赤
緑
```

のように完全色分けしない。

Label、Spacing、Border、IconでHierarchyを作る。

---

# 47. Observation Label

UI日本語：

```text
確認できたこと
```

Secondary Technical Label：

```text
Observation
```

はTooltip / small label等で併記可能。

---

# 48. Interpretation Label

```text
考えられること
```

AIの推測であることを視覚的に分かるようにする。

---

# 49. Limitation Label

```text
このログだけでは分からないこと
```

省略しない。

---

# 50. Next Check Label

```text
次に確認すること
```

最もActionable。

---

# 51. Reference UI

Finding下部：

```text
関連データ
Path 2
Source IP 3
```

等のChip / Link。

---

# 52. Data Table

Polarisでは重要Component。

Design優先：

```text
Readability
Scanability
Density
Sortability
```

---

# 53. Table Header

Sticky。

Header BackgroundをBodyと分離。

Sort可能Columnには明示Indicator。

---

# 54. Table Row

Hover：

```text
Subtle Highlight
```

Selected：

```text
Accent Border / Background
```

Finding Reference：

```text
Temporary Reference Highlight
```

を区別する。

---

# 55. Zebra Stripe

Dark UIで必要性をPrototype確認。

Border + Hoverで十分なら使用しない。

---

# 56. Numeric Alignment

```text
Requests
Count
Rate
Size
```

等は右揃えを基本。

---

# 57. Technical Text

Path / IP等は左揃え。

長いPath / UA：

```text
Ellipsis
+
Tooltip / Detail
```

---

# 58. Table Density

Desktop：

```text
Row Height 40–48px程度
```

を初期候補。

Touch Deviceでは広げる。

---

# 59. Table Empty State

```text
該当するデータがありません
```

Filter適用時：

```text
条件に一致するデータがありません
[Filterを解除]
```

を区別。

---

# 60. Tabs

Aggregation Tabs：

```text
Path
Source IP
Status
Method
User-Agent
Time
```

Active TabをAccent + Borderで明確にする。

---

# 61. Filter Bar

構成：

```text
Search
Select Filter
Filter Chip
Clear
```

TableよりVisual Priorityを上げすぎない。

---

# 62. Chip

用途：

```text
Filter
Reference
Known Information
```

Semanticを混ぜない。

---

# 63. Drawer

Desktop：

```text
Right Side
35–45%
```

SurfaceをMainより一段上げる。

---

# 64. Drawer Header

Sticky：

```text
Title
Context
Close
```

---

# 65. Drawer Footer

Actionが必要な場合のみSticky。

単なるDetail閲覧では不要。

---

# 66. Modal

使用：

```text
Confirmation
Short Form
Critical Decision
```

長いDetail閲覧に使わない。

---

# 67. Empty State

Brand Motifを比較的使いやすい場所。

構成：

```text
Small Illustration
Title
Description
Primary CTA
```

---

# 68. Loading

Polarisらしい星座Motifを軽く使ってよい。

ただし、

```text
何を処理しているか
```

をTextで明示する。

---

# 69. Processing Step

```text
Complete
Current
Pending
Failed
```

をIcon + Textで表現。

---

# 70. Error State

Error Colorは使用するが、画面全体を赤くしない。

構成：

```text
Error Title
Explanation
Preserved State
Next Action
```

---

# 71. AI Failure

AI FailureではErrorよりも、

```text
Analyzer Resultは利用可能
```

を強く伝える。

---

# 72. Code / Path Display

Path：

```text
/wp-login.php
```

IP：

```text
203.0.113.10
```

はTechnical Tokenとして視認しやすくする。

背景付きInline Codeは必要な場所のみ。

---

# 73. Icon System

Icon Setは1種類に統一。

用途：

```text
Navigation
Status
Warning
Action
Expand
Sort
```

装飾Iconを増やしすぎない。

---

# 74. Icon Size

基本：

```text
16
20
24
```

程度のScale。

---

# 75. Responsive Visual System

Polarisは、

> **Desktop First / Responsive Required**

とする。

Smartphoneを主要作業環境にはしないが、Web Applicationとして表示・主要閲覧機能を破綻させない。

---

# 76. Breakpoint候補

初期：

```text
Desktop Large   ≥ 1440
Desktop         1200–1439
Tablet          768–1199
Mobile          < 768
```

最終値はLayoutが破綻する幅で調整する。

---

# 77. Desktop

```text
Persistent Sidebar
Main Content
Optional Right Drawer
Dense Table
```

Full Function。

---

# 78. Tablet

```text
Collapsible Sidebar
Main Content
Overlay Drawer
Scrollable Table
```

---

# 79. Mobile

```text
Header Navigation
Single Column
Full Screen Detail
Full Screen Chat
Summary Aggregation
```

---

# 80. Responsive Typography

Page Title等を段階的に縮小。

本文を小さくしすぎない。

---

# 81. Responsive Spacing

Desktop：

```text
24–32
```

Tablet：

```text
20–24
```

Mobile：

```text
16
```

---

# 82. Responsive Finding

Findingの意味構造を維持したままSingle Column。

省略しない：

```text
Observation
Interpretation
Limitation
Next Check
```

---

# 83. Responsive Table

優先順位：

```text
1. Summary Rowへ変換
2. Detail View
3. Horizontal Scroll
```

単純縮小はしない。

---

# 84. Touch Target

Touch Device：

```text
44px前後以上
```

を目安。

Iconだけの小さい操作領域を避ける。

---

# 85. Hover

HoverはDesktop Enhancement。

操作の成立条件にしない。

---

# 86. Responsive Drawer

Desktop：

```text
Right Drawer
```

Tablet：

```text
Overlay Drawer
```

Mobile：

```text
Full Screen
```

---

# 87. Responsive CTA

Desktop：

```text
Page Header Right
```

Mobile：

```text
Title下
または
Content内Full Width
```

---

# 88. Accessibility Color Contrast

WCAG AA相当を基本目標。

特にDark UIで、

```text
Muted Text
Border
Disabled
Warning
```

のContrast不足に注意。

---

# 89. Color Blindness

Urgency / StatusをColorのみで区別しない。

---

# 90. Reduced Motion

OSの、

```text
prefers-reduced-motion
```

を尊重する。

---

# 91. Responsive Testing Matrix

最低限：

```text
1440
1280
1024
768
390
375
320
```

で確認。

---

# 92. Component Token Concept

将来的にCSS Variables等で、

```text
--color-bg
--color-surface-1
--color-surface-2
--color-text
--color-muted
--color-border
--color-accent

--space-1
--space-2
...

--radius-sm
--radius-md
--radius-lg
```

として管理する。

---

# 93. CSS Architecture

Component内で色・Spacingを直接乱立させない。

Design Tokenを経由する。

---

# 94. Dark Theme First

MVPはPolaris Brandに合わせ、

```text
Dark Theme
```

をPrimary Themeとする方向。

Light ThemeはMVP必須としない。

---

# 95. Dark Theme検証

特に確認：

```text
長文AI Explanation
Table
Code
Warning
Disabled
Focus
Scroll
```

Dark Themeは長時間利用で読みやすいとは限らないため、実UIで検証する。

---

# 96. Light Surfaceの利用

Dark Theme内でも必要なら、

```text
High Readability Surface
```

を限定的に使うことは可能。

Brand Consistencyより読みやすさを優先する。

---

# 97. Marketing Siteとの違い

Application UI：

```text
Dense
Functional
Calm
```

Marketing：

```text
Brand
Illustration
Story
```

同じVisual Densityにしない。

---

# 98. Visual QA

各画面で確認：

```text
何がPrimaryか分かる
CTAが1秒で見つかる
Warningを見落とさない
AIとFactが区別できる
Tableが読みやすい
Colorの意味が一貫
Spacingが一貫
Responsiveで崩れない
```

---

# 99. Analysis Result Visual QA

特に：

```text
Urgencyが煽りすぎていない
Summaryが長すぎない
FindingがCardの海になっていない
ObservationとInterpretationを見間違えない
Limitationが弱すぎない
Next Checkが見つかる
Evidenceへ自然に進める
```

---

# 100. Prototype Requirement

実装前に最低限、

```text
Project List
Project Overview
Upload
Processing
Analysis Result
Known Information
Billing
```

のVisual Prototypeを作る。

Analysis ResultはDesktop / Mobile双方を確認。

---

# 101. MVP Visual Design Definition of Done

以下を満たす：

```text
Design Tokenが定義されている

Primary / Secondary / Danger Buttonが統一されている

StatusとUrgencyが別Componentになっている

Finding Cardの意味構造がVisualでも明確

Parse Warningが見落とされない

Aggregation Tableが読みやすい

Dark UIで十分なContrastがある

Desktop / Tablet / Mobileで破綻しない

Hoverなしでも操作できる

Keyboard Focusが見える

Brand Motifが機能理解を邪魔しない
```

---

# 102. MVP確定事項

1. Dark ThemeをPrimary候補とする。
2. Base `#101936`、Accent `#7DE2FC`をBrand Foundationとする。
3. Brandより可読性を優先する。
4. Cyber / Hacker / SOC風UIにはしない。
5. Overall Urgencyを巨大Score化しない。
6. ErrorとUrgencyのVisual Meaningを分ける。
7. Finding CardをPolarisのSignature Componentとする。
8. Observation / Interpretation / Limitation / Next Checkを色だけに頼らず分離する。
9. Aggregation Tableは高い情報密度と可読性を両立する。
10. Border中心のSurface Hierarchyとする。
11. ShadowはDrawer / Modal等へ限定する。
12. Application内部で巨大Typographyを使わない。
13. Path / IP等にMonospaceを検討する。
14. 4px / 8px系Spacing Scaleを使用する。
15. Responsive Requiredとする。
16. Desktop FirstだがDesktop Onlyにはしない。
17. Smartphoneで主要解析結果を閲覧可能にする。
18. Touch / Hover / Keyboardを考慮する。
19. WCAG AA相当のContrastを基本目標とする。
20. Visual Prototypeを作成してから実装Backlogを確定する。

---

# 103. 次の設計対象

次は、

```text
25_MVP_Backlog_and_Acceptance_Criteria
```

へ進む。

00〜24で、

```text
Product
Architecture
Analyzer
AI
Data
Lifecycle
Security
Plan
Auth / Billing
System
Technology
Implementation
Screen
Interaction
Wireframe
Visual Design
```

まで定義した。

25ではこれらを、

```text
Epic
User Story
Task
Acceptance Criteria
Dependency
Priority
Milestone
```

へ変換し、実際の開発単位へ落とし込む。

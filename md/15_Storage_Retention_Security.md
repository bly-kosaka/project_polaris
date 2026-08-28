# Project Polaris
# 15_Storage_Retention_Security
## ストレージ・保持期間・セキュリティ設計

---

# 1. 目的

本書では、Project Polarisで扱う解析データについて、

```text
どこへ保存するか
どれくらい保持するか
何を削除するか
何をAI Providerへ送るか
どの情報をSensitive Dataとして扱うか
```

を定義する。

対象はMVPのAccess Log解析である。

本章では、

- Raw Access Log
- ObservationSet
- AIExplanationResult
- Project / Analysis Metadata
- Known Information
- Backup
- Delete
- Encryption
- Redaction
- AI Provider送信
- Security Logging

を扱う。

---

# 2. 基本原則

Project PolarisはLog Archiveサービスではない。

そのためMVPでは、

> **Raw Access Logは一時的にのみ保持し、解析完了後に削除する。**

永続的に保持するのは、解析後の構造化結果を基本とする。

```text
Raw Access Log
= Temporary

ObservationSet
= Persistent

AIExplanationResult
= Persistent

Analysis Metadata
= Persistent
```

---

# 3. Data Classification

## 3.1 High Sensitivity

```text
Raw Access Log
```

含まれる可能性があるもの：

- IP Address
- Query Parameter
- URL
- Referer
- User-Agent
- Email Address
- Session ID
- Access Token
- API Key
- Tracking ID
- Internal Path

---

## 3.2 Medium Sensitivity

```text
ObservationSet
```

含まれる可能性があるもの：

- IP Address
- Path
- User-Agent
- Redacted Query
- Aggregation Count
- Known Information
- Time Range
- Referrer Sample

Raw Logよりは情報量が減っているが、機密性がないわけではない。

---

## 3.3 Application Data

```text
Project Metadata
Analysis Metadata
AIExecution Status
Configuration Version
Prompt Version
```

---

# 4. Raw Access Log Storage

## 4.1 Storage Type

Raw Access LogはDBへ保存しない。

Object StorageまたはTemporary File Storageへ保存する。

例：

```text
S3互換Object Storage
Railway Volume等のTemporary Storage
Cloud Storage
```

実装Hostingは別章で決定する。

---

## 4.2 Raw Log Retention

MVPでは、

```text
Analyzer完了後に即時削除
```

を基本とする。

ただし、

- Analyzer実行中
- ObservationSet Persist Retry中
- Infrastructure Retry中

は一時的に保持する必要がある。

---

## 4.3 Maximum Temporary Retention

異常終了時にRaw Logが残り続けないよう、

```text
expiresAt
```

を必ず持たせる。

MVPの初期候補として、

```text
Uploadから最大24時間
```

を上限とする。

通常はAnalyzer完了後すぐ削除されるため、24時間はFailure時のSafety Netである。

この値はHosting / Job構成確定後に短縮可能。

---

# 5. Raw Log Delete Flow

```text
ObservationSet Persist Success
↓
Raw Log Delete Request
↓
Success
```

Delete失敗時：

```text
rawLogDeletionStatus = failed
↓
Retry
↓
Cleanup Job
```

最大Retentionを超えたRaw LogはCleanup Jobで削除する。

---

# 6. Raw Logを残さない理由

## Security

Sensitive Dataを保持する期間を最小化する。

## Cost

巨大なAccess Logを履歴ごとに保存しない。

## Product Scope

PolarisはLog保管サービスではない。

## AI Architecture

AIはObservationSetを利用するためRaw Logを必要としない。

---

# 7. Raw Log Download

MVPでは、

```text
PolarisへUploadしたRaw Logを再Download
```

する機能を提供しない。

PolarisをStorage代替として使わせない。

---

# 8. ObservationSet Retention

ObservationSetはAnalysis履歴の主要データとして保存する。

MVPでは、

```text
Analysisが存在する限り保持
```

を基本とする。

ユーザーがAnalysisを削除した場合はObservationSetも削除する。

---

# 9. ObservationSet Immutability

ObservationSetは生成後に原則変更しない。

理由：

- AI Explanationとの整合
- Known Information Snapshotとの整合
- Reportとの整合
- 再現性

Analyzerを更新して過去Analysisを書き換えない。

---

# 10. AIExplanationResult Retention

AIExplanationResultもAnalysisに紐づけて保存する。

MVPでは、

```text
Analysisが存在する限り保持
```

を基本とする。

Analysis削除時に同時削除する。

---

# 11. AI Explanation Version

最低限次を保持する。

```text
provider
model
promptVersion
createdAt
```

これにより、後からAI結果の生成条件を確認できる。

---

# 12. Analysis Metadata Retention

Analysis Metadataは履歴一覧表示に必要なため保持する。

例：

```text
File Name
File Size
Log Period
Request Count
Analyzer Status
AI Status
Created At
Warning有無
```

Raw Log本文は含めない。

---

# 13. IP Address

Access Log内のIP Addressは個人関連情報として慎重に扱う。

MVPではAnalyzer集計に必要なためObservationSetへ保持可能とする。

ただし、

```text
Source IP全件を無制限に保存
```

するのではなくSelection / Sample Limitを適用する。

---

# 14. IP Hashingを初期採用しない理由

IPをHash化すると、

- 同一IP追跡
- Userへの説明
- WAF / CDN Logとの照合
- Block検討

がしにくくなる。

Polarisの一次切り分け価値を損なうため、MVPではSelected IPをそのままObservationSetへ保持する。

ただしRetention / Privacy Policy上の説明が必要。

---

# 15. Query Parameter Redaction

AIへ渡す前だけでなく、

> **ObservationSetへSensitive Valueを保存しない**

ことを基本とする。

初期Redaction対象例：

```text
password
passwd
pwd
token
access_token
api_key
apikey
secret
session
session_id
email
phone
```

---

# 16. Redaction Timing

```text
Raw Log
↓
Parse
↓
Aggregation
↓
Sample生成
↓
Redaction
↓
ObservationSet
```

Raw Log自体にはOriginal Valueが存在する可能性がある。

ObservationSet生成時にはRedacted Valueのみ残す。

---

# 17. Redaction Failure

安全にRedactionできない場合、

```text
生値をそのまま保存する
```

Fallbackは禁止する。

選択肢：

```text
Sampleを破棄
または
Analysis Failed
```

Securityを優先する。

---

# 18. Referrer Redaction

Referrer URLのQuery Stringにも同じRedactionを適用する。

例：

```text
https://example.com/page?email=user@example.com
```

↓

```text
https://example.com/page?email=[REDACTED]
```

---

# 19. User-Agent

User-Agentは基本的にそのままObservationSetへSample保存可能。

ただしSample Limitを持つ。

将来、識別性の高いUAやCustom Client ID等が問題になる場合は追加Redactionを検討する。

---

# 20. Known Information Security

Project / User Known Informationには、

```text
内部管理Path
社内向け用途
案件固有名称
```

が含まれる可能性がある。

そのためProject DataとしてAccess Control対象とする。

他ユーザー / 他Projectから取得できないこと。

---

# 21. AI Providerへの送信データ

AIへ送信するのは、

```text
AIExplanationInput
```

のみ。

主な内容：

```text
ObservationSet
Analyzer Status
Analyzer Warning / Error Summary
Prompt Purpose
```

送信しない：

```text
Raw Access Log
Raw File
Storage Key
Original Sensitive Query Value
```

---

# 22. AI Provider Data Minimization

ObservationSet自体も必要なSelected Groupのみ含む。

```text
Aggregation全件
```

をProviderへ送らない。

AI Provider送信量を、

- Token Cost
- Privacy
- Security

の3観点で最小化する。

---

# 23. AI Provider Logging

Application側でAI Request / ResponseをDebug Logへ丸ごと保存しない。

特に、

```text
ObservationSet JSON
Prompt全文
AI Response全文
```

を通常Application Logへ出さない。

必要なMonitoringはMetadata中心にする。

---

# 24. AI Monitoring Metadata

保存候補：

```text
provider
model
purpose
requestId
latency
inputTokenEstimate
outputToken
status
errorCode
createdAt
```

Observation本文をMonitoring Databaseへ複製しない。

---

# 25. Encryption in Transit

最低限、

```text
HTTPS / TLS
```

を必須とする。

対象：

- Upload
- API
- Object Storage
- AI Provider
- DB Connection

---

# 26. Encryption at Rest

DB / Object StorageはHosting ProviderのAt-Rest Encryptionを利用できる構成を優先する。

MVPで独自暗号化Layerを必須にはしない。

ただしHosting選定時にEncryption Supportを確認する。

---

# 27. Secret Management

次をSource Codeへ直接書かない。

```text
AI API Key
DB Credential
Storage Credential
Payment Secret
Session Secret
```

Environment Variable / Secret Managerを利用する。

---

# 28. Application Log

Application Logへ次を出さない。

```text
Raw Access Log Line
Raw Query String
Raw Token
Raw Email
Raw Session ID
ObservationSet全体
AI Prompt全文
```

---

# 29. Security Audit Log

必要に応じて次のEventを記録する。

```text
User Login
Project Created
Analysis Created
Log Uploaded
Analysis Deleted
Project Deleted
AI Explanation Requested
```

ただしRaw Data内容は記録しない。

---

# 30. Upload File Name

Original File NameにはClient名やSite名が含まれる可能性がある。

表示用には保持できるが、Storage Keyへそのまま利用しない。

Storage KeyはRandom ID / UUID等を利用する。

---

# 31. Storage Key

例：

```text
raw-logs/{analysisId}/{randomId}
```

Avoid：

```text
raw-logs/client-a-production-access.log
```

Storage Object Nameから案件情報が推測できないようにする。

---

# 32. MIME / Extension

UploadされたFileのMIME / Extensionを信用しすぎない。

Analyzer Parserで内容をValidationする。

Executable Fileとして実行しない。

---

# 33. Compressed Log

gzip等を将来受け付ける場合、

- Decompressed Size
- Compression Bomb
- Memory
- Temporary Storage

を考慮する必要がある。

MVPでCompressed Uploadを対応するかは別途決定する。

対応しない場合は明示的に拒否する。

---

# 34. File Size Limit

具体的なUpload Size LimitはHosting / Benchmark後に決定する。

設計上は必ずLimitを持つ。

```text
Unlimited Upload
```

にはしない。

---

# 35. ObservationSet Size Limit

Analyzer Configurationで、

```text
totalGroupLimit
sampleLimit
```

を持つ。

AI Providerへ無制限Dataを送らない。

---

# 36. Backup

## 36.1 Raw Log

Raw Access LogをBackup対象にしない。

一時Dataであり、削除後にBackupから復活してはならない。

---

## 36.2 Persistent Data

Backup対象候補：

```text
Projects
Analyses
ObservationSets
AIExplanationResults
Known Information
Account / Billing Metadata
```

---

# 37. Backup Retention

具体値はHosting設計後に決める。

ただしUserがDeleteしたDataがBackupへ永続的に残り続けないようRetentionを設ける。

---

# 38. User Analysis Delete

ユーザーがAnalysisを削除した場合：

```text
Analysis Metadata
ObservationSet
AIExplanationResult
Execution Records
残存Raw Log
```

を削除対象とする。

Project Known Informationは保持する。

---

# 39. Project Delete

Project削除では、

```text
Project
Project Known Information
Project配下Analysis
ObservationSet
AIExplanationResult
残存Raw Log
```

を削除対象とする。

MVP UIではArchiveとDeleteを分離する。

---

# 40. Account Delete

Account削除時の対象：

```text
Owned Projects
Analyses
ObservationSets
AI Results
Known Information
Usage Data
Personal Account Data
```

Billing Records等、法令 / 会計上保持が必要なものは別管理する可能性がある。

詳細はAuthentication / Billing章で定義する。

---

# 41. Delete Strategy

MVPではApplication上のDelete Request後、

```text
Active Database / Storageから削除
```

を行う。

BackupからのPhysical DeleteはBackup Retentionに従う。

Delete Requestの正確なSLAは運用設計時に決定する。

---

# 42. Soft Delete

Project ArchiveはSoft Stateとして扱う。

Analysis Deleteはユーザー意図としてHard Delete寄りに扱う。

何でもSoft DeleteしてSensitive Dataを残し続けない。

---

# 43. Data Export

MVPではRaw Log Exportは提供しない。

Report Exportは、

```text
ObservationSet
AIExplanationResult
Analysis Metadata
```

から生成する。

---

# 44. Multi-Tenant Isolation

Project / Analysis / Known InformationはTenant Boundaryを越えて参照できないようにする。

最低限：

```text
resource.ownerId
project.ownerId
analysis.projectId
```

等をAccess Controlで検証する。

Account / Organization Model確定後に詳細化する。

---

# 45. Direct Object Access

次を防ぐ。

```text
/analyses/other-user-analysis-id
```

IDが推測可能でもOwnership検証で拒否する。

UUIDだけにSecurityを依存しない。

---

# 46. Signed Upload

Object StorageへFrontendから直接Uploadする場合、短時間有効なSigned URL等を使用できる。

Public BucketへUploadさせない。

---

# 47. Public Access

Raw Log / ObservationSet / AI ResultをPublic URLで公開しない。

Report Share URL機能を将来作る場合も、独立したAccess Control設計が必要。

---

# 48. CORS / CSRF

Authentication方式確定後に詳細化する。

一般原則：

- API Originを制限
- Cookie SessionならCSRF対策
- Upload Endpointを保護
- Dangerous MethodへAuthorization必須

---

# 49. Rate Limit

最低限次をRate Limit対象にする。

```text
Analysis Create
Upload
AI Retry
Login
Report Generation
```

Analysis Cost / Abuse対策にも利用する。

---

# 50. AI Prompt Injection

Path / User-Agent / Referrer等に、

```text
Ignore previous instructions
```

のような文字列が含まれる可能性がある。

AI System PromptではObservationSet内文字列を、

```text
Data
```

として扱い、Instructionとして解釈しないようにする。

---

# 51. Known Information Injection

User / Project Known InformationのDescriptionにも任意文字列が入り得る。

これもAI PromptではDataとして扱う。

Known Information入力UIでは長さ上限を持つ。

---

# 52. Retention Summary

MVP初期方針：

| Data | Retention |
|---|---|
| Raw Access Log | Analyzer完了後即削除、Failure時最大24時間 |
| ObservationSet | Analysisが存在する限り |
| AIExplanationResult | Analysisが存在する限り |
| Analysis Metadata | Analysisが存在する限り |
| Project Known Information | Projectが存在する限り |
| Application Log | 運用方針で短期保持 |
| AI Monitoring Metadata | 運用方針で保持 |
| Raw AI Prompt | 原則保存しない |

---

# 53. Privacy Noticeに必要な内容

Product公開時には最低限、

- Access LogをUploadすること
- IP Address等を含む可能性
- Raw Logを一時保存すること
- Raw Logを解析後削除すること
- AI Explanation利用時にRedacted ObservationをAI Providerへ送信すること
- 保存される解析結果
- Delete方法

をユーザーへ説明する。

---

# 54. User Responsibility

ユーザーが第三者のAccess LogをUploadする可能性がある。

利用規約 / Privacy Policyでは、

```text
利用者が適切な権限を持つLogのみUploadする
```

ことを求める必要がある。

---

# 55. Security Testing

## Upload

- Size Limit
- Empty File
- Invalid Content
- Path Traversal
- File Name Injection

## Access Control

- Other Project Access
- Other Analysis Access
- Known Information Cross-Tenant Access

## Redaction

- Token
- Email
- Session
- Referrer Query
- Case Variation

## Storage

- Raw Log Public Access不可
- Delete後取得不可
- Expired Raw Log Cleanup

## AI

- Raw Log非送信
- Sensitive Value非送信
- Prompt Injection Data扱い

---

# 56. Incident Response

Polaris自体でSecurity Incidentが発生した場合に備え、

- Credential Rotation
- AI Key Rotation
- Storage Credential Rotation
- Session Invalidation
- Audit Log確認

を実行できる構成にする。

詳細な運用Runbookは別途作成する。

---

# 57. 不採用方針

MVPでは採用しない。

```text
Raw Access Log長期保存
Raw Log Backup
Raw Log再Download
Public Raw Log URL
Raw QueryのObservationSet保存
Raw Prompt全文の常時Logging
IP全件の無制限永続保存
AI ProviderへのRaw Log送信
```

---

# 58. MVP確定事項

1. Raw Access LogはTemporary Dataとする。
2. Raw LogはObservationSet保存後に削除する。
3. Failure時も最大Retentionを持つ。
4. 初期候補として最大24時間をSafety Netとする。
5. Raw LogはBackupしない。
6. Raw Log再Download機能を持たない。
7. ObservationSet / AI ResultはAnalysis履歴として保存する。
8. Sensitive Query ValueをObservationSetへ保存しない。
9. Selected IPはMVPではそのまま保持可能とする。
10. AIへRaw Logを送らない。
11. AIへ送るのはRedacted ObservationSetを中心とする。
12. AI Request / Prompt全文を通常Application Logへ保存しない。
13. Raw Log本文をApplication Logへ出さない。
14. DB / StorageはAt-Rest Encryption対応を優先する。
15. HTTPS / TLSを必須とする。
16. SecretをSource Codeへ保存しない。
17. Storage KeyへOriginal File Nameを使用しない。
18. Multi-Tenant Ownership Checkを必須とする。
19. Raw LogをPublic Access可能にしない。
20. Project / Analysis Deleteで関連Persistent Dataを削除する。
21. BackupにもRetentionを持たせる。
22. AI Prompt Injection対策としてObservation文字列をData扱いする。
23. Product公開時にPrivacy Notice / TermsでLog取扱いを明示する。

---

# 59. 次の設計対象

次は、

```text
16_Product_Plan
```

へ進む。

15までで、

```text
何を解析するか
何を保存するか
何を削除するか
AIに何を送るか
```

が固まった。

これを前提に、

- Freeで何を提供するか
- AIをどこまで無料にするか
- Analysis回数
- Upload Size
- History
- AI Chat
- Report Export
- Known Information
- Comparison
- Paid Planの価値

をProduct Planとして設計する。

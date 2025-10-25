# スタック名とアーキテクチャの関係

このドキュメントでは、プロジェクト内のスタック命名とアーキテクチャの関係について説明します。

## よくある疑問

### Q. CdkStudyStack だけがCDK使ってるの？

**A. いいえ、どちらもCDK使ってます。**

## スタック一覧

| スタック名 | アーキテクチャ | CDK使用 | 状態 |
|-----------|--------------|---------|------|
| **CdkStudyStack** | サーバーレス | ✅ | デプロイ済み |
| **AlbStack** | コンテナベース | ✅ | 未デプロイ |

## 紛らわしさの原因

### 名前だけ見ると...

```typescript
CdkStudyStack  ← "Cdk"が入ってる → CDK使ってそう
AlbStack       ← "Cdk"がない → CDK使ってない？
```

**実際は:**
```typescript
CdkStudyStack  ← CDK使ってる ✅
AlbStack       ← CDK使ってる ✅（名前に入ってないだけ）
```

### なぜこんな名前？

**CdkStudyStack:**
- プロジェクト名（`cdk-study`）から自動生成された名前
- CDK プロジェクト作成時のデフォルト命名規則
- "CDK勉強用プロジェクト"という意味

**AlbStack:**
- 使用する技術（ALB = Application Load Balancer）から命名
- 後から追加した学習用スタック
- 特徴的な技術名を使った

## CDKとアーキテクチャの違い

### CDK（道具）

**AWS CDK (Cloud Development Kit):**
- AWSのインフラをコードで定義するツール
- TypeScript、Python等でインフラを書ける
- CloudFormationテンプレートを自動生成

```typescript
// CDKのコード例
const bucket = new s3.Bucket(this, 'MyBucket');
const lambda = new lambda.Function(this, 'MyFunction');
```

### アーキテクチャ（設計パターン）

**アーキテクチャ:**
- システムの構成・設計パターン
- どんな技術を組み合わせるか
- サーバーレス、コンテナ、マイクロサービス等

```
サーバーレスアーキテクチャ:
  CloudFront → API Gateway → Lambda → DynamoDB

コンテナベースアーキテクチャ:
  ALB → ECS Fargate → DynamoDB
```

## 例え話

### ペンと絵のスタイル

```
CDK = ペン（道具）
アーキテクチャ = 絵のスタイル

同じペン（CDK）で:
- 水彩画（サーバーレスアーキテクチャ）= CdkStudyStack
- 油絵（コンテナアーキテクチャ）= AlbStack
を描ける
```

### 車の運転

```
CDK = 免許（資格・道具）
アーキテクチャ = 車の種類

同じ免許で:
- オートマ車（サーバーレス）= CdkStudyStack
- マニュアル車（コンテナ）= AlbStack
を運転できる
```

## このプロジェクトの構成

```
cdk-study/（CDKプロジェクト）
│
├── lib/
│   ├── cdk-study-stack.ts  ← CDKでサーバーレスアーキテクチャを定義
│   │   export class CdkStudyStack extends cdk.Stack {
│   │     // CloudFront + API Gateway + Lambda + DynamoDB
│   │   }
│   │
│   └── alb-stack.ts        ← CDKでコンテナアーキテクチャを定義
│       export class AlbStack extends cdk.Stack {
│         // ALB + ECS Fargate + DynamoDB
│       }
│
└── bin/
    └── cdk-study.ts        ← 両方のスタックを定義
        const app = new cdk.App();
        new CdkStudyStack(app, 'CdkStudyStack');
        // AlbStackはコメントアウト（デプロイしない）
```

## わかりやすい名前だったら...

もし最初から命名規則を統一していたら：

| 現在の名前 | わかりやすい名前例 | 説明 |
|-----------|------------------|------|
| **CdkStudyStack** | ServerlessStack | サーバーレスアーキテクチャ |
| **AlbStack** | ContainerStack | コンテナアーキテクチャ |

**または:**

| 現在の名前 | わかりやすい名前例 | 説明 |
|-----------|------------------|------|
| **CdkStudyStack** | LambdaApiStack | Lambda使ってる方 |
| **AlbStack** | EcsFargateStack | ECS Fargate使ってる方 |

**または:**

| 現在の名前 | わかりやすい名前例 | 説明 |
|-----------|------------------|------|
| **CdkStudyStack** | ProductionStack | 本番稼働中のTODOアプリ |
| **AlbStack** | LearningStack | 学習用スタック |

## なぜ名前を変えないのか

### 既にデプロイ済み

```
AWS CloudFormation
└── CdkStudyStack（稼働中）
    ├── CloudFront: https://d17swam0xtn90n.cloudfront.net
    ├── S3 Bucket
    ├── API Gateway
    ├── Lambda Functions
    └── DynamoDB Table
```

**名前を変えると:**
1. AWS上に別スタックとして作成される
2. 旧スタックは残ったまま
3. リソースが二重に作られる
4. **料金が2倍になる** 💸💸

### リネームの影響範囲

```
変更が必要な箇所:
├── lib/cdk-study-stack.ts（ファイル名）
├── export class CdkStudyStack（クラス名）
├── bin/cdk-study.ts（import文）
├── test/*.test.ts（テストコード）
├── .github/workflows/*.yml（CI/CD）
├── README.md（ドキュメント）
└── AWS CloudFormation（既存スタック）← これが問題
```

### リスク vs メリット

| 項目 | そのまま | リネーム |
|------|---------|----------|
| **安全性** | ✅ 安全 | ❌ リスク大 |
| **手間** | ✅ なし | ❌ 大変 |
| **コスト** | ✅ 変わらず | ❌ 一時的に2倍 |
| **わかりやすさ** | ❌ 紛らわしい | ✅ わかりやすい |

**結論:** 動いているものはいじらない

## プロの現場でもよくある

```typescript
// 実際のプロダクトでよく見る命名例

LegacyApiStack        // 昔の名残、でも現役
UserServiceV2Stack    // V1があった名残
TempTestStack         // 一時的なつもりが本番化
DevStack              // 開発用のつもりが本番に
MainStack             // とりあえず付けた名前
```

**完璧な命名は最初だけ、あとは歴史的経緯**

## 覚えておくポイント

### 1. CDKは道具、両方で使っている

```
✅ どちらもCDKで書かれている
✅ どちらもTypeScriptで定義
✅ どちらもnpx cdk deployでデプロイ
```

### 2. アーキテクチャが違う

```
CdkStudyStack: サーバーレスアーキテクチャ
  - Lambda（関数）
  - API Gateway
  - コンテナ不使用

AlbStack: コンテナベースアーキテクチャ
  - ECS Fargate（Dockerコンテナ）
  - ALB
  - コンテナ使用
```

### 3. 名前は歴史的経緯

```
CdkStudyStack:
  - プロジェクト名（cdk-study）から自動生成
  - "Cdk"はプロジェクト名の一部
  - 特別な意味はない

AlbStack:
  - 使用技術（ALB）から命名
  - 後から追加
  - 学習用の特徴を表している
```

## 正しい理解

### ❌ 間違った理解

```
CdkStudyStack = CDK使ってる方
AlbStack = CDK使ってない方
```

### ✅ 正しい理解

```
CdkStudyStack = サーバーレスアーキテクチャ（CDK使用）
AlbStack = コンテナアーキテクチャ（CDK使用）
```

## 会話例

### ❌ 紛らわしい言い方

```
Q: 「このプロジェクトってCDK使ってるの？」
A: 「CdkStudyStackだけ使ってる」← 誤解を招く
```

### ✅ 正確な言い方

```
Q: 「このプロジェクトってCDK使ってるの？」
A: 「両方のスタックともCDKで書かれてる。
   CdkStudyStackはサーバーレス、
   AlbStackはコンテナのアーキテクチャ。」
```

### ❌ 紛らわしい言い方

```
Q: 「コンテナ使ってる？」
A: 「AlbStackで使ってる」← 正しいけど不十分
```

### ✅ 正確な言い方

```
Q: 「コンテナ使ってる？」
A: 「AlbStackはコンテナ（ECS Fargate）を使ってる。
   CdkStudyStackはコンテナ不使用でLambda。
   どちらもCDKで定義されてる。」
```

## まとめ

### 重要なポイント3つ

1. **両方ともCDK使ってる**
   - CdkStudyStack ✅
   - AlbStack ✅

2. **アーキテクチャが違う**
   - CdkStudyStack = サーバーレス
   - AlbStack = コンテナ

3. **名前は歴史的経緯**
   - "Cdk"はプロジェクト名の一部
   - 特別な意味はない
   - 変更するリスク > メリット

### この表を覚えておく

| スタック名 | アーキテクチャ | 技術 | CDK | デプロイ |
|-----------|--------------|------|-----|---------|
| **CdkStudyStack** | サーバーレス | Lambda + API Gateway | ✅ | 済 |
| **AlbStack** | コンテナ | ECS Fargate + ALB | ✅ | 未 |

紛らわしいけど、理解していれば問題なし！

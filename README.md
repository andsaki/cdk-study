# CDK TODO Application

これはAWS CDK (TypeScript) を使用して構築された、シンプルなサーバーレスTODOアプリケーションです。
学習目的で作成されました。

## アーキテクチャ

このプロジェクトで採用しているサーバーレスアーキテクチャと、一般的なNode.jsサーバーでAPIを構築する場合との詳しい比較については、[`docs/architecture_comparison.md`](docs/architecture_comparison.md)を参照してください。

このアプリケーションは、以下のAWSサービスを使用しています。

- **Amazon API Gateway:** TODOアイテムを作成・一覧取得するためのREST APIエンドポイント (`POST /todos`, `GET /todos`) を提供します。
- **AWS Lambda:** API Gatewayからのリクエストを処理し、DynamoDBとやり取りするビジネスロジックを実行します。
- **Amazon DynamoDB:** TODOアイテムを永続化するためのNoSQLデータベースです。
- **Amazon CloudWatch:** Lambda関数のエラーを監視し、エラー率が高い場合にアラームを発生させます。

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Frontend as フロントエンド(HTML)
    participant API Gateway
    participant GetTodos Lambda
    participant DynamoDB

    User->>Frontend: ページを読み込む
    activate Frontend
    Frontend->>API Gateway: GET /todos
    activate API Gateway
    API Gateway->>GetTodos Lambda: イベントをトリガー
    activate GetTodos Lambda
    GetTodos Lambda->>DynamoDB: Scan(TableName)
    activate DynamoDB
    DynamoDB-->>GetTodos Lambda: TODOアイテムのリスト
    deactivate DynamoDB
    GetTodos Lambda-->>API Gateway: 200 OK (アイテムリスト)
    deactivate GetTodos Lambda
    API Gateway-->>Frontend: 200 OK (アイテムリスト)
    deactivate API Gateway
    Frontend->>User: TODOリストを表示
    deactivate Frontend
```

### リクエストフロー

#### TODO作成 (POST /todos)
1.  クライアントが `POST /todos` にTODOの内容を含んだリクエストを送信します。
2.  API Gatewayがリクエストを受け取り、`CreateTodo` Lambda関数をトリガーします。
3.  Lambda関数がリクエストボディをパースし、新しいTODOアイテムを作成します。
4.  Lambda関数がDynamoDBテーブルに新しいアイテムを書き込みます。
5.  成功すると、Lambda関数は `201 Created` レスポンスを返します。

#### TODO一覧取得 (GET /todos)
1.  クライアントが `GET /todos` にリクエストを送信します。
2.  API Gatewayがリクエストを受け取り、`GetTodos` Lambda関数をトリガーします。
3.  Lambda関数がDynamoDBテーブルの全アイテムをスキャン（取得）します。
4.  成功すると、Lambda関数はTODOアイテムのリストを `200 OK` レスポンスで返します。

## プロジェクト構成

- `lib/cdk-study-stack.ts`: すべてのインフラストラクチャを定義するCDKスタックです。
- `lambda/create.ts`: TODOアイテムを作成するLambda関数のソースコードです。
- `lambda/get.ts`: TODOアイテムを一覧取得するLambda関数のソースコードです。
- `test/cdk-study.test.ts`: インフラ定義を検証するテストコードです。

## 便利なコマンド

* `npm run build`: TypeScriptをJavaScriptにコンパイルします。
* `npm run watch`: ファイルの変更を監視して自動的にコンパイルします。
* `npm run test`: `jest` を使用して単体テストを実行します。テストの詳細については [`docs/testing_strategy.md`](docs/testing_strategy.md) を参照してください。
* `npx cdk deploy`: このスタックをデフォルトのAWSアカウント/リージョンにデプロイします。
* `npx cdk diff`: デプロイ済みのスタックと現在の状態を比較します。
* `npx cdk synth`: 合成されたCloudFormationテンプレートを出力します。
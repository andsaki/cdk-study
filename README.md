# CDK TODO Application

これはAWS CDK (TypeScript) を使用して構築された、シンプルなサーバーレスTODOアプリケーションです。
学習目的で作成されました。

## アーキテクチャ

このプロジェクトで採用しているサーバーレスアーキテクチャと、一般的なNode.jsサーバーでAPIを構築する場合との詳しい比較については、[`docs/architecture_comparison.md`](docs/architecture_comparison.md)を参照してください。

このアプリケーションは、以下のAWSサービスを使用しています。

- **Amazon API Gateway:** TODOアイテムを操作するためのREST APIエンドポイント (`POST /todos`, `GET /todos`, `GET /todos/{id}` など) を提供します。
- **AWS Lambda:** API Gatewayからのリクエストを処理し、DynamoDBとやり取りするビジネスロジックを実行します。
- **Amazon DynamoDB:** TODOアイテムを永続化するためのNoSQLデータベースです。(詳しい解説は [`docs/database_choice.md`](docs/database_choice.md) を参照)
- **Amazon CloudWatch:** Lambda関数のエラーを監視し、エラー率が高い場合にアラームを発生させます。

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Frontend as フロントエンド(HTML)
    participant API Gateway
    participant Lambda
    participant DynamoDB
    participant CloudWatch

    User->>Frontend: 操作を行う
    activate Frontend
    Frontend->>API Gateway: APIリクエスト (GET, POSTなど)
    activate API Gateway
    API Gateway->>Lambda: イベントをトリガー
    activate Lambda

    note over Lambda, CloudWatch: 実行ログやメトリクスは<br/>自動的にCloudWatchに送信される

    Lambda->>DynamoDB: データ操作 (Scan, Putなど)
    activate DynamoDB
    DynamoDB-->>Lambda: 操作結果
    deactivate DynamoDB
    Lambda-->>API Gateway: APIレスポンス
    deactivate Lambda
    API Gateway-->>Frontend: APIレスポンス
    deactivate API Gateway
    Frontend->>User: 画面を更新
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

#### TODO詳細取得 (GET /todos/{id})
1.  クライアントが `GET /todos/{id}` にリクエストを送信します。
2.  API Gatewayがリクエストを受け取り、`GetTodoById` Lambda関数をトリガーします。
3.  Lambda関数が指定されたIDのアイテムを1件取得します。
4.  アイテムが見つかれば `200 OK` で、見つからなければ `404 Not Found` で応答します。

## プロジェクト構成

- `lib/cdk-study-stack.ts`: すべてのインフラストラクチャを定義するCDKスタックです。
- `lambda/create.ts`: TODOアイテムを作成するLambda関数のソースコードです。
- `lambda/get.ts`: TODOアイテムを一覧取得するLambda関数のソースコードです。
- `lambda/get-one.ts`: TODOアイテムを1件取得するLambda関数のソースコードです。
- `test/cdk-study.test.ts`: インフラ定義を検証するテストコードです。

## 便利なコマンド

* `npm run build`: TypeScriptをJavaScriptにコンパイルします。
* `npm run watch`: ファイルの変更を監視して自動的にコンパイルします。
* `npm run test`: `jest` を使用して単体テストを実行します。テストの詳細については [`docs/testing_strategy.md`](docs/testing_strategy.md) を参照してください。
* `npx cdk deploy`: このスタックをデフォルトのAWSアカウント/リージョンにデプロイします。
* `npx cdk diff`: デプロイ済みのスタックと現在の状態を比較します。
* `npx cdk synth`: 合成されたCloudFormationテンプレートを出力します。
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

/**
 * モダンなフルスタックWebアプリケーションの構成をCDKで定義するスタックです。
 * バックエンドのTODOアプリAPIと、フロントエンドの静的ウェブサイトから構成されます。
 * @summary フルスタックTODOアプリケーションのCDKスタック。
 */
export class CdkStudyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- Backend: TODO App API ---

    /**
     * TODOアイテムを永続化するためのDynamoDBテーブル。
     *
     * セキュリティ設定:
     * - encryption: AWS_MANAGED - AWSが管理する暗号化キー(SSE-DynamoDB)で保存時暗号化を有効化。
     *   データは自動的に暗号化されてディスクに保存され、読み取り時に復号化されます。
     *   追加コストなしでデータ保護を実現します。
     * - pointInTimeRecovery: true - ポイントインタイムリカバリを有効化。
     *   過去35日間の任意の時点にテーブルを復元できます。
     *   誤削除やデータ破損からの復旧が可能になります。
     *
     * テーブル設計:
     * - partitionKey: 'id' - 各TODOアイテムを一意に識別するパーティションキー。
     *   UUIDなどのランダムな値を使用することで、データが複数のパーティションに均等に分散され、
     *   高いスループットを維持できます。
     *
     * 運用設定:
     * - removalPolicy: DESTROY - スタック削除時にテーブルも削除します（学習用途）。
     *   本番環境では RETAIN に変更して、誤削除を防ぐことを推奨します。
     */
    const table = new dynamodb.Table(this, 'TodoTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
    });

    /**
     * API Gatewayからのリクエストに応じてTODOのCRUD処理を実行するLambda関数群。
     *
     * NodejsFunctionの特徴:
     * - TypeScriptソースコードを自動的にesbuildでバンドル・トランスパイルします。
     * - 依存関係を自動的に検出してパッケージングします。
     * - Lambda Layersを使わずにシンプルにデプロイできます。
     *
     * 共通設定の説明:
     * - runtime: NODEJS_20_X - Node.js 20ランタイムを使用（最新のLTS版）
     * - environment.TABLE_NAME - 環境変数でDynamoDBテーブル名を渡します。
     *   ハードコーディングを避け、スタック間で柔軟に対応できます。
     * - logRetention: ONE_WEEK - CloudWatch Logsのログ保持期間を1週間に設定。
     *   ログが無期限に溜まることを防ぎ、コストを抑えます。
     * - tracing: ACTIVE - AWS X-Rayトレーシングを有効化。
     *   リクエストの処理フローを可視化し、パフォーマンスのボトルネックを特定できます。
     *
     * IAM権限:
     * - table.grantWriteData() / grantReadData() - 最小権限の原則に基づき、
     *   各関数に必要な権限（読み取り/書き込み）のみを付与します。
     */
    // Create - TODOアイテムを新規作成
    const createTodoFunction = new NodejsFunction(this, 'CreateTodoFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/create.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: table.tableName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
    });
    table.grantWriteData(createTodoFunction);

    // Get List - 全TODOアイテムを取得
    const getTodosFunction = new NodejsFunction(this, 'GetTodosFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/get.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: table.tableName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
    });
    table.grantReadData(getTodosFunction); // 読み取り専用権限

    // Get One - 特定のTODOアイテムをIDで取得
    const getTodoByIdFunction = new NodejsFunction(this, 'GetTodoByIdFunction', {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(__dirname, '../lambda/get-one.ts'),
        handler: 'handler',
        environment: {
            TABLE_NAME: table.tableName,
        },
        logRetention: logs.RetentionDays.ONE_WEEK,
        tracing: lambda.Tracing.ACTIVE,
    });
    table.grantReadData(getTodoByIdFunction); // 読み取り専用権限

    // Update - 既存のTODOアイテムを更新
    const updateTodoFunction = new NodejsFunction(this, 'UpdateTodoFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/update.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: table.tableName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
    });
    table.grantWriteData(updateTodoFunction); // 書き込み権限（更新・削除が可能）

    // Delete - TODOアイテムを削除
    const deleteTodoFunction = new NodejsFunction(this, 'DeleteTodoFunction', {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(__dirname, '../lambda/delete.ts'),
        handler: 'handler',
        environment: {
            TABLE_NAME: table.tableName,
        },
        logRetention: logs.RetentionDays.ONE_WEEK,
        tracing: lambda.Tracing.ACTIVE,
    });
    table.grantWriteData(deleteTodoFunction); // 書き込み権限（更新・削除が可能）

    /**
     * AWS Secrets Managerでシークレット情報を安全に管理します。
     *
     * Secrets Managerの利点:
     * - APIキーや認証情報をコードやGitリポジトリに含めずに管理できます。
     * - 自動的に暗号化されて保存されます（KMSキーを使用）。
     * - アクセス履歴の監査ログが残ります（CloudTrail経由）。
     * - ローテーション機能で定期的にシークレットを更新できます。
     * - IAMポリシーで誰がアクセスできるかを細かく制御できます。
     *
     * generateSecretStringの設定:
     * - secretStringTemplate: シークレットのメタデータをJSON形式で保存。
     * - generateStringKey: 'apiKey' - この名前で自動生成されたランダム文字列が格納されます。
     * - excludePunctuation: true - 記号を除外（URLに含めやすくする）。
     * - includeSpace: false - スペースを含めない。
     *
     * 使用方法:
     * デプロイ後、AWS CLIやコンソールから値を取得します:
     * aws secretsmanager get-secret-value --secret-id <SecretArn>
     */
    const apiKeySecret = new secretsmanager.Secret(this, 'ApiKeySecret', {
      description: 'API Key for TODO API',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ description: 'TODO API Key' }),
        generateStringKey: 'apiKey',
        excludePunctuation: true,
        includeSpace: false,
      },
    });

    /**
     * API Gatewayで外部にREST APIを公開します。
     *
     * セキュリティ機能:
     * - APIキー認証: 後述のAPIキーとUsage Planで、認証されたクライアントのみアクセス可能にします。
     * - CORS設定: フロントエンドのCloudFrontドメインからのみアクセスを許可。
     *   本番環境では allowOrigins を具体的なドメイン（例: ['https://example.cloudfront.net']）に
     *   変更することを強く推奨します。ワイルドカード(*.cloudfront.net)は開発用です。
     *
     * デプロイ設定 (deployOptions):
     * - stageName: 'prod' - 本番環境用のステージ名。dev/staging/prodなど環境を分けることが可能。
     * - tracingEnabled: true - AWS X-Rayでリクエストをトレース。
     *   APIゲートウェイ→Lambda→DynamoDBの呼び出しフローを可視化できます。
     * - loggingLevel: INFO - CloudWatch Logsに詳細ログを記録。
     *   ERRORにすればエラーのみ、OFFにすればログなしにできます。
     * - dataTraceEnabled: true - リクエスト/レスポンスのボディをログに記録。
     *   デバッグに便利ですが、機密情報を含む場合は本番でOFFにすることを推奨。
     *
     * CORS設定 (Cross-Origin Resource Sharing):
     * - allowHeaders: APIリクエストで使用できるHTTPヘッダー。
     *   X-Api-Keyはカスタムヘッダーとして追加しています。
     * - allowMethods: 全HTTPメソッド（GET, POST, PUT, DELETE等）を許可。
     */
    const api = new apigateway.RestApi(this, 'TodoApi', {
      restApiName: 'TODO API',
      description: 'Secure TODO API with API Key authentication',
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ['https://*.cloudfront.net'], // TODO: 本番では具体的なドメインに変更
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
        statusCode: 200,
      },
    });

    /**
     * APIキーによる認証とレート制限を設定します。
     *
     * APIキー (ApiKey):
     * - APIへのアクセスに必要な認証キー。
     * - enabled: true - キーを有効化。falseにすると一時的に無効化できます。
     * - デプロイ後、キーの値はAWSコンソールまたはCLIで確認します。
     *
     * Usage Plan（使用プラン）の役割:
     * APIキーと紐付けて、リクエストの制限やクォータを設定します。
     * DoS攻撃や過度な利用を防ぎ、APIの安定運用とコスト管理を実現します。
     *
     * throttle（スロットリング）:
     * - rateLimit: 100 - 1秒あたりの平均リクエスト数の上限（steady state rate）。
     *   この値を超えるとAPI Gatewayが429 Too Many Requestsを返します。
     * - burstLimit: 200 - 短期間のバースト（急激な増加）に対応できる最大リクエスト数。
     *   トークンバケットアルゴリズムで制御されます。
     *
     * quota（クォータ）:
     * - limit: 10000 - 期間内の総リクエスト数の上限。
     * - period: DAY - 1日あたりの制限。WEEKやMONTHも選択可能。
     *   制限を超えると429エラーが返されます。
     *
     * 本番環境での調整:
     * 実際のトラフィックパターンに応じて、これらの値を調整してください。
     * CloudWatchメトリクスでAPIの使用状況を監視できます。
     */
    const apiKey = new apigateway.ApiKey(this, 'TodoApiKey', {
      apiKeyName: 'TodoApiKey',
      description: 'API Key for TODO API',
      enabled: true,
    });

    const usagePlan = new apigateway.UsagePlan(this, 'TodoUsagePlan', {
      name: 'TodoUsagePlan',
      description: 'Usage plan for TODO API',
      throttle: {
        rateLimit: 100,    // 定常的なレート: 100リクエスト/秒
        burstLimit: 200,   // バースト時の上限: 200リクエスト
      },
      quota: {
        limit: 10000,              // 1日あたり10000リクエストまで
        period: apigateway.Period.DAY,
      },
    });

    usagePlan.addApiKey(apiKey); // APIキーとUsage Planを関連付け

    /**
     * RESTful APIのエンドポイント構造を定義します。
     *
     * エンドポイント設計:
     * - GET    /todos       - 全TODOアイテムを取得
     * - POST   /todos       - 新しいTODOアイテムを作成
     * - GET    /todos/{id}  - 特定のTODOアイテムを取得
     * - PUT    /todos/{id}  - 既存のTODOアイテムを更新
     * - DELETE /todos/{id}  - TODOアイテムを削除
     *
     * セキュリティ設定:
     * - apiKeyRequired: true - 全てのエンドポイントでAPIキーを必須にします。
     *   リクエストヘッダーに `x-api-key: <your-api-key>` を含める必要があります。
     *
     * LambdaIntegration:
     * - API Gatewayが受け取ったリクエストをLambda関数に転送します。
     * - Lambda関数の戻り値がHTTPレスポンスとしてクライアントに返されます。
     * - プロキシ統合により、Lambda側でステータスコードやヘッダーを自由に制御できます。
     */
    const todos = api.root.addResource('todos');
    todos.addMethod('POST', new apigateway.LambdaIntegration(createTodoFunction), { apiKeyRequired: true });
    todos.addMethod('GET', new apigateway.LambdaIntegration(getTodosFunction), { apiKeyRequired: true });

    const todoById = todos.addResource('{id}'); // パスパラメータ {id} を定義
    todoById.addMethod('GET', new apigateway.LambdaIntegration(getTodoByIdFunction), { apiKeyRequired: true });
    todoById.addMethod('PUT', new apigateway.LambdaIntegration(updateTodoFunction), { apiKeyRequired: true });
    todoById.addMethod('DELETE', new apigateway.LambdaIntegration(deleteTodoFunction), { apiKeyRequired: true });

    /**
     * Usage PlanをAPIステージに適用します。
     * これにより、このAPIの'prod'ステージに対してスロットリングとクォータが有効になります。
     */
    usagePlan.addApiStage({
      api: api,
      stage: api.deploymentStage,
    });

    /**
     * AWS WAF (Web Application Firewall) でAPIを多層的に保護します。
     *
     * WAFの役割:
     * API GatewayのAPIキー認証に加えて、より高度なセキュリティ層を提供します。
     * - SQLインジェクション、XSS、パストラバーサル等の一般的な攻撃をブロック
     * - 既知の悪意あるボットやIPアドレスからのアクセスを遮断
     * - レート制限でDDoS攻撃を緩和
     *
     * 設定の詳細:
     * - defaultAction: allow - デフォルトではリクエストを許可（ルールに該当した場合のみブロック）
     * - scope: REGIONAL - リージョナルリソース（API Gateway REST API）用のWAF
     *   CloudFront用の場合はGLOBALを使用します
     * - visibilityConfig: WAFのメトリクスとログの設定
     *   - cloudWatchMetricsEnabled: CloudWatchでブロック数等のメトリクスを確認可能
     *   - sampledRequestsEnabled: ブロックされたリクエストのサンプルをコンソールで確認可能
     *
     * 適用するルール（優先度順）:
     * 1. AWSCommonRuleSet - OWASP Top 10等の一般的な脅威を防御
     * 2. AWSKnownBadInputsRuleSet - 既知の脆弱性を突く入力パターンを検出
     * 3. RateLimitRule - 同一IPから5分間で2000リクエスト以上をブロック
     */
    const webAcl = new wafv2.CfnWebACL(this, 'TodoApiWebAcl', {
      defaultAction: { allow: {} },
      scope: 'REGIONAL', // API Gateway用（CloudFrontの場合は'GLOBAL'）
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'TodoApiWebAcl',
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          // ルール1: AWS管理の共通脅威対策ルールセット
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
              // このルールセットには以下が含まれます:
              // - SQLインジェクション対策
              // - クロスサイトスクリプティング(XSS)対策
              // - パストラバーサル攻撃対策
              // - ローカルファイルインクルージョン(LFI)対策
              // - リモートファイルインクルージョン(RFI)対策
            },
          },
          overrideAction: { none: {} }, // 管理ルールグループの場合はoverrideActionを使用
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesCommonRuleSet',
            sampledRequestsEnabled: true,
          },
        },
        {
          // ルール2: 既知の悪意ある入力パターン対策
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 2,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
              // Log4Shell、ShellShock等の既知の脆弱性を突く入力を検出
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesKnownBadInputsRuleSet',
            sampledRequestsEnabled: true,
          },
        },
        {
          // ルール3: IPベースのレート制限（DDoS対策）
          name: 'RateLimitRule',
          priority: 3,
          statement: {
            rateBasedStatement: {
              limit: 2000,  // 5分間で2000リクエストまで許可
              aggregateKeyType: 'IP',  // 送信元IPアドレスごとに集計
              // これを超えると自動的にブロックされ、5分後に解除されます
            },
          },
          action: { block: {} },  // カスタムルールの場合はactionを使用
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    /**
     * 作成したWAF Web ACLをAPI Gatewayのステージに関連付けます。
     * これにより、全てのAPIリクエストがWAFを通過してから処理されます。
     *
     * セキュリティの多層防御:
     * リクエストは以下の順序で検証されます:
     * 1. WAF - 悪意ある入力やレート制限をチェック
     * 2. API Gateway - APIキーの検証
     * 3. Lambda - ビジネスロジックの実行
     * 4. DynamoDB - データアクセス（IAM権限で制御）
     */
    new wafv2.CfnWebACLAssociation(this, 'WebAclAssociation', {
      resourceArn: `arn:aws:apigateway:${this.region}::/restapis/${api.restApiId}/stages/${api.deploymentStage.stageName}`,
      webAclArn: webAcl.attrArn,
    });

    /**
     * CloudWatch Alarmsで全Lambda関数を監視します。
     *
     * 監視の目的:
     * - エラー検知: コードのバグやDynamoDBアクセスエラー等を早期に発見
     * - スロットリング検知: Lambda同時実行数の上限到達を検知
     *
     * アラームの仕組み:
     * - metric: 監視するメトリクス（エラー数、スロットル数）
     * - threshold: アラーム発火の閾値
     * - evaluationPeriods: 評価期間の回数（1 = 1回の期間で閾値を超えたらアラーム）
     * - treatMissingData: データがない場合の扱い
     *   - NOT_BREACHING: データがない = 正常とみなす（Lambda未実行時にアラームを鳴らさない）
     *
     * 本番環境での推奨設定:
     * - SNSトピックを作成してアラームと関連付け（メール通知等）
     * - evaluationPeriodsを2-3に増やして誤検知を減らす
     * - CloudWatchダッシュボードでメトリクスを可視化
     */
    const lambdaFunctions = [
      { func: createTodoFunction, name: 'CreateTodo' },
      { func: getTodosFunction, name: 'GetTodos' },
      { func: getTodoByIdFunction, name: 'GetTodoById' },
      { func: updateTodoFunction, name: 'UpdateTodo' },
      { func: deleteTodoFunction, name: 'DeleteTodo' },
    ];

    lambdaFunctions.forEach(({ func, name }) => {
      // エラー監視アラーム
      new cloudwatch.Alarm(this, `${name}ErrorAlarm`, {
        metric: func.metricErrors({ period: cdk.Duration.minutes(5) }),
        threshold: 5,  // 5分間で5回以上のエラーでアラーム
        evaluationPeriods: 1,
        alarmName: `${name}Function-High-Error-Rate`,
        alarmDescription: `${name}Functionのエラー率が高い場合にトリガーされます。コードのバグやリソースへのアクセスエラーの可能性があります。`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // スロットリング監視アラーム
      new cloudwatch.Alarm(this, `${name}ThrottleAlarm`, {
        metric: func.metricThrottles({ period: cdk.Duration.minutes(5) }),
        threshold: 3,  // 5分間で3回以上のスロットルでアラーム
        evaluationPeriods: 1,
        alarmName: `${name}Function-High-Throttle-Rate`,
        alarmDescription: `${name}Functionのスロットリング率が高い場合にトリガーされます。Lambda同時実行数の上限に達している可能性があります。`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    });

    // --- Frontend Hosting ---

    /**
     * フロントエンドの静的ファイル（index.htmlなど）を格納するS3バケット。
     *
     * セキュリティ設定:
     * - encryption: S3_MANAGED - S3が管理する暗号化キー(SSE-S3)でファイルを暗号化。
     *   追加コストなしでデータ保護を実現します。
     * - enforceSSL: true - HTTPS接続のみを許可。HTTP接続は拒否されます。
     *   暗号化されていない通信でのデータ漏洩を防ぎます。
     * - blockPublicAccess: BLOCK_ALL - パブリックアクセスを完全にブロック。
     *   CloudFront経由でのみアクセス可能にし、直接のS3アクセスを防ぎます。
     *
     * アクセス制御:
     * - Origin Access Identity (OAI) を使用して、CloudFrontからのみアクセスを許可。
     * - バケットポリシーで明示的にOAIにGetObject権限を付与（後述）。
     *
     * 運用設定:
     * - removalPolicy: DESTROY - スタック削除時にバケットも削除（学習用途）。
     * - autoDeleteObjects: true - バケット内のファイルも自動削除。
     *   本番環境では RETAIN に変更し、バケットを残すことを推奨します。
     */
    const webSiteBucket = new s3.Bucket(this, 'WebSiteBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,  // SSE-S3暗号化
      enforceSSL: true,  // HTTPS必須
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,  // パブリックアクセス完全ブロック
    });

    /**
     * Origin Access Identity (OAI) - CloudFrontからS3への安全なアクセスを実現します。
     *
     * OAIの仕組み:
     * - CloudFrontディストリビューションに紐付く専用のAWS IDです。
     * - S3バケットポリシーでこのOAIにのみGetObject権限を付与します。
     * - これにより、S3バケットを非公開に保ちつつ、CloudFront経由でのみコンテンツ配信できます。
     *
     * セキュリティ上の利点:
     * - S3バケットのパブリックアクセスを完全にブロックできます。
     * - CloudFrontのみがコンテンツにアクセス可能なため、直接のS3 URLでは閲覧不可。
     * - CloudFrontの署名付きURL/Cookie機能と組み合わせてアクセス制御も可能。
     *
     * 注: 新しいプロジェクトでは Origin Access Control (OAC) の使用が推奨されていますが、
     *     CDKのL2 Constructでは現在OAIが標準です。
     */
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity', {
      comment: 'OAI for TODO App frontend',
    });

    /**
     * S3バケットポリシーでOAIに読み取り権限を付与します。
     * これにより、CloudFrontがS3バケット内の全オブジェクトを取得できます。
     */
    webSiteBucket.addToResourcePolicy(new iam.PolicyStatement({
        actions: ['s3:GetObject'],  // オブジェクトの読み取りのみ許可
        resources: [webSiteBucket.arnForObjects('*')],  // バケット内の全オブジェクト
        principals: [originAccessIdentity.grantPrincipal],  // OAIのみに権限付与
    }));

    /**
     * CloudFrontのレスポンスヘッダーポリシーでセキュリティヘッダーを追加します。
     *
     * セキュリティヘッダーの説明:
     *
     * 1. X-Content-Type-Options: nosniff
     *    - MIMEタイプスニッフィング攻撃を防止
     *    - ブラウザがContent-Typeヘッダーを厳密に解釈するよう強制
     *
     * 2. X-Frame-Options: DENY
     *    - クリックジャッキング攻撃を防止
     *    - このサイトを<iframe>内で表示することを禁止
     *
     * 3. Referrer-Policy: strict-origin-when-cross-origin
     *    - リファラー情報の漏洩を制限
     *    - 同一オリジン: フルURLを送信、クロスオリジン: オリジンのみ送信
     *
     * 4. Strict-Transport-Security (HSTS)
     *    - HTTPSの使用を強制（1年間有効）
     *    - サブドメインにも適用
     *    - preload: HSTSプリロードリストへの登録が可能
     *    - これにより、初回アクセスからHTTPSが強制されます
     *
     * 5. X-XSS-Protection: 1; mode=block
     *    - レガシーブラウザ向けのXSS対策
     *    - XSSを検出した場合、ページのレンダリングをブロック
     *    - 注: 最新ブラウザではContent Security Policyの使用が推奨
     *
     * override: true - オリジン(S3)のヘッダーを上書きして、確実に適用
     */
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeadersPolicy', {
      comment: 'Security headers policy for web application protection',
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },  // MIMEスニッフィング防止
        frameOptions: {
          frameOption: cloudfront.HeadersFrameOption.DENY,  // iframe埋め込み禁止
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.seconds(31536000),  // 1年間有効
          includeSubdomains: true,  // サブドメインにも適用
          preload: true,  // HSTSプリロードリスト対応
          override: true,
        },
        xssProtection: {
          protection: true,  // XSS Protection有効化
          modeBlock: true,   // XSS検出時にページをブロック
          override: true,
        },
      },
    });

    /**
     * CloudFrontディストリビューションでグローバルにコンテンツを配信します。
     *
     * CloudFrontの役割:
     * - CDN (Content Delivery Network): 世界中のエッジロケーションにコンテンツをキャッシュ
     * - レイテンシ削減: ユーザーに最も近いエッジから配信し、高速化
     * - S3の負荷軽減: エッジでキャッシュされるため、S3へのリクエストが減少
     * - DDoS対策: AWS Shieldによる自動保護
     *
     * セキュリティ設定:
     * - viewerProtocolPolicy: REDIRECT_TO_HTTPS - HTTP→HTTPS自動リダイレクト
     * - minimumProtocolVersion: TLS_V1_2_2021 - TLS 1.2以上のみ許可
     *   古い脆弱なプロトコル(SSLv3, TLS 1.0/1.1)を拒否
     * - responseHeadersPolicy: 上記のセキュリティヘッダーを自動付与
     *
     * 運用機能:
     * - enableLogging: true - アクセスログをS3に保存（別途バケットが自動作成されます）
     * - defaultRootObject: 'index.html' - ルートアクセス時のデフォルトファイル
     */
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: new origins.S3Origin(webSiteBucket, { originAccessIdentity }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,  // HTTPS強制
        responseHeadersPolicy: responseHeadersPolicy,  // セキュリティヘッダー適用
      },
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,  // TLS 1.2+
      comment: 'Secure S3-backed TODO app with CloudFront CDN',
      enableLogging: true,  // アクセスログ有効化
    });

    /**
     * フロントエンドのビルド成果物をS3にデプロイし、CloudFrontで配信します。
     *
     * BucketDeploymentの動作:
     * 1. sources: ../frontend/dist ディレクトリ内のファイルをZIP化
     * 2. デプロイ時にLambda関数が自動的に起動され、ファイルをS3にアップロード
     * 3. distribution指定により、CloudFrontのキャッシュを自動無効化
     * 4. distributionPaths: ['/*'] で全ファイルのキャッシュをクリア
     *
     * キャッシュ無効化の重要性:
     * - CloudFrontはデフォルトでコンテンツを24時間キャッシュします
     * - 新しいバージョンをデプロイしても、キャッシュが残っていると古いバージョンが配信されます
     * - 明示的にキャッシュ無効化することで、即座に最新版が配信されます
     *
     * 注意事項:
     * - このリソースはCDKデプロイ時に毎回実行されます
     * - frontend/distディレクトリが存在しない場合、デプロイが失敗します
     * - 事前に frontend ディレクトリで `npm run build` を実行してください
     */
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../frontend/dist'))],
      destinationBucket: webSiteBucket,
      distribution: distribution,
      distributionPaths: ['/*'],  // 全ファイルのキャッシュを無効化
    });

    // ========================================
    // CloudFormation Outputs - デプロイ後に必要な情報を出力
    // ========================================

    /**
     * フロントエンドのCloudFront URL。
     * ブラウザでこのURLにアクセスすると、TODO Appが表示されます。
     */
    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'The URL of the CloudFront distribution. Access this to use the TODO app.',
    });

    /**
     * バックエンドAPIのエンドポイントURL。
     * フロントエンドのコードでこのURLを指定して、APIを呼び出します。
     */
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL for TODO CRUD operations',
    });

    /**
     * API KeyのID。
     *
     * APIキーの値を取得する方法:
     * aws apigateway get-api-key --api-key <このID> --include-value --query 'value' --output text
     *
     * または、AWSマネジメントコンソール:
     * API Gateway → API Keys → TodoApiKey → Show で確認できます
     *
     * 使い方:
     * HTTPリクエストのヘッダーに `x-api-key: <キーの値>` を含めます。
     */
    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,
      description: 'API Key ID. Use AWS CLI to retrieve the actual key value: aws apigateway get-api-key --api-key <id> --include-value',
    });

    /**
     * Secrets ManagerのARN。
     * 将来的にAPIキーのローテーションや追加の機密情報を管理する際に使用します。
     *
     * シークレットの値を取得:
     * aws secretsmanager get-secret-value --secret-id <このARN> --query 'SecretString' --output text
     */
    new cdk.CfnOutput(this, 'ApiKeySecretArn', {
      value: apiKeySecret.secretArn,
      description: 'Secrets Manager ARN for API configuration. Use for secure secret retrieval.',
    });
  }
}
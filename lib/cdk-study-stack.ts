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
     * 'id'をパーティションキーとして使用します。
     * スタックが削除されると、このテーブルも自動的に削除されます。
     */
    const table = new dynamodb.Table(this, 'TodoTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    /**
     * API Gatewayからのリクエストに応じてTODOのCRUD処理を実行するLambda関数群。
     * esbuildを利用してTypeScriptのソースコードから直接デプロイされます。
     */
    // Create
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

    // Get List
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
    table.grantReadData(getTodosFunction);

    // Get One
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
    table.grantReadData(getTodoByIdFunction);

    // Update
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
    table.grantWriteData(updateTodoFunction);

    // Delete
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
    table.grantWriteData(deleteTodoFunction);

    /**
     * Lambda関数群を外部に公開するためのREST APIの窓口。
     * /todos エンドポイントでTODOのCRUD操作を提供します。
     * CORS設定により、フロントエンドからのクロスオリジンリクエストを許可します。
     */
    const api = new apigateway.LambdaRestApi(this, 'TodoApi', {
      handler: createTodoFunction, // Default handler
      proxy: false,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
        statusCode: 200,
      },
    });

    const todos = api.root.addResource('todos');
    todos.addMethod('POST', new apigateway.LambdaIntegration(createTodoFunction));
    todos.addMethod('GET', new apigateway.LambdaIntegration(getTodosFunction));

    const todoById = todos.addResource('{id}'); // /todos/{id}
    todoById.addMethod('GET', new apigateway.LambdaIntegration(getTodoByIdFunction));
    todoById.addMethod('PUT', new apigateway.LambdaIntegration(updateTodoFunction));
    todoById.addMethod('DELETE', new apigateway.LambdaIntegration(deleteTodoFunction));

    /**
     * 全Lambda関数のエラー率を監視するCloudWatchアラーム群。
     * 5分間で5回以上のエラーが発生した場合にアラーム状態になります。
     */
    const lambdaFunctions = [
      { func: createTodoFunction, name: 'CreateTodo' },
      { func: getTodosFunction, name: 'GetTodos' },
      { func: getTodoByIdFunction, name: 'GetTodoById' },
      { func: updateTodoFunction, name: 'UpdateTodo' },
      { func: deleteTodoFunction, name: 'DeleteTodo' },
    ];

    lambdaFunctions.forEach(({ func, name }) => {
      new cloudwatch.Alarm(this, `${name}ErrorAlarm`, {
        metric: func.metricErrors({ period: cdk.Duration.minutes(5) }),
        threshold: 5,
        evaluationPeriods: 1,
        alarmName: `${name}Function-High-Error-Rate`,
        alarmDescription: `${name}Functionのエラー率が高い場合にトリガーされます。`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      new cloudwatch.Alarm(this, `${name}ThrottleAlarm`, {
        metric: func.metricThrottles({ period: cdk.Duration.minutes(5) }),
        threshold: 3,
        evaluationPeriods: 1,
        alarmName: `${name}Function-High-Throttle-Rate`,
        alarmDescription: `${name}Functionのスロットリング率が高い場合にトリガーされます。`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    });

    // --- Frontend Hosting ---

    /**
     * フロントエンドの静的ファイル（index.htmlなど）を格納するS3バケット。
     * このバケットは非公開で、CloudFront OAI経由でのみアクセスが許可されます。
     * スタック削除時にオブジェクトも自動で削除されます。
     */
    const webSiteBucket = new s3.Bucket(this, 'WebSiteBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true, // CAUTION: This will delete all objects in the bucket upon stack deletion.
    });

    /**
     * S3バケットのコンテンツを配信するCloudFrontディストリビューション。
     * 世界中のエッジロケーションにコンテンツをキャッシュし、高速なアクセスを提供します。
     * HTTPアクセスは自動的にHTTPSにリダイレクトされます。
     * Origin Access Control (OAC) によりS3へのアクセスを安全に制御します。
     */
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webSiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      comment: 'S3-backed React app with CloudFront',
    });

    /**
     * ビルド済みのReactアプリの成果物（`../frontend/dist`）をS3バケットにデプロイします。
     * デプロイ後、CloudFrontのキャッシュを自動で無効化し、最新のコンテンツが配信されるようにします。
     */
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../frontend/dist'))],
      destinationBucket: webSiteBucket,
      distribution: distribution,
      distributionPaths: ['/*'], // Invalidate all files in the distribution upon deployment
    });

    /**
     * デプロイされたウェブサイトのURL。
     * CloudFormationの出力に表示され、簡単にアクセスできます。
     */
    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'The URL of the CloudFront distribution.',
    });
  }
}
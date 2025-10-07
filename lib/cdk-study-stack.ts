import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
// API Gatewayのモジュールをインポートします
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export class CdkStudyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, 'TodoTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const createTodoFunction = new NodejsFunction(this, 'CreateTodoFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/create.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    table.grantWriteData(createTodoFunction);

    // API Gateway を定義し、Lambda関数と統合します
    const api = new apigateway.LambdaRestApi(this, 'TodoApi', {
      handler: createTodoFunction, // デフォルトの統合先としてcreateTodoFunctionを指定
      proxy: false, // /todos のような特定パスへのルーティングを手動で設定するためfalseに
    });

    // '/todos' というリソースパスを作成します
    const todos = api.root.addResource('todos');
    // '/todos' パスへのPOSTリクエストをLambda関数に統合します
    todos.addMethod('POST', new apigateway.LambdaIntegration(createTodoFunction));
  }
}
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
// Lambda関連のモジュールをインポートします
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export class CdkStudyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, 'TodoTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // TODOを作成するLambda関数を定義します
    const createTodoFunction = new NodejsFunction(this, 'CreateTodoFunction', {
      runtime: lambda.Runtime.NODEJS_20_X, // ランタイムとしてNode.js 20.x を指定
      entry: path.join(__dirname, '../lambda/create.ts'), // Lambda関数のソースコード
      handler: 'handler', // 実行する関数名
      environment: { // Lambda関数内で使用する環境変数を設定
        TABLE_NAME: table.tableName, // DynamoDBのテーブル名を渡す
      },
    });

    // Lambda関数にDynamoDBテーブルへの書き込み権限を付与します
    table.grantWriteData(createTodoFunction);
  }
}

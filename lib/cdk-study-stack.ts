import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export class CdkStudyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, 'TodoTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // TODOを作成するLambda関数
    const createTodoFunction = new NodejsFunction(this, 'CreateTodoFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/create.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    table.grantWriteData(createTodoFunction);

    // TODOを一覧取得するLambda関数
    const getTodosFunction = new NodejsFunction(this, 'GetTodosFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/get.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    table.grantReadData(getTodosFunction);

    // API Gateway の定義
    const api = new apigateway.LambdaRestApi(this, 'TodoApi', {
      handler: createTodoFunction, // デフォルトハンドラ(使われない)
      proxy: false,
    });

    const todos = api.root.addResource('todos');
    todos.addMethod('POST', new apigateway.LambdaIntegration(createTodoFunction));
    // GET /todos を追加
    todos.addMethod('GET', new apigateway.LambdaIntegration(getTodosFunction));
  }
}
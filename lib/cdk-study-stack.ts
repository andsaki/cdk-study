import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export class CdkStudyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, 'TodoTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create
    const createTodoFunction = new NodejsFunction(this, 'CreateTodoFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/create.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: table.tableName,
      },
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
    });
    table.grantWriteData(deleteTodoFunction);

    // API Gateway
    const api = new apigateway.LambdaRestApi(this, 'TodoApi', {
      handler: createTodoFunction, // Default handler
      proxy: false,
    });

    const todos = api.root.addResource('todos');
    todos.addMethod('POST', new apigateway.LambdaIntegration(createTodoFunction));
    todos.addMethod('GET', new apigateway.LambdaIntegration(getTodosFunction));

    const todoById = todos.addResource('{id}'); // /todos/{id}
    todoById.addMethod('GET', new apigateway.LambdaIntegration(getTodoByIdFunction));
    todoById.addMethod('PUT', new apigateway.LambdaIntegration(updateTodoFunction));
    todoById.addMethod('DELETE', new apigateway.LambdaIntegration(deleteTodoFunction));

    // CloudWatch Alarm
    new cloudwatch.Alarm(this, 'CreateTodoErrorAlarm', {
        metric: createTodoFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
        threshold: 5,
        evaluationPeriods: 1,
        alarmName: 'CreateTodoFunction-High-Error-Rate',
        alarmDescription: 'createTodoFunctionのエラー率が高い場合にトリガーされます。',
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }
}
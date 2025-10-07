import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as CdkStudy from '../lib/cdk-study-stack';

test('TODO App Resources Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new CdkStudy.CdkStudyStack(app, 'MyTestStack');
  // THEN
  const template = Template.fromStack(stack);

  // DynamoDBテーブルのテスト
  template.hasResourceProperties('AWS::DynamoDB::Table', {
    KeySchema: [
      {
        AttributeName: 'id',
        KeyType: 'HASH'
      }
    ]
  });

  // Lambda関数のテスト
  template.hasResourceProperties('AWS::Lambda::Function', {
    Runtime: 'nodejs20.x',
    Handler: 'index.handler'
  });

  // API Gatewayのテスト (POST /todos があるか)
  template.hasResourceProperties('AWS::ApiGateway::Method', {
    HttpMethod: 'POST'
  });
});
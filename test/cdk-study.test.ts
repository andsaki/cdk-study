import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as CdkStudy from '../lib/cdk-study-stack';

test('TODO App Resources Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new CdkStudy.CdkStudyStack(app, 'MyTestStack');
  // THEN
  const template = Template.fromStack(stack);

  // DynamoDBテーブルが1つ存在すること
  template.resourceCountIs('AWS::DynamoDB::Table', 1);

  // Lambda関数が2つ存在すること (Create, Get)
  template.resourceCountIs('AWS::Lambda::Function', 2);

  // API GatewayにPOSTとGETメソッドが存在すること
  template.hasResourceProperties('AWS::ApiGateway::Method', {
    HttpMethod: 'POST'
  });
  template.hasResourceProperties('AWS::ApiGateway::Method', {
    HttpMethod: 'GET'
  });
});
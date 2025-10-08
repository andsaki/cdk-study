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

  // Lambda関数が5つ存在すること (Create, GetList, GetOne, Update, Delete)
  template.resourceCountIs('AWS::Lambda::Function', 5);

  // API Gatewayのメソッドが5つ存在すること (POST, GET, GET, PUT, DELETE)
  template.resourceCountIs('AWS::ApiGateway::Method', 5);

  // CloudWatchアラームが1つ存在すること
  template.resourceCountIs('AWS::CloudWatch::Alarm', 1);
});
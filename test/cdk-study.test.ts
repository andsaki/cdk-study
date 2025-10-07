// AWS CDKのコアライブラリをインポートします。
import * as cdk from 'aws-cdk-lib';
// アサーション（テストの検証）用のテンプレートライブラリをインポートします。
import { Template } from 'aws-cdk-lib/assertions';
// テスト対象のスタック（lib/cdk-study-stack.ts）をインポートします。
import * as CdkStudy from '../lib/cdk-study-stack';

// TODOアプリ用のテストをここに追加していきます。
test('DynamoDB Table Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new CdkStudy.CdkStudyStack(app, 'MyTestStack');
  // THEN
  const template = Template.fromStack(stack);

  // 生成されたテンプレートに、指定したパーティションキーを持つDynamoDBテーブルが存在するかを検証します。
  template.hasResourceProperties('AWS::DynamoDB::Table', {
    KeySchema: [
      {
        AttributeName: 'id',
        KeyType: 'HASH' // HASH = Partition key
      }
    ]
  });
});
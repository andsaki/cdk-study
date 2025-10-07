import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// DynamoDBモジュールをインポートします
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

// cdk.Stackを継承したCdkStudyStackクラスを定義します。
// このクラスがCloudFormationスタックに相当します。
export class CdkStudyStack extends cdk.Stack {
  // コンストラクタ: このスタックがインスタンス化されるときに呼び出されます。
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ここに、このスタックを構成するAWSリソースを定義していきます。

    // DynamoDBテーブルの定義
    const table = new dynamodb.Table(this, 'TodoTable', {
      // パーティションキー（主キー）の設定
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      // スタック削除時にテーブルも削除する設定 (学習用)
      // 本番環境ではデータを保持するために cdk.RemovalPolicy.RETAIN を使用することが多いです。
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
  }
}
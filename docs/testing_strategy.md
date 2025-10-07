# テスト戦略

このプロジェクトでは、`jest` と `aws-cdk-lib/assertions` を使用して、インフラストラクチャの単体テストを行っています。

テストコードは `test/cdk-study.test.ts` にあります。

## `Template` オブジェクトとは？

テストの中心となるのが `Template` オブジェクトです。

```typescript
import { Template } from 'aws-cdk-lib/assertions';
// ...
const template = Template.fromStack(stack);
```

これはJestの機能ではなく、**AWS CDK付属のテスト用ライブラリ**の機能です。

`template` オブジェクトは、「**CDKスタックが生成するCloudFormationテンプレート（インフラの設計図）を、テスト可能な形式で表現したもの**」です。

### 仕組み

1.  `Template.fromStack(stack)` を呼び出すと、CDKはスタックのコードを内部で実行します。
2.  その結果として生成される**CloudFormationテンプレート（JSON形式の設計図）**を、`template` というオブジェクトとしてメモリ上に作成します。
3.  この `template` オブジェクトのメソッド（`hasResourceProperties` や `resourceCountIs` など）を使い、「設計図に、期待通りのリソースが、期待通りの設定で含まれているか？」を検証します。

### 家づくりの例え

このテスト手法は、家を建てる前に**建築用の設計図**をチェックするのに似ています。`template` がその設計図にあたります。「ちゃんと寝室は2つあるか？」「キッチンの設定は正しいか？」といったことを、実際に家を建て始める（デプロイする）前に確認できるのが、このテストの大きな利点です。
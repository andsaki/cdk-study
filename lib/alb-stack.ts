import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as path from 'path';

/**
 * ALB (Application Load Balancer) を使用したアーキテクチャの学習用スタック。
 *
 * このスタックでは以下を学べます：
 * - VPC (Virtual Private Cloud) の構築
 * - ALB (Application Load Balancer) の設定
 * - ECS Fargate (サーバーレスコンテナ) の使用
 * - セキュリティグループによるネットワーク制御
 * - ターゲットグループとヘルスチェック
 *
 * アーキテクチャ:
 * ユーザー → ALB (Public Subnet) → ECS Fargate (Private Subnet) → DynamoDB
 *
 * API Gatewayとの違い:
 * - API Gateway: サーバーレス、REST API向け、リクエスト課金
 * - ALB: コンテナ/EC2向け、時間課金、WebSocket対応、パスベースルーティング
 */
export class AlbStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // VPC (Virtual Private Cloud)
    // ========================================

    /**
     * VPC - プライベートなネットワーク空間を作成します。
     *
     * VPCの役割:
     * - AWSアカウント内に論理的に分離されたネットワークを作成
     * - リソース間の通信を制御
     * - インターネットとの接続を管理
     *
     * maxAzs: 2 - 2つのアベイラビリティゾーン（AZ）を使用
     * - AZ: 物理的に分離されたデータセンター
     * - 複数AZを使うことで、1つのAZが障害でも継続稼働（高可用性）
     *
     * natGateways: 1 - NAT Gatewayを1つ作成
     * - Private Subnetのリソースがインターネットにアクセスするためのゲートウェイ
     * - 本番環境では冗長化のため各AZに1つずつ配置推奨（コスト増）
     *
     * subnetConfiguration:
     * - Public Subnet: インターネットから直接アクセス可能（ALB配置用）
     * - Private Subnet: インターネットから直接アクセス不可（ECS配置用）
     *   NAT Gateway経由でインターネットにアクセス可能（外部APIへのリクエスト等）
     */
    const vpc = new ec2.Vpc(this, 'AlbVpc', {
      maxAzs: 2,  // 2つのアベイラビリティゾーンを使用（高可用性）
      natGateways: 1,  // NAT Gateway 1つ（本番環境では2推奨）
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,  // ALB配置用
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,  // ECS配置用
        },
      ],
    });

    // ========================================
    // ECS Cluster
    // ========================================

    /**
     * ECS Cluster - コンテナを実行するための論理的なグループ。
     *
     * ECS (Elastic Container Service) とは:
     * - Dockerコンテナを簡単にデプロイ・管理できるサービス
     * - Fargateを使えば、サーバー管理不要でコンテナを実行可能
     *
     * containerInsights: true - Container Insightsを有効化
     * - CloudWatchでコンテナのメトリクス（CPU、メモリ等）を可視化
     * - パフォーマンス監視とトラブルシューティングに有用
     */
    const cluster = new ecs.Cluster(this, 'AlbCluster', {
      vpc,
      clusterName: 'todo-alb-cluster',
      containerInsights: true,  // CloudWatch Container Insightsを有効化
    });

    // ========================================
    // ECS Task Definition (Fargate)
    // ========================================

    /**
     * Fargate Task Definition - コンテナの実行設定を定義します。
     *
     * Fargateとは:
     * - サーバーレスなコンテナ実行環境
     * - EC2インスタンスの管理が不要
     * - 必要なCPU/メモリを指定するだけで実行可能
     *
     * EC2起動タイプとの違い:
     * - EC2: EC2インスタンスを自分で管理、きめ細かい制御が可能
     * - Fargate: インスタンス管理不要、シンプル、若干コスト高
     *
     * cpu: 256 (.25 vCPU), memoryLimitMiB: 512 (0.5 GB)
     * - 小規模アプリ向けの最小構成
     * - 本番環境では負荷に応じて調整が必要
     *
     * runtimePlatform:
     * - cpuArchitecture: ARM64 - Graviton2プロセッサ使用（x86より低コスト）
     * - operatingSystemFamily: LINUX
     */
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      cpu: 256,  // 0.25 vCPU
      memoryLimitMiB: 512,  // 512 MB
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,  // Graviton2 (低コスト)
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    /**
     * Dockerイメージをビルドしてコンテナに追加します。
     *
     * DockerImageAsset:
     * - ローカルのDockerfileからイメージをビルド
     * - 自動的にECR (Elastic Container Registry) にプッシュ
     * - デプロイ時に最新のイメージが使用される
     *
     * directory: シンプルなNginxベースのTODO APIコンテナを配置予定
     * platform: linux/arm64 - ARM64アーキテクチャ用にビルド
     *
     * portMappings:
     * - containerPort: 3000 - コンテナ内でNode.jsアプリがリッスンするポート
     * - protocol: TCP
     *
     * logging:
     * - CloudWatch Logsにコンテナのログを送信
     * - 保持期間: 1週間（コスト削減のため）
     */
    const containerImage = new ecr_assets.DockerImageAsset(this, 'AppImage', {
      directory: path.join(__dirname, '../alb-app'),
      platform: ecr_assets.Platform.LINUX_ARM64,
    });

    const container = taskDefinition.addContainer('AppContainer', {
      image: ecs.ContainerImage.fromDockerImageAsset(containerImage),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'todo-alb',
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    });

    container.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP,
    });

    // ========================================
    // Security Groups
    // ========================================

    /**
     * Security Group - ファイアウォールのようなもので、インバウンド/アウトバウンドトラフィックを制御します。
     *
     * セキュリティグループの考え方:
     * - デフォルトで全てのトラフィックを拒否
     * - 許可したいトラフィックのみルールを追加
     * - ステートフル: 許可したインバウンドに対するレスポンスは自動的に許可
     *
     * ALB用セキュリティグループ:
     * - インターネットからのHTTP(80), HTTPS(443)を許可
     *
     * ECS用セキュリティグループ:
     * - ALBからのトラフィックのみ許可（ポート3000）
     * - インターネットから直接アクセス不可（Private Subnet内）
     */
    const albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc,
      description: 'Security group for ALB',
      allowAllOutbound: true,  // 外向きトラフィックは全て許可（ECSへの通信等）
    });

    // ALBへのHTTPアクセスを許可（インターネット全体から）
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP from internet'
    );

    // ALBへのHTTPSアクセスを許可（インターネット全体から）
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS from internet'
    );

    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', {
      vpc,
      description: 'Security group for ECS tasks',
      allowAllOutbound: true,  // DynamoDB等へのアクセスのため
    });

    // ECSタスクへはALBからのみアクセス許可
    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(3000),
      'Allow traffic from ALB'
    );

    // ========================================
    // Application Load Balancer
    // ========================================

    /**
     * Application Load Balancer (ALB) - レイヤー7のロードバランサー。
     *
     * ALBの役割:
     * - 複数のターゲット（ECSタスク）にトラフィックを分散
     * - ヘルスチェックで異常なターゲットを自動的に除外
     * - パスベースルーティング（/api → API、/static → 静的コンテンツ等）
     * - SSL/TLS終端（HTTPS通信の暗号化/復号化）
     *
     * internetFacing: true - インターネットからアクセス可能
     * - false の場合は内部ロードバランサー（VPC内部からのみアクセス可）
     *
     * vpc.publicSubnets - Public Subnetに配置
     * - インターネットゲートウェイ経由でアクセス可能
     *
     * deletionProtection: false - 学習用のため削除保護は無効
     * - 本番環境では true にして誤削除を防止
     */
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: true,  // インターネットからアクセス可能
      securityGroup: albSecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,  // Public Subnetに配置
      },
      deletionProtection: false,  // 学習用のため削除保護は無効
    });

    /**
     * ALB Listener - ALBが受け付けるポートとプロトコルを定義します。
     *
     * port: 80 - HTTPリクエストをリッスン
     * defaultAction: 404を返す（ルールにマッチしない場合）
     *
     * 本番環境では:
     * - HTTPS (443) リスナーを追加
     * - ACM (AWS Certificate Manager) で証明書を発行
     * - HTTP → HTTPS リダイレクトを設定
     */
    const listener = alb.addListener('HttpListener', {
      port: 80,
      open: true,  // インターネットからアクセス可能
    });

    // ========================================
    // ECS Fargate Service
    // ========================================

    /**
     * Fargate Service - ECSタスクを実行・管理するサービス。
     *
     * サービスの役割:
     * - 指定された数のタスクを常に実行
     * - タスクが異常終了した場合、自動的に再起動
     * - デプロイ時のローリングアップデート
     * - Auto Scaling（負荷に応じてタスク数を増減）
     *
     * desiredCount: 2 - 常時2つのタスクを実行
     * - 1つのタスクが異常終了しても、もう1つで継続稼働（高可用性）
     * - AZ障害時にも片方のAZで稼働継続
     *
     * assignPublicIp: false - Private Subnetに配置、パブリックIPは不要
     * - ALB経由でのみアクセス可能
     * - NAT Gateway経由で外部APIにアクセス可能
     *
     * healthCheckGracePeriod:
     * - コンテナ起動後、ヘルスチェックを開始するまでの猶予期間
     * - アプリの起動に時間がかかる場合は延長が必要
     */
    const service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition,
      desiredCount: 1,  // 初期は1タスク（Auto Scalingで増減）
      minHealthyPercent: 50,  // デプロイ時、最低50%のタスクを維持
      maxHealthyPercent: 200,  // デプロイ時、最大200%まで許可（ローリングアップデート）
      assignPublicIp: false,  // Private Subnetに配置
      securityGroups: [ecsSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,  // Private Subnetに配置
      },
      healthCheckGracePeriod: cdk.Duration.seconds(60),  // ヘルスチェック猶予期間
    });

    /**
     * Target Group - ALBがトラフィックを転送する先のグループ。
     *
     * ターゲットグループの設定:
     * - port: 3000 - コンテナのポート
     * - protocol: HTTP
     * - targets: [service] - ECS Serviceを登録
     *
     * ヘルスチェック:
     * - path: '/health' - ヘルスチェックエンドポイント
     * - interval: 30秒ごとにチェック
     * - timeout: 5秒以内に応答がない場合は失敗
     * - healthyThresholdCount: 2 - 2回連続成功で正常と判断
     * - unhealthyThresholdCount: 3 - 3回連続失敗で異常と判断
     *
     * ヘルスチェックが失敗したターゲット:
     * - ALBは自動的にトラフィックを送信停止
     * - ECSサービスは新しいタスクを起動
     */
    listener.addTargets('EcsTarget', {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),  // ターゲット削除時の待機時間
    });

    // ========================================
    // Auto Scaling
    // ========================================

    /**
     * Auto Scaling - 負荷に応じてタスク数を自動調整します。
     *
     * Auto Scalingの利点:
     * - 負荷が低い時はタスク数を減らしてコスト削減
     * - 負荷が高い時は自動的にタスク数を増やしてパフォーマンス維持
     * - 手動でタスク数を調整する必要がない
     *
     * minCapacity: 1 - 最低1タスクは常時稼働
     * maxCapacity: 10 - 最大10タスクまで自動増加
     *
     * スケーリングポリシー:
     * 1. CPU使用率ベース: CPU 70%超えたら増加、30%下回ったら減少
     * 2. メモリ使用率ベース: メモリ 80%超えたら増加、40%下回ったら減少
     *
     * scaleInCooldown/scaleOutCooldown:
     * - スケーリング後、次のスケーリングまでの待機時間
     * - 頻繁なスケーリングを防ぐ（コスト最適化）
     */
    const scaling = service.autoScaleTaskCount({
      minCapacity: 1,  // 最低1タスク
      maxCapacity: 10,  // 最大10タスク
    });

    // CPU使用率が70%を超えたらスケールアウト（タスク増加）
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),   // スケールイン後60秒待機
      scaleOutCooldown: cdk.Duration.seconds(60),  // スケールアウト後60秒待機
    });

    // メモリ使用率が80%を超えたらスケールアウト
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // ========================================
    // Outputs
    // ========================================

    /**
     * デプロイ後にALBのURLを出力します。
     * このURLにアクセスすると、ECSで動作しているアプリにアクセスできます。
     */
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: `http://${alb.loadBalancerDnsName}`,
      description: 'URL of the Application Load Balancer',
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      description: 'VPC ID for reference',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      description: 'ECS Cluster name',
    });
  }
}


import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import { SecretValue } from 'aws-cdk-lib';

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // This is a placeholder for the GitHub repository owner
    const githubOwner = process.env.GITHUB_OWNER || 'YOUR_GITHUB_USERNAME';
    const githubRepo = 'cdk-study';
    const connectionArn = process.env.CODESTAR_CONNECTION_ARN || 'arn:aws:codestar-connections:us-east-1:123456789012:connection/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

    const sourceOutput = new codepipeline.Artifact();

    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'CdkStudyPipeline',
      crossAccountKeys: false,
    });

    // 1. Source Stage
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.CodeStarConnectionsSourceAction({
          actionName: 'GitHub_Source',
          owner: githubOwner,
          repo: githubRepo,
          branch: 'main',
          connectionArn: connectionArn,
          output: sourceOutput,
        }),
      ],
    });

    // 2. Build Stage
    const buildOutput = new codepipeline.Artifact();
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: [
              'npm install -g aws-cdk',
              'npm install',
              'cd frontend && npm install',
            ],
          },
          build: {
            commands: [
              'npm run test',
              'cd frontend && npm run build',
              'cd ..',
              'cdk synth',
            ],
          },
        },
        artifacts: {
          'base-directory': 'cdk.out',
          files: '**/*',
        },
      }),
    });

    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'CDK_Build',
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });

    // 3. Deploy Stage
    pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new codepipeline_actions.CloudFormationCreateUpdateStackAction({
          actionName: 'Deploy_App',
          stackName: 'CdkStudyStack',
          templatePath: buildOutput.atPath('CdkStudyStack.template.json'),
          adminPermissions: true,
        }),
      ],
    });
  }
}

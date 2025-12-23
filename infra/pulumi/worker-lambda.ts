import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as path from 'path';

export function createWorkerLambda(
  role: aws.iam.Role,
  table: aws.dynamodb.Table
): aws.lambda.Function {
  // Path to the Worker Lambda code
  const workerLambdaPath = path.join(__dirname, '../../services/worker');
  
  // Package the Lambda code directory
  const lambdaCode = new pulumi.asset.FileArchive(workerLambdaPath);

  const lambdaFunction = new aws.lambda.Function('worker-lambda', {
    name: 'wfg-worker-lambda',
    runtime: 'nodejs18.x',
    handler: 'dist/handler.handler',
    role: role.arn,
    code: lambdaCode,
    timeout: 60, // 30s processing + buffer
    memorySize: 256,
    environment: {
      variables: {
        TRANSACTIONS_TABLE_NAME: table.name
      }
    },
    tags: {
      Environment: 'dev',
      ManagedBy: 'Pulumi'
    }
  });

  return lambdaFunction;
}


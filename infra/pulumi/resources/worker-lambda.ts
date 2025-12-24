import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as path from 'node:path';

class WorkerLambda {
  workerLambda: aws.lambda.Function;

  constructor(
    stack: string,
    role: aws.iam.Role,
    table: aws.dynamodb.Table
  ) {
    // Path to the Worker Lambda code
    const workerLambdaPath = path.join(__dirname, '../../../services/worker');
    
    // Package the Lambda code directory
    const lambdaCode = new pulumi.asset.FileArchive(workerLambdaPath);

    this.workerLambda = new aws.lambda.Function(
      `worker-lambda-${stack}`,
      {
        name: `wfg-worker-lambda-${stack}`,
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
          Name: `wfg-worker-lambda-${stack}`,
          Environment: stack,
          ManagedBy: 'Pulumi'
        }
      }
    );
  }
}

export default WorkerLambda;


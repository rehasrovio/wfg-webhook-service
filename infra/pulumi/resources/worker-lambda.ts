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
    // Path to the Worker Lambda directories
    const workerLambdaPath = path.join(__dirname, '../../../services/worker');
    const workerLambdaDistPath = path.join(workerLambdaPath, 'dist');
    const workerLambdaNodeModulesPath = path.join(workerLambdaPath, 'node_modules');
    
    // Package the entire dist directory (includes services/worker and shared)
    // The compiled structure will be: dist/services/worker/handler.js and dist/shared/types.js
    const lambdaCode = new pulumi.asset.AssetArchive({
      'services': new pulumi.asset.FileArchive(path.join(workerLambdaDistPath, 'services')),
      'shared': new pulumi.asset.FileArchive(path.join(workerLambdaDistPath, 'shared')),
      'node_modules': new pulumi.asset.FileArchive(workerLambdaNodeModulesPath),
    });

    this.workerLambda = new aws.lambda.Function(
      `worker-lambda-${stack}`,
      {
        name: `wfg-worker-lambda-${stack}`,
        runtime: 'nodejs20.x',
        handler: 'services/worker/handler.handler',
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


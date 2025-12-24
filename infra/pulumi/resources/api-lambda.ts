import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as path from 'node:path';

class ApiLambda {
  apiLambda: aws.lambda.Function;

  constructor(
    stack: string,
    role: aws.iam.Role,
    table: aws.dynamodb.Table,
    workerLambdaArn: pulumi.Output<string>
  ) {
    // Path to the API Lambda directories
    const apiLambdaPath = path.join(__dirname, '../../../services/api');
    const apiLambdaDistPath = path.join(apiLambdaPath, 'dist');
    const apiLambdaNodeModulesPath = path.join(apiLambdaPath, 'node_modules');
    
    // Package the entire dist directory (includes services/api and shared)
    // The compiled structure will be: dist/services/api/handler.js and dist/shared/types.js
    const lambdaCode = new pulumi.asset.AssetArchive({
      'services': new pulumi.asset.FileArchive(path.join(apiLambdaDistPath, 'services')),
      'shared': new pulumi.asset.FileArchive(path.join(apiLambdaDistPath, 'shared')),
      'node_modules': new pulumi.asset.FileArchive(apiLambdaNodeModulesPath),
    });

    this.apiLambda = new aws.lambda.Function(
      `api-lambda-${stack}`,
      {
        name: `wfg-api-lambda-${stack}`,
        runtime: 'nodejs20.x',
        handler: 'services/api/main.handler',
        role: role.arn,
        code: lambdaCode,
        timeout: 10,
        memorySize: 256,
        environment: {
          variables: {
            TRANSACTIONS_TABLE_NAME: table.name,
            WORKER_LAMBDA_NAME: workerLambdaArn.apply(arn => {
              // Extract function name from ARN: arn:aws:lambda:region:account:function:name
              const parts = arn.split(':');
              return parts[parts.length - 1];
            })
          }
        },
        tags: {
          Name: `wfg-api-lambda-${stack}`,
          Environment: stack,
          ManagedBy: 'Pulumi'
        }
      }
    );
  }
}

export default ApiLambda;

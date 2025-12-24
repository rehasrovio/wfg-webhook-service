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
    // Path to the API Lambda code
    const apiLambdaPath = path.join(__dirname, '../../../services/api');
    
    // Package the Lambda code directory
    const lambdaCode = new pulumi.asset.FileArchive(apiLambdaPath);

    this.apiLambda = new aws.lambda.Function(
      `api-lambda-${stack}`,
      {
        name: `wfg-api-lambda-${stack}`,
        runtime: 'nodejs18.x',
        handler: 'dist/handler.handler',
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

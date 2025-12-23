import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as path from 'path';

export function createAPILambda(
  role: aws.iam.Role,
  table: aws.dynamodb.Table,
  workerLambdaArn: pulumi.Output<string>
): aws.lambda.Function {
  // Path to the API Lambda code (use dist if built, otherwise source)
  const apiLambdaPath = path.join(__dirname, '../../services/api');
  
  // Package the Lambda code directory
  const lambdaCode = new pulumi.asset.FileArchive(apiLambdaPath);

  const lambdaFunction = new aws.lambda.Function('api-lambda', {
    name: 'wfg-api-lambda',
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
      Environment: 'dev',
      ManagedBy: 'Pulumi'
    }
  });

  return lambdaFunction;
}


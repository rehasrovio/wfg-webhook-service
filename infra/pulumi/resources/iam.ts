import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

class WorkerLambdaRole {
  workerLambdaRole: aws.iam.Role;

  constructor(
    stack: string,
    table: aws.dynamodb.Table
  ) {
    this.workerLambdaRole = new aws.iam.Role(
      `worker-lambda-role-${stack}`,
      {
        assumeRolePolicy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [{
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' }
          }]
        })
      }
    );

    new aws.iam.RolePolicyAttachment(
      `worker-lambda-basic-${stack}`,
      {
        role: this.workerLambdaRole.name,
        policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
      }
    );

    new aws.iam.RolePolicy(
      `worker-lambda-dynamodb-${stack}`,
      {
        role: this.workerLambdaRole.name,
        policy: pulumi.all([table.arn]).apply(([tableArn]) => JSON.stringify({
          Version: '2012-10-17',
          Statement: [{
            Effect: 'Allow',
            Action: ['dynamodb:UpdateItem'],
            Resource: tableArn
          }]
        }))
      }
    );
  }
}

class ApiLambdaRole {
  apiLambdaRole: aws.iam.Role;

  constructor(
    stack: string,
    table: aws.dynamodb.Table,
    workerLambdaArn: pulumi.Output<string>
  ) {
    this.apiLambdaRole = new aws.iam.Role(
      `api-lambda-role-${stack}`,
      {
        assumeRolePolicy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [{
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' }
          }]
        })
      }
    );

    // Basic Lambda execution
    new aws.iam.RolePolicyAttachment(
      `api-lambda-basic-${stack}`,
      {
        role: this.apiLambdaRole.name,
        policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
      }
    );

    // DynamoDB access
    new aws.iam.RolePolicy(
      `api-lambda-dynamodb-${stack}`,
      {
        role: this.apiLambdaRole.name,
        policy: pulumi.all([table.arn]).apply(([tableArn]) => JSON.stringify({
          Version: '2012-10-17',
          Statement: [{
            Effect: 'Allow',
            Action: [
              'dynamodb:PutItem',
              'dynamodb:GetItem',
              'dynamodb:UpdateItem'
            ],
            Resource: tableArn
          }]
        }))
      }
    );

    // Lambda invoke permission (restricted to worker lambda)
    new aws.iam.RolePolicy(
      `api-lambda-invoke-${stack}`,
      {
        role: this.apiLambdaRole.name,
        policy: pulumi.all([workerLambdaArn]).apply(([lambdaArn]) => JSON.stringify({
          Version: '2012-10-17',
          Statement: [{
            Effect: 'Allow',
            Action: 'lambda:InvokeFunction',
            Resource: lambdaArn
          }]
        }))
      }
    );
  }
}

export { WorkerLambdaRole, ApiLambdaRole };

import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

export function createAPILambdaRole(table: aws.dynamodb.Table, workerLambdaArn: pulumi.Output<string>) {
  const role = new aws.iam.Role('api-lambda-role', {
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Action: 'sts:AssumeRole',
        Effect: 'Allow',
        Principal: { Service: 'lambda.amazonaws.com' }
      }]
    })
  });

  // Basic Lambda execution
  new aws.iam.RolePolicyAttachment('api-lambda-basic', {
    role: role.name,
    policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
  });

  // DynamoDB access
  new aws.iam.RolePolicy('api-lambda-dynamodb', {
    role: role.name,
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
  });

  // Lambda invoke permission (restricted to worker lambda)
  new aws.iam.RolePolicy('api-lambda-invoke', {
    role: role.name,
    policy: pulumi.all([workerLambdaArn]).apply(([lambdaArn]) => JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Action: 'lambda:InvokeFunction',
        Resource: lambdaArn
      }]
    }))
  });

  return role;
}

export function createWorkerLambdaRole(table: aws.dynamodb.Table) {
  const role = new aws.iam.Role('worker-lambda-role', {
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Action: 'sts:AssumeRole',
        Effect: 'Allow',
        Principal: { Service: 'lambda.amazonaws.com' }
      }]
    })
  });

  new aws.iam.RolePolicyAttachment('worker-lambda-basic', {
    role: role.name,
    policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
  });

  new aws.iam.RolePolicy('worker-lambda-dynamodb', {
    role: role.name,
    policy: pulumi.all([table.arn]).apply(([tableArn]) => JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Action: ['dynamodb:UpdateItem'],
        Resource: tableArn
      }]
    }))
  });

  return role;
}


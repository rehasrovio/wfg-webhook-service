import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { createDynamoDBTable } from './dynamodb';
import { createAPILambdaRole, createWorkerLambdaRole } from './iam';
import { createAPILambda } from './api-lambda';
import { createWorkerLambda } from './worker-lambda';
import { createAPIGateway } from './api-gateway';

// Create DynamoDB table
const transactionsTable = createDynamoDBTable();

// Create Worker Lambda first (needed for API Lambda IAM role)
const workerLambdaRole = createWorkerLambdaRole(transactionsTable);
const workerLambda = createWorkerLambda(workerLambdaRole, transactionsTable);

// Create API Lambda role (needs worker lambda ARN)
const apiLambdaRole = createAPILambdaRole(transactionsTable, workerLambda.arn);

// Create API Lambda
const apiLambda = createAPILambda(apiLambdaRole, transactionsTable, workerLambda.arn);

// Create API Gateway
const apiGateway = createAPIGateway(apiLambda);

// Export outputs
export const apiUrl = pulumi.interpolate`https://${apiGateway.id}.execute-api.${aws.config.region}.amazonaws.com`;
export const tableName = transactionsTable.name;
export const apiLambdaName = apiLambda.name;
export const workerLambdaName = workerLambda.name;

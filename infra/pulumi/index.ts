import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import TransactionsDynamoDb from './resources/dynamodb';
import { WorkerLambdaRole, ApiLambdaRole } from './resources/iam';
import WorkerLambda from './resources/worker-lambda';
import ApiLambda from './resources/api-lambda';
import ApiGateway from './resources/api-gateway';

const stack = pulumi.getStack();

const infra = async () => {
  // Create DynamoDB table
  const transactionsDynamoDb = new TransactionsDynamoDb(stack);
  const transactionsTable = transactionsDynamoDb.transactionsTable;

  // Create Worker Lambda Role (doesn't need worker lambda ARN)
  const workerLambdaRole = new WorkerLambdaRole(stack, transactionsTable);
  
  // Create Worker Lambda
  const workerLambda = new WorkerLambda(
    stack,
    workerLambdaRole.workerLambdaRole,
    transactionsTable
  );

  // Create API Lambda Role (needs worker lambda ARN)
  const apiLambdaRole = new ApiLambdaRole(
    stack,
    transactionsTable,
    workerLambda.workerLambda.arn
  );

  // Create API Lambda
  const apiLambda = new ApiLambda(
    stack,
    apiLambdaRole.apiLambdaRole,
    transactionsTable,
    workerLambda.workerLambda.arn
  );

  // Create API Gateway
  const apiGateway = new ApiGateway(stack, apiLambda.apiLambda);

  return {
    apiUrl: pulumi.interpolate`https://${apiGateway.api.id}.execute-api.${aws.config.region}.amazonaws.com`,
    tableName: transactionsTable.name,
    apiLambdaName: apiLambda.apiLambda.name,
    workerLambdaName: workerLambda.workerLambda.name,
  };
};

export default infra();

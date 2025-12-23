import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { TransactionRequest, HealthCheckResponse, TransactionStatusResponse } from '../shared/types';

// Initialize clients
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const lambdaClient = new LambdaClient({});

const TRANSACTIONS_TABLE_NAME = process.env.TRANSACTIONS_TABLE_NAME!;
const WORKER_LAMBDA_NAME = process.env.WORKER_LAMBDA_NAME!;

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const { method, path } = event.requestContext.http;

  try {
    // Health check endpoint
    if (method === 'GET' && path === '/') {
      return handleHealthCheck();
    }

    // Transaction status endpoint
    if (method === 'GET' && path.startsWith('/v1/transactions/')) {
      // Extract transaction_id from path: /v1/transactions/{transaction_id}
      const pathParts = path.split('/').filter(p => p);
      const transactionId = pathParts[pathParts.length - 1];
      if (!transactionId || transactionId === 'transactions') {
        return createResponse(400, { error: 'Transaction ID is required' });
      }
      return handleGetTransaction(transactionId);
    }

    // Webhook endpoint
    if (method === 'POST' && path === '/v1/webhooks/transactions') {
      return handleWebhook(event);
    }

    return createResponse(404, { error: 'Not found' });
  } catch (error) {
    console.error('Handler error:', error);
    return createResponse(500, { error: 'Internal server error' });
  }
};

function handleHealthCheck(): APIGatewayProxyResultV2 {
  const response: HealthCheckResponse = {
    status: 'HEALTHY',
    current_time: new Date().toISOString()
  };
  return createResponse(200, response);
}

async function handleGetTransaction(transactionId: string): Promise<APIGatewayProxyResultV2> {
  try {
    const getCommand = new GetCommand({
      TableName: TRANSACTIONS_TABLE_NAME,
      Key: { transaction_id: transactionId }
    });

    const result = await dynamoClient.send(getCommand);

    if (!result.Item) {
      return createResponse(404, { error: 'Transaction not found' });
    }

    const response: TransactionStatusResponse = result.Item as TransactionStatusResponse;
    return createResponse(200, response);
  } catch (error) {
    console.error('Error getting transaction:', error);
    return createResponse(500, { error: 'Failed to retrieve transaction' });
  }
}

async function handleWebhook(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    // Parse and validate request body
    if (!event.body) {
      return createResponse(400, { error: 'Request body is required' });
    }

    const transaction: TransactionRequest = JSON.parse(event.body);

    // Validate required fields
    if (!transaction.transaction_id || 
        !transaction.source_account || 
        !transaction.destination_account || 
        !transaction.amount || 
        !transaction.currency) {
      return createResponse(400, { error: 'Missing required fields' });
    }

    // Validate amount is positive number
    if (typeof transaction.amount !== 'number' || transaction.amount <= 0) {
      return createResponse(400, { error: 'Amount must be a positive number' });
    }

    // Attempt conditional insert to DynamoDB (idempotency check)
    const putCommand = new PutCommand({
      TableName: TRANSACTIONS_TABLE_NAME,
      Item: {
        transaction_id: transaction.transaction_id,
        source_account: transaction.source_account,
        destination_account: transaction.destination_account,
        amount: transaction.amount,
        currency: transaction.currency,
        status: 'PROCESSING',
        created_at: new Date().toISOString(),
        processed_at: null
      },
      ConditionExpression: 'attribute_not_exists(transaction_id)' // Idempotency
    });

    try {
      await dynamoClient.send(putCommand);

      // Invoke worker Lambda asynchronously
      await lambdaClient.send(new InvokeCommand({
        FunctionName: WORKER_LAMBDA_NAME,
        InvocationType: 'Event', // Async
        Payload: JSON.stringify(transaction)
      }));

      // Return 202 Accepted immediately
      return createResponse(202, {});
    } catch (error: any) {
      // If ConditionalCheckFailedException → item exists (idempotent)
      if (error.name === 'ConditionalCheckFailedException') {
        // Still return 202 Accepted for idempotent duplicate requests
        return createResponse(202, {});
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    
    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return createResponse(400, { error: 'Invalid JSON in request body' });
    }
    
    return createResponse(500, { error: 'Failed to process webhook' });
  }
}

function createResponse(statusCode: number, body: any): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: Object.keys(body).length === 0 ? '' : JSON.stringify(body)
  };
}


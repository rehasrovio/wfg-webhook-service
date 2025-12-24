import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TransactionRequest } from '../../shared/types';
import { Logger } from './utils/logger';
import { LogEventTypes } from './utils/enums';
import { Context } from 'aws-lambda';
import { randomUUID } from 'node:crypto';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TRANSACTIONS_TABLE_NAME = process.env.TRANSACTIONS_TABLE_NAME!;

export const handler = async (event: any, context?: Context): Promise<void> => {
  // Extract request ID from payload if provided, otherwise use Lambda context
  let requestId: string;
  let transaction: TransactionRequest;
  
  if (typeof event === 'string') {
    const parsed = JSON.parse(event);
    requestId = parsed.requestId || context?.awsRequestId || randomUUID();
    // Remove requestId from transaction object to keep it clean
    const { requestId: _, ...transactionData } = parsed;
    transaction = transactionData as TransactionRequest;
  } else {
    requestId = event.requestId || context?.awsRequestId || randomUUID();
    // Remove requestId from transaction object to keep it clean
    const { requestId: _, ...transactionData } = event;
    transaction = transactionData as TransactionRequest;
  }

  const logger = new Logger();
  await logger.initialize('wfg-webhook-worker');

  try {
    logger.logEvent({
      message: 'Received worker processing request',
      action: LogEventTypes.RECEIVED_WORKER_PROCESSING_REQUEST,
      context: { requestId, transaction_id: transaction.transaction_id },
    });

    if (!transaction.transaction_id) {
      logger.logEvent({
        message: 'Transaction ID is missing from payload',
        action: LogEventTypes.ERROR_WORKER_PROCESSING,
        error: 'Transaction ID is required',
        context: { requestId },
      });
      throw new Error('Transaction ID is required');
    }

    logger.logEvent({
      message: 'Starting transaction processing',
      action: LogEventTypes.WORKER_PROCESSING_STARTED,
      context: { requestId, transaction_id: transaction.transaction_id },
    });

    // Sleep for 30 seconds (simulate processing)
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Update transaction status to PROCESSED
    const updateCommand = new UpdateCommand({
      TableName: TRANSACTIONS_TABLE_NAME,
      Key: { transaction_id: transaction.transaction_id },
      UpdateExpression: 'SET #status = :status, processed_at = :processed_at',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'PROCESSED',
        ':processed_at': new Date().toISOString()
      },
      ConditionExpression: 'attribute_exists(transaction_id)' // Safety check
    });

    try {
      await dynamoClient.send(updateCommand);
      
      logger.logEvent({
        message: 'Transaction processed successfully',
        action: LogEventTypes.WORKER_PROCESSING_COMPLETED,
        context: { requestId, transaction_id: transaction.transaction_id },
      });
    } catch (error: any) {
      // If transaction doesn't exist, log but don't fail (idempotent)
      if (error.name === 'ConditionalCheckFailedException') {
        logger.logEvent({
          message: 'Transaction not found in database (may have been deleted)',
          action: LogEventTypes.ERROR_WORKER_TRANSACTION_NOT_FOUND,
          context: { requestId, transaction_id: transaction.transaction_id },
        });
        return; // Safe to ignore - transaction may have been deleted or never created
      }
      
      // Re-throw other errors to trigger Lambda retry
      logger.logEvent({
        message: 'Failed to update transaction status',
        action: LogEventTypes.ERROR_WORKER_PROCESSING,
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { requestId, transaction_id: transaction.transaction_id },
      });
      throw error;
    }
  } catch (error) {
    logger.logEvent({
      message: 'Error processing transaction in worker',
      action: LogEventTypes.ERROR_WORKER_PROCESSING,
      error: error instanceof Error ? error.message : 'Unknown error',
      context: { requestId },
    });
    
    // Throw error to trigger Lambda retry mechanism
    throw error;
  }
};

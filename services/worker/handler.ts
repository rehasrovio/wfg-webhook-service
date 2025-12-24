import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TransactionRequest } from '../../shared/types';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TRANSACTIONS_TABLE_NAME = process.env.TRANSACTIONS_TABLE_NAME!;

export const handler = async (event: any): Promise<void> => {
  try {
    // Parse transaction from Lambda invocation payload
    const transaction: TransactionRequest = typeof event === 'string' 
      ? JSON.parse(event) 
      : event;

    if (!transaction.transaction_id) {
      throw new Error('Transaction ID is required');
    }

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
      console.log(`Transaction ${transaction.transaction_id} processed successfully`);
    } catch (error: any) {
      // If transaction doesn't exist, log but don't fail (idempotent)
      if (error.name === 'ConditionalCheckFailedException') {
        console.warn(`Transaction ${transaction.transaction_id} not found in database`);
        return; // Safe to ignore - transaction may have been deleted or never created
      }
      // Re-throw other errors to trigger Lambda retry
      throw error;
    }
  } catch (error) {
    console.error('Error processing transaction:', error);
    // Throw error to trigger Lambda retry mechanism
    throw error;
  }
};


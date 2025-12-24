import { HTTPLambdaContext } from '../utils/context-builder';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { CustomApiGatewayError } from '../utils/errors';
import { HttpErrorCode, HttpResponseCode, LogEventTypes } from '../utils/enums';
import { TransactionRequest, TransactionRecord } from '../../../shared/types';

export class TransactionService {
  private readonly logger: any;
  private readonly requestId: string;
  private readonly dynamoClient: DynamoDBDocumentClient;
  private readonly lambdaClient: LambdaClient;
  private readonly TRANSACTIONS_TABLE_NAME: string;
  private readonly WORKER_LAMBDA_NAME: string;

  constructor(context: HTTPLambdaContext) {
    this.logger = context.logger;
    this.requestId = context.requestId;
    this.dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    this.lambdaClient = new LambdaClient({});
    this.TRANSACTIONS_TABLE_NAME = process.env.TRANSACTIONS_TABLE_NAME!;
    this.WORKER_LAMBDA_NAME = process.env.WORKER_LAMBDA_NAME!;
  }

  public async processTransaction(transaction: TransactionRequest): Promise<void> {
    try {
      this.logger.logEvent({
        message: 'Processing transaction',
        action: 'TransactionService.processTransaction',
        context: { requestId: this.requestId, transaction_id: transaction.transaction_id },
      });

      // Attempt conditional insert to DynamoDB (idempotency check)
      const putCommand = new PutCommand({
        TableName: this.TRANSACTIONS_TABLE_NAME,
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
        await this.dynamoClient.send(putCommand);

        this.logger.logEvent({
          message: 'Transaction stored in DynamoDB, invoking worker',
          action: 'TransactionService.processTransaction.stored',
          context: { requestId: this.requestId, transaction_id: transaction.transaction_id },
        });

        // Invoke worker Lambda asynchronously with request ID for tracing
        await this.lambdaClient.send(new InvokeCommand({
          FunctionName: this.WORKER_LAMBDA_NAME,
          InvocationType: 'Event', // Async
          Payload: JSON.stringify({
            ...transaction,
            requestId: this.requestId, // Pass request ID for end-to-end tracing
          })
        }));

        this.logger.logEvent({
          message: 'Worker Lambda invoked successfully',
          action: 'TransactionService.processTransaction.workerInvoked',
          context: { requestId: this.requestId, transaction_id: transaction.transaction_id },
        });
      } catch (error: any) {
        // If ConditionalCheckFailedException → item exists (idempotent)
        if (error.name === 'ConditionalCheckFailedException') {
          this.logger.logEvent({
            message: 'Duplicate transaction detected (idempotent)',
            action: LogEventTypes.ERROR_DUPLICATE_TRANSACTION,
            context: { requestId: this.requestId, transaction_id: transaction.transaction_id },
          });
          // Still return success for idempotent behavior
          return;
        }
        throw error;
      }
    } catch (error) {
      this.logger.logEvent({
        message: 'Failed to process transaction',
        action: 'TransactionService.processTransaction.error',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { requestId: this.requestId, transaction_id: transaction.transaction_id },
      });

      if (error instanceof CustomApiGatewayError) {
        throw error;
      }

      throw new CustomApiGatewayError({
        message: 'Failed to process transaction',
        errorCode: HttpErrorCode.INTERNAL_SERVER_ERROR,
        statusCode: HttpResponseCode.INTERNAL_SERVER_ERROR,
      });
    }
  }

  public async getTransaction(transactionId: string): Promise<TransactionRecord | null> {
    try {
      this.logger.logEvent({
        message: 'Retrieving transaction from DynamoDB',
        action: 'TransactionService.getTransaction',
        context: { requestId: this.requestId, transaction_id: transactionId },
      });

      const getCommand = new GetCommand({
        TableName: this.TRANSACTIONS_TABLE_NAME,
        Key: { transaction_id: transactionId }
      });

      const result = await this.dynamoClient.send(getCommand);

      if (!result.Item) {
        this.logger.logEvent({
          message: 'Transaction not found in DynamoDB',
          action: 'TransactionService.getTransaction.notFound',
          context: { requestId: this.requestId, transaction_id: transactionId },
        });
        return null;
      }

      this.logger.logEvent({
        message: 'Transaction retrieved successfully',
        action: 'TransactionService.getTransaction.success',
        context: { requestId: this.requestId, transaction_id: transactionId },
      });

      return result.Item as TransactionRecord;
    } catch (error) {
      this.logger.logEvent({
        message: 'Failed to retrieve transaction',
        action: 'TransactionService.getTransaction.error',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { requestId: this.requestId, transaction_id: transactionId },
      });

      throw new CustomApiGatewayError({
        message: 'Failed to retrieve transaction',
        errorCode: HttpErrorCode.INTERNAL_SERVER_ERROR,
        statusCode: HttpResponseCode.INTERNAL_SERVER_ERROR,
      });
    }
  }
}


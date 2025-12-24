import { HTTPLambdaContext } from '../utils/context-builder';
import { CustomApiGatewayError } from '../utils/errors';
import { HttpErrorCode, HttpResponseCode, LogEventTypes } from '../utils/enums';
import { ApiGatewayResponse } from '../utils/response';
import { TransactionService } from '../services/transaction.service';
import { TransactionRequest } from '../../../shared/types';

class WebhookHandler {
  static async handleWebhook(lambdaContext: HTTPLambdaContext): Promise<any> {
    const { logger, requestId, event } = lambdaContext;

    try {
      logger.logEvent({
        message: 'Received webhook request',
        action: LogEventTypes.RECEIVED_WEBHOOK_REQUEST,
        context: { requestId },
      });

      // Parse and validate request body
      if (!event.body) {
        logger.logEvent({
          message: 'Request body is missing',
          action: LogEventTypes.ERROR_INVALID_PAYLOAD,
          context: { requestId },
        });

        throw new CustomApiGatewayError({
          message: 'Request body is required',
          errorCode: HttpErrorCode.BAD_REQUEST,
          statusCode: HttpResponseCode.BAD_REQUEST,
        });
      }

      let transaction: TransactionRequest;
      try {
        transaction = JSON.parse(event.body);
      } catch (parseError) {
        logger.logEvent({
          message: 'Invalid JSON in request body',
          action: LogEventTypes.ERROR_INVALID_PAYLOAD,
          error: parseError instanceof Error ? parseError.message : 'Unknown error',
          context: { requestId },
        });

        throw new CustomApiGatewayError({
          message: 'Invalid JSON in request body',
          errorCode: HttpErrorCode.BAD_REQUEST,
          statusCode: HttpResponseCode.BAD_REQUEST,
        });
      }

      // Validate required fields
      if (!transaction.transaction_id || 
          !transaction.source_account || 
          !transaction.destination_account || 
          !transaction.amount || 
          !transaction.currency) {
        logger.logEvent({
          message: 'Missing required fields',
          action: LogEventTypes.ERROR_INVALID_PAYLOAD,
          context: { requestId, transaction_id: transaction.transaction_id },
        });

        throw new CustomApiGatewayError({
          message: 'Missing required fields',
          errorCode: HttpErrorCode.BAD_REQUEST,
          statusCode: HttpResponseCode.BAD_REQUEST,
        });
      }

      // Validate amount is positive number
      if (typeof transaction.amount !== 'number' || transaction.amount <= 0) {
        logger.logEvent({
          message: 'Invalid amount value',
          action: LogEventTypes.ERROR_INVALID_PAYLOAD,
          context: { requestId, transaction_id: transaction.transaction_id, amount: String(transaction.amount) },
        });

        throw new CustomApiGatewayError({
          message: 'Amount must be a positive number',
          errorCode: HttpErrorCode.BAD_REQUEST,
          statusCode: HttpResponseCode.BAD_REQUEST,
        });
      }

      // Process transaction
      const transactionService = new TransactionService(lambdaContext);
      await transactionService.processTransaction(transaction);

      logger.logEvent({
        message: 'Webhook processed successfully',
        action: LogEventTypes.WEBHOOK_PROCESSED_SUCCESS,
        context: { requestId, transaction_id: transaction.transaction_id },
      });

      return ApiGatewayResponse.createAcceptedResponse();
    } catch (error) {
      logger.logEvent({
        message: 'Error processing webhook',
        action: LogEventTypes.ERROR_WEBHOOK_REQUEST,
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { requestId },
      });

      if (error instanceof CustomApiGatewayError) {
        return ApiGatewayResponse.createErrorResponse({
          statusCode: error.statusCode,
          code: error.errorCode,
          message: error.message,
        });
      }

      return ApiGatewayResponse.createErrorResponse({
        statusCode: HttpResponseCode.INTERNAL_SERVER_ERROR,
        code: HttpErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Failed to process webhook',
      });
    }
  }
}

export default WebhookHandler;


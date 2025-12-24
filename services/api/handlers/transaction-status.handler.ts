import { HTTPLambdaContext } from '../utils/context-builder';
import { CustomApiGatewayError } from '../utils/errors';
import { HttpErrorCode, HttpResponseCode, LogEventTypes } from '../utils/enums';
import { ApiGatewayResponse } from '../utils/response';
import { TransactionService } from '../services/transaction.service';

class TransactionStatusHandler {
  static async handleGetTransaction(
    lambdaContext: HTTPLambdaContext,
    transactionId: string
  ): Promise<any> {
    const { logger, requestId } = lambdaContext;

    try {
      logger.logEvent({
        message: 'Received transaction status request',
        action: LogEventTypes.RECEIVED_TRANSACTION_STATUS_REQUEST,
        context: { requestId, transaction_id: transactionId },
      });

      if (!transactionId || transactionId === 'transactions') {
        throw new CustomApiGatewayError({
          message: 'Transaction ID is required',
          errorCode: HttpErrorCode.BAD_REQUEST,
          statusCode: HttpResponseCode.BAD_REQUEST,
        });
      }

      const transactionService = new TransactionService(lambdaContext);
      const transaction = await transactionService.getTransaction(transactionId);

      if (!transaction) {
        logger.logEvent({
          message: 'Transaction not found',
          action: LogEventTypes.ERROR_TRANSACTION_STATUS_REQUEST,
          context: { requestId, transaction_id: transactionId },
        });

        throw new CustomApiGatewayError({
          message: 'Transaction not found',
          errorCode: HttpErrorCode.NOT_FOUND,
          statusCode: HttpResponseCode.NOT_FOUND,
        });
      }

      logger.logEvent({
        message: 'Transaction status retrieved successfully',
        action: LogEventTypes.TRANSACTION_STATUS_RETRIEVED,
        context: { requestId, transaction_id: transactionId, status: transaction.status },
      });

      return ApiGatewayResponse.createSuccessResponse({
        statusCode: HttpResponseCode.OK,
        data: transaction,
      });
    } catch (error) {
      logger.logEvent({
        message: 'Error retrieving transaction status',
        action: LogEventTypes.ERROR_TRANSACTION_STATUS_REQUEST,
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { requestId, transaction_id: transactionId },
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
        message: 'Failed to retrieve transaction',
      });
    }
  }
}

export default TransactionStatusHandler;


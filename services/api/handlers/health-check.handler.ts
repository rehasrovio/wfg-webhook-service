import { HTTPLambdaContext } from '../utils/context-builder';
import { ApiGatewayResponse } from '../utils/response';
import { HttpResponseCode, LogEventTypes } from '../utils/enums';
import { HealthCheckResponse } from '../../../shared/types';

class HealthCheckHandler {
  static async handleHealthCheck(lambdaContext: HTTPLambdaContext): Promise<any> {
    const { logger, requestId } = lambdaContext;

    try {
      logger.logEvent({
        message: 'Received health check request',
        action: LogEventTypes.RECEIVED_HEALTH_CHECK_REQUEST,
        context: { requestId },
      });

      const response: HealthCheckResponse = {
        status: 'HEALTHY',
        current_time: new Date().toISOString()
      };

      logger.logEvent({
        message: 'Health check completed successfully',
        action: LogEventTypes.HEALTH_CHECK_SUCCESS,
        context: { requestId },
      });

      return ApiGatewayResponse.createSuccessResponse({
        statusCode: HttpResponseCode.OK,
        data: response,
      });
    } catch (error) {
      logger.logEvent({
        message: 'Error in health check handler',
        action: LogEventTypes.ERROR_WEBHOOK_REQUEST,
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { requestId },
      });

      return ApiGatewayResponse.createErrorResponse({
        statusCode: HttpResponseCode.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_SERVER_ERROR' as any,
        message: 'Internal server error',
      });
    }
  }
}

export default HealthCheckHandler;


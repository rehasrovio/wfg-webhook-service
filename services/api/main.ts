import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { CustomApiGatewayError } from './utils/errors';
import { HttpErrorCode, HttpResponseCode, LogEventTypes } from './utils/enums';
import { ApiGatewayResponse } from './utils/response';
import { routesMap } from './handlers/handler-map';
import { buildLambdaContext } from './utils/context-builder';

const handleHTTPEvent = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const lambdaContext = await buildLambdaContext(event);
  const { logger, requestId, event: eventContext } = lambdaContext;

  try {
    const { method, path } = eventContext.requestContext.http;
    const routeKey = `${method} ${path}`;

    // Handle transaction status endpoint (dynamic path)
    let handler: any;
    if (method === 'GET' && path.startsWith('/v1/transactions/')) {
      handler = routesMap['GET /v1/transactions/{transaction_id}'];
    } else {
      handler = routesMap[routeKey];
    }

    if (!handler) {
      logger.logEvent({
        message: `No method found for ${routeKey}`,
        action: LogEventTypes.ERROR_NO_METHOD_FOUND,
        context: { routeKey, requestId },
      });

      throw new CustomApiGatewayError({
        message: `No method found for ${routeKey}`,
        errorCode: HttpErrorCode.NO_METHOD_FOUND,
        statusCode: HttpResponseCode.NOT_FOUND,
      });
    }

    logger.logEvent({
      message: 'Received request in WFG Webhook Service',
      action: LogEventTypes.RECEIVED_WEBHOOK_REQUEST,
      context: { routeKey, requestId },
    });

    // Only validate body if the route requires it
    if (handler.requiresBody !== false) {
      if (!eventContext.body || !JSON.parse(eventContext.body)) {
        logger.logEvent({
          message: 'Invalid request payload',
          action: LogEventTypes.ERROR_INVALID_PAYLOAD,
          context: { routeKey, requestId },
        });

        throw new CustomApiGatewayError({
          message: 'Invalid request payload',
          errorCode: HttpErrorCode.BAD_REQUEST,
          statusCode: HttpResponseCode.BAD_REQUEST,
        });
      }
    }

    const response = await handler.handler(lambdaContext);

    return response;
  } catch (error) {
    logger.logEvent({
      message: 'Error in WFG Webhook Service',
      action: LogEventTypes.ERROR_WEBHOOK_REQUEST,
      context: {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      },
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
      message: 'Unknown error',
    });
  }
};

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  return await handleHTTPEvent(event);
};


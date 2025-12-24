import { HTTPLambdaContext } from '../utils/context-builder';
import HealthCheckHandler from './health-check.handler';
import WebhookHandler from './webhook.handler';
import TransactionStatusHandler from './transaction-status.handler';

export interface RouteHandler {
  handler: (lambdaContext: HTTPLambdaContext, ...args: any[]) => Promise<any>;
  requiresBody?: boolean;
}

export const routesMap: Record<string, RouteHandler> = {
  'GET /': {
    handler: HealthCheckHandler.handleHealthCheck,
    requiresBody: false,
  },
  'POST /v1/webhooks/transactions': {
    handler: WebhookHandler.handleWebhook,
    requiresBody: true,
  },
  'GET /v1/transactions/{transaction_id}': {
    handler: (lambdaContext: HTTPLambdaContext) => {
      // Extract transaction_id from path
      const path = lambdaContext.event.requestContext.http.path;
      const pathParts = path.split('/').filter(Boolean);
      const transactionId = pathParts[pathParts.length - 1];
      return TransactionStatusHandler.handleGetTransaction(lambdaContext, transactionId);
    },
    requiresBody: false,
  },
};


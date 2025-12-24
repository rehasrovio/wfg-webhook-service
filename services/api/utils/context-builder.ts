import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { Logger } from './logger';
import { randomUUID } from 'crypto';

export interface HTTPLambdaContext {
  requestId: string;
  logger: Logger;
  event: APIGatewayProxyEventV2;
}

export const buildLambdaContext = async (
  event: APIGatewayProxyEventV2
): Promise<HTTPLambdaContext> => {
  const requestId = randomUUID();
  const logger = new Logger();
  await logger.initialize('wfg-webhook-api');

  return {
    requestId,
    logger,
    event,
  };
};


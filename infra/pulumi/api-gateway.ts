import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

export function createAPIGateway(
  apiLambda: aws.lambda.Function
): aws.apigatewayv2.Api {
  // Create HTTP API
  const api = new aws.apigatewayv2.Api('wfg-api', {
    name: 'wfg-webhook-api',
    protocolType: 'HTTP',
    description: 'WFG Webhook Service API',
    corsConfiguration: {
      allowOrigins: ['*'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      maxAge: 300
    }
  });

  // Create default stage
  const stage = new aws.apigatewayv2.Stage('wfg-api-stage', {
    apiId: api.id,
    name: '$default',
    autoDeploy: true
  });

  // Grant API Gateway permission to invoke Lambda
  const lambdaPermission = new aws.lambda.Permission('api-lambda-permission', {
    action: 'lambda:InvokeFunction',
    function: apiLambda.name,
    principal: 'apigateway.amazonaws.com',
    sourceArn: pulumi.interpolate`${api.executionArn}/*/*`
  });

  // Health check route: GET /
  const healthCheckIntegration = new aws.apigatewayv2.Integration('health-check-integration', {
    apiId: api.id,
    integrationType: 'AWS_PROXY',
    integrationUri: apiLambda.invokeArn,
    payloadFormatVersion: '2.0'
  });

  const healthCheckRoute = new aws.apigatewayv2.Route('health-check-route', {
    apiId: api.id,
    routeKey: 'GET /',
    target: pulumi.interpolate`integrations/${healthCheckIntegration.id}`
  });

  // Webhook route: POST /v1/webhooks/transactions
  const webhookIntegration = new aws.apigatewayv2.Integration('webhook-integration', {
    apiId: api.id,
    integrationType: 'AWS_PROXY',
    integrationUri: apiLambda.invokeArn,
    payloadFormatVersion: '2.0'
  });

  const webhookRoute = new aws.apigatewayv2.Route('webhook-route', {
    apiId: api.id,
    routeKey: 'POST /v1/webhooks/transactions',
    target: pulumi.interpolate`integrations/${webhookIntegration.id}`
  });

  // Transaction status route: GET /v1/transactions/{transaction_id}
  const transactionStatusIntegration = new aws.apigatewayv2.Integration('transaction-status-integration', {
    apiId: api.id,
    integrationType: 'AWS_PROXY',
    integrationUri: apiLambda.invokeArn,
    payloadFormatVersion: '2.0'
  });

  const transactionStatusRoute = new aws.apigatewayv2.Route('transaction-status-route', {
    apiId: api.id,
    routeKey: 'GET /v1/transactions/{transaction_id}',
    target: pulumi.interpolate`integrations/${transactionStatusIntegration.id}`
  });

  return api;
}


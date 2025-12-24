import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

class ApiGateway {
  api: aws.apigatewayv2.Api;
  stage: aws.apigatewayv2.Stage;

  constructor(
    stack: string,
    apiLambda: aws.lambda.Function
  ) {
    // Create HTTP API
    this.api = new aws.apigatewayv2.Api(
      `wfg-api-${stack}`,
      {
        name: `wfg-webhook-api-${stack}`,
        protocolType: 'HTTP',
        description: 'WFG Webhook Service API',
        corsConfiguration: {
          allowOrigins: ['*'],
          allowMethods: ['GET', 'POST', 'OPTIONS'],
          allowHeaders: ['Content-Type', 'Authorization'],
          maxAge: 300
        },
        tags: {
          Name: `wfg-webhook-api-${stack}`,
          Environment: stack,
          ManagedBy: 'Pulumi'
        }
      }
    );

    // Create default stage
    this.stage = new aws.apigatewayv2.Stage(
      `wfg-api-stage-${stack}`,
      {
        apiId: this.api.id,
        name: '$default',
        autoDeploy: true
      }
    );

    // Grant API Gateway permission to invoke Lambda
    new aws.lambda.Permission(
      `api-lambda-permission-${stack}`,
      {
        action: 'lambda:InvokeFunction',
        function: apiLambda.name,
        principal: 'apigateway.amazonaws.com',
        sourceArn: pulumi.interpolate`${this.api.executionArn}/*/*`
      }
    );

    // Health check route: GET /
    const healthCheckIntegration = new aws.apigatewayv2.Integration(
      `health-check-integration-${stack}`,
      {
        apiId: this.api.id,
        integrationType: 'AWS_PROXY',
        integrationUri: apiLambda.invokeArn,
        payloadFormatVersion: '2.0'
      }
    );

    new aws.apigatewayv2.Route(
      `health-check-route-${stack}`,
      {
        apiId: this.api.id,
        routeKey: 'GET /',
        target: pulumi.interpolate`integrations/${healthCheckIntegration.id}`
      }
    );

    // Webhook route: POST /v1/webhooks/transactions
    const webhookIntegration = new aws.apigatewayv2.Integration(
      `webhook-integration-${stack}`,
      {
        apiId: this.api.id,
        integrationType: 'AWS_PROXY',
        integrationUri: apiLambda.invokeArn,
        payloadFormatVersion: '2.0'
      }
    );

    new aws.apigatewayv2.Route(
      `webhook-route-${stack}`,
      {
        apiId: this.api.id,
        routeKey: 'POST /v1/webhooks/transactions',
        target: pulumi.interpolate`integrations/${webhookIntegration.id}`
      }
    );

    // Transaction status route: GET /v1/transactions/{transaction_id}
    const transactionStatusIntegration = new aws.apigatewayv2.Integration(
      `transaction-status-integration-${stack}`,
      {
        apiId: this.api.id,
        integrationType: 'AWS_PROXY',
        integrationUri: apiLambda.invokeArn,
        payloadFormatVersion: '2.0'
      }
    );

    new aws.apigatewayv2.Route(
      `transaction-status-route-${stack}`,
      {
        apiId: this.api.id,
        routeKey: 'GET /v1/transactions/{transaction_id}',
        target: pulumi.interpolate`integrations/${transactionStatusIntegration.id}`
      }
    );
  }
}

export default ApiGateway;

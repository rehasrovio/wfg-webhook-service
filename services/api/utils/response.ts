import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { HttpErrorCode } from './enums';
import { HttpResponseCode } from './enums';

export class ApiGatewayResponse {
  public static createSuccessResponse = <T>({
    statusCode,
    data,
  }: {
    statusCode: number;
    data?: T;
  }): APIGatewayProxyResultV2 => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data ?? {}),
  });

  public static createErrorResponse = ({
    statusCode,
    code,
    message,
    details,
  }: {
    statusCode: HttpResponseCode;
    code: HttpErrorCode;
    message: string;
    details?: { field?: string; message: string }[];
  }): APIGatewayProxyResultV2 => {
    return {
      statusCode,
      body: JSON.stringify({
        code,
        message,
        ...(details && { details }),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  };

  public static createAcceptedResponse = (): APIGatewayProxyResultV2 => {
    return {
      statusCode: HttpResponseCode.ACCEPTED,
      headers: { 'Content-Type': 'application/json' },
      body: '',
    };
  };
}


import { HttpErrorCode } from './enums';
import { HttpResponseCode } from './enums';

export class CustomApiGatewayError extends Error {
  public errorCode: HttpErrorCode;
  public statusCode: HttpResponseCode;

  constructor({
    message,
    errorCode,
    statusCode,
  }: {
    message: string;
    errorCode: HttpErrorCode;
    statusCode: HttpResponseCode;
  }) {
    super(message);
    this.name = 'CustomApiGatewayError';
    this.errorCode = errorCode;
    this.statusCode = statusCode;
  }
}


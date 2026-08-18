import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";

@Catch()
export class HttpExceptionFilter
  implements ExceptionFilter
{
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(
    exception: any,
    host: ArgumentsHost
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception instanceof HttpException
      ? exception.getResponse()
      : null;

    let message = 'Something went wrong';
    let errors: string[] = [];

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      errors = [exceptionResponse];
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const responseBody = exceptionResponse as { message?: string | string[] };
      const responseMessage = responseBody.message;
      errors = Array.isArray(responseMessage)
        ? responseMessage
        : responseMessage
          ? [responseMessage]
          : [];
      message = errors.join(', ') || message;
    } else if (exception?.message) {
      // Unexpected errors were previously hidden behind a generic 500 response.
      message = exception.message;
      errors = [message];
    }

    if (status === HttpStatus.UNAUTHORIZED) {
      message = 'Unauthorized! Please login to access this resource.';
      errors = ['Authentication failed or token expired'];
    }

    this.logger.error(
      `${status} ${message}`,
      exception?.stack || exception,
    );

    response.status(status).json({
      Success: false,
      Message: message,
      Payload: null,
      Errors: errors,
      StatusCode: status,
    });
  }
}
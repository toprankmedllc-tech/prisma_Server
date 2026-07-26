import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";

@Catch()
export class HttpExceptionFilter
  implements ExceptionFilter
{
  catch(
    exception: any,
    host: ArgumentsHost
  ) {
    const ctx =
      host.switchToHttp();

    const response =
      ctx.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : {};

    let message =
      "Something went wrong";

    if (
      typeof exceptionResponse ===
      "object"
    ) {
      message =
        (exceptionResponse as any)
          .message || message;
    }

    response.status(status).json({
      status: "error",
      message,
    });
  }
}
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T = unknown> {
  Success: true;
  Message: string;
  Payload: T | null;
  Errors: string[];
  StatusCode: number;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => ({
        Success: true as const,
        Message: 'Request successful',
        Payload: data ?? null,
        Errors: [],
        StatusCode: response.statusCode,
      })),
    );
  }
}

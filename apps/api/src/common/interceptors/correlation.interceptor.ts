import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

const CORRELATION_HEADER = 'x-correlation-id';

/**
 * Injects a correlation ID into every request/response.
 * Used for distributed tracing and audit log linkage.
 */
@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const correlationId =
      request.headers[CORRELATION_HEADER] || uuidv4();

    // Attach to request for downstream usage (audit, logging)
    request.correlationId = correlationId;

    return next.handle().pipe(
      tap(() => {
        response.setHeader(CORRELATION_HEADER, correlationId);
      }),
    );
  }
}

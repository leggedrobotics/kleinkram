import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { appVersion } from '../../app-version';

@Injectable()
export class AddVersionInterceptor implements NestInterceptor {
    /**
     *
     * Intercepts the request and adds the version of the application to the response headers.
     *
     * @param context
     * @param next
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const response = context.switchToHttp().getResponse();

        // Set headers early, so they are included even if an error occurs
        response.header('kleinkram-version', appVersion);
        response.header('Access-Control-Expose-Headers', 'kleinkram-version');

        return next.handle();
    }
}

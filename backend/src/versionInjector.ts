import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { appVersion } from './main';

@Injectable()
export class AddVersionInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const res = context.switchToHttp().getResponse();

        // Set headers early, so they are included even if an error occurs
        res.header('kleinkram-version', appVersion);
        res.header('Access-Control-Expose-Headers', 'kleinkram-version');

        return next.handle();
    }
}

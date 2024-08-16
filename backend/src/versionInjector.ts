import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import * as fs from 'node:fs';
const packageJson = JSON.parse(
    fs.readFileSync('/usr/src/app/backend/package.json', 'utf8'),
);
const appVersion = packageJson.version;

@Injectable()
export class AddVersionInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            tap(() => {
                const res = context.switchToHttp().getResponse();
                if (!res.finished) {
                    res.header('kleinkram-version', appVersion);
                }
            }),
        );
    }
}

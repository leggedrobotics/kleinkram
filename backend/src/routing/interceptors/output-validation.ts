import {
    CallHandler,
    ExecutionContext,
    Injectable,
    InternalServerErrorException,
    NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { validateSync } from 'class-validator';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { Reflector } from '@nestjs/core';
import logger from '../../logger';

function validateResponseJSON<T extends object>(dto: ClassConstructor<T>) {
    return (data: JSON): JSON => {
        if (dto) {
            const instance: T = plainToInstance(dto, data);
            const errors = validateSync(instance, {
                whitelist: true,
                forbidNonWhitelisted: true,
                forbidUnknownValues: true,
            });

            if (errors.length > 0) {
                logger.error(
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    `Response Validation failed: ${errors.length} errors`,
                );
                logger.error(`In response: `);
                logger.error(JSON.stringify(data, undefined, 2));

                logger.error(`Against DTO: `);
                logger.error(dto.name);

                logger.error(
                    `\n${errors.map((error) => error.toString()).join('\n')}`,
                );
                throw new InternalServerErrorException(
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    `Validation failed: ${errors.length} errors. Check backend logs for details.`,
                );
            }
        }
        return data;
    };
}

/**
 * A global interceptor that validates the response DTOs of all routes.
 *
 * This is slow and should only be used in development mode.
 *
 * This is used to ensure that the API documentation is correct and that the response
 * DTOs are correctly defined, no additional properties are returned and no properties
 * are missing.
 *
 * For every API route you need to define a DTO and pass it using the
 * @OutputDto decorator, e.g. @OutputDto(CurrentAPIUserDto) to validate
 * against the CurrentAPIUserDto.
 *
 *
 */
@Injectable()
export class GlobalResponseValidationInterceptor implements NestInterceptor {
    constructor(private reflector: Reflector) {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const target = context.getHandler();
        const dto = this.reflector.get('outputDto', target);

        if (dto === null) return next.handle(); // explicitly disabled

        // enforce that a DTO must be defined uns
        if (dto === undefined)
            throw new InternalServerErrorException('No DTO defined');

        return next.handle().pipe(map(validateResponseJSON(dto)));
    }
}

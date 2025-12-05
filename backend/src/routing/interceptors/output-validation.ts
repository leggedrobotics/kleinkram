import {
    CallHandler,
    ExecutionContext,
    Injectable,
    InternalServerErrorException,
    NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import logger from '../../logger';

function validateResponseJSON<T extends object>(dto: ClassConstructor<T>) {
    return (data: JSON): JSON => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (dto) {
            const isArray = Array.isArray(dto);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const cls = isArray ? dto[0] : dto;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const instance: T = plainToInstance(cls, data);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let errors: any[] = [];
            if (Array.isArray(instance)) {
                for (const item of instance) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    const itemErrors = validateSync(item, {
                        whitelist: true,
                        forbidNonWhitelisted: true,
                        forbidUnknownValues: true,
                    });
                    errors.push(...itemErrors);
                }
            } else {
                errors = validateSync(instance as object, {
                    whitelist: true,
                    forbidNonWhitelisted: true,
                    forbidUnknownValues: true,
                });
            }

            if (errors.length > 0) {
                logger.error(
                    `Response Validation failed: ${errors.length.toString()} errors`,
                );
                logger.error(`In response: `);
                logger.error(JSON.stringify(data, undefined, 2));

                logger.error(`Against DTO: `);
                logger.error(dto.name);

                logger.error(
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    `\n${errors.map((error) => error.toString()).join('\n')}`,
                );
                throw new InternalServerErrorException(
                    `Validation failed: ${errors.length.toString()} errors. Check backend logs for details.`,
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const dto = this.reflector.get('outputDto', target);

        if (dto === null) return next.handle(); // explicitly disabled

        // enforce that a DTO must be defined uns
        if (dto === undefined)
            throw new InternalServerErrorException(
                `No output DTO defined for route ${target.name}.`,
            );

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return next.handle().pipe(map(validateResponseJSON(dto)));
    }
}

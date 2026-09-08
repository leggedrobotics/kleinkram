import { applyDecorators, SetMetadata } from '@nestjs/common';
import {
    ApiResponseCommonMetadata,
    ApiCreatedResponse as SwaggerApiCreatedResponse,
    ApiOkResponse as SwaggerApiOkResponse,
    ApiResponse as SwaggerApiResponse,
} from '@nestjs/swagger';
import { Request } from 'express';

export interface DynamicDtoResolver {
    resolver: (request: Request) => unknown;
}

export const OutputDto = (
    dto: ApiResponseCommonMetadata['type'] | null | DynamicDtoResolver,
): ReturnType<typeof applyDecorators> => SetMetadata('outputDto', dto);

/**
 * Decorator to define the response DTO for a route.
 *
 * It sets both the @OutputDto decorator and the @ApiOkResponse decorator from
 * the Swagger module.
 *
 */
export const ApiOkResponse = (
    options: ApiResponseCommonMetadata & {
        resolver?: (request: Request) => unknown;
    },
): ReturnType<typeof applyDecorators> =>
    applyDecorators(
        OutputDto(
            options.resolver ? { resolver: options.resolver } : options.type,
        ),
        SwaggerApiOkResponse(options),
    );

export const ApiCreatedResponse = (
    options: ApiResponseCommonMetadata & {
        resolver?: (request: Request) => unknown;
    },
): ReturnType<typeof applyDecorators> =>
    applyDecorators(
        OutputDto(
            options.resolver ? { resolver: options.resolver } : options.type,
        ),
        SwaggerApiCreatedResponse(options),
    );

export const ApiResponse = (
    options: ApiResponseCommonMetadata,
): ReturnType<typeof applyDecorators> =>
    applyDecorators(SwaggerApiResponse(options));

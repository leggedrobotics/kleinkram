import { applyDecorators, SetMetadata } from '@nestjs/common';
import {
    ApiOkResponse as SwaggerApiOkResponse,
    ApiResponseCommonMetadata,
} from '@nestjs/swagger';

export const OutputDto = (
    dto: ApiResponseCommonMetadata['type'] | null,
): ReturnType<typeof applyDecorators> => SetMetadata('outputDto', dto);

/**
 * Decorator to define the response DTO for a route.
 *
 * It sets both the @OutputDto decorator and the @ApiOkResponse decorator from
 * the Swagger module.
 *
 */
export const ApiOkResponse = (
    options: ApiResponseCommonMetadata,
): ReturnType<typeof applyDecorators> =>
    applyDecorators(OutputDto(options.type), SwaggerApiOkResponse(options));

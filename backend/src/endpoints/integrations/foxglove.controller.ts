import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { OutputDto } from '../../decarators';
import { FoxgloveService } from '../../services/foxglove.service';
import { ParameterUuid } from '../../validation/parameter-decorators';

@Controller('integrations/foxglove')
export class FoxgloveController {
    constructor(private readonly foxgloveService: FoxgloveService) {}

    @Get(':uuid/:filename')
    @ApiResponse({
        description: '302 Redirect to actual file URL',
        status: 302,
    })
    // eslint-disable-next-line unicorn/no-null
    @OutputDto(null) // No response body, just a redirect
    // No @LoggedIn() guard here! The signature IS the guard.
    async proxyFoxglove(
        @ParameterUuid('uuid') uuid: string,
        @Query('expires') expires: string,
        @Query('signature') signature: string,
        @Query('u') userUuid: string,
        @Res() response: Response,
    ): Promise<void> {
        const resolvedFileUrl = await this.foxgloveService.resolveRedirectUrl(
            uuid,
            Number(expires),
            signature,
            userUuid,
        );

        // Foxglove requires CORS headers on the redirect response
        response.header('Access-Control-Allow-Origin', 'app.foxglove.dev');
        response.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

        // 302 Redirect to MinIO
        response.redirect(resolvedFileUrl);
    }
}

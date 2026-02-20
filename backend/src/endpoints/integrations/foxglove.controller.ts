import { OutputDto } from '@/decorators';
import { FoxgloveService } from '@/services/foxglove.service';
import { ParameterUuid } from '@/validation/parameter-decorators';
import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';

@Controller('integrations/foxglove')
export class FoxgloveController {
    // Whitelist for this specific controller
    // see https://docs.foxglove.dev/docs/visualization/connecting/live-data#cross-origin-resource-sharing-cors-setup
    private readonly allowedOrigins = new Set([
        'https://app.foxglove.dev',
        'https://embed.foxglove.dev',
    ]);

    constructor(private readonly foxgloveService: FoxgloveService) {}

    @Get(':uuid/:filename')
    @ApiResponse({
        description: '302 Redirect to actual file URL',
        status: 302,
    })
    @OutputDto(null) // No response body, just a redirect
    // No @LoggedIn() guard here! The signature IS the guard.
    async proxyFoxglove(
        @ParameterUuid('uuid') uuid: string,
        @Query('expires') expires: string,
        @Query('signature') signature: string,
        @Query('u') userUuid: string,
        @Res() response: Response,
        @Req() request: Request,
    ): Promise<void> {
        const resolvedFileUrl = await this.foxgloveService.resolveRedirectUrl(
            uuid,
            Number(expires),
            signature,
            userUuid,
        );

        const origin = request.headers.origin;
        if (origin && this.allowedOrigins.has(origin)) {
            response.header('Access-Control-Allow-Origin', origin);
        } else {
            response.header('Access-Control-Allow-Origin', 'null');
        }

        response.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        response.header('Access-Control-Allow-Credentials', 'true');

        // 302 Redirect to S3
        response.redirect(resolvedFileUrl);
    }
}

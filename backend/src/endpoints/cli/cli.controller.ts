import { ApiOkResponse } from '@/decorators';
import { MIN_CLIENT_VERSION } from '@/routing/middlewares/version-checker-middleware.service';
import { DeviceAuthorizationService } from '@/services/device-authorization.service';
import { appVersion } from '@/app-version';
import {
    CliConfigDto,
    CreateDeviceAuthorizationDto,
    DeviceAuthorizationDto,
    DeviceAuthorizationInfoDto,
    DeviceTokenDto,
    DeviceTokenRequestDto,
} from '@kleinkram/api-dto';
import env from '@kleinkram/backend-common/environment';
import { resolveExternalS3Endpoint } from '@kleinkram/backend-common/modules/storage/storage-config.factory';
import {
    Body,
    Controller,
    Get,
    HttpCode,
    Param,
    Post,
    Req,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import { UserOnly } from '../auth/roles.decorator';

const clientIp = (request: Request): string => {
    const forwarded = request.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
        ?.split(',')[0]
        ?.trim();
    return first ?? request.ip ?? request.socket.remoteAddress ?? 'unknown';
};

@Controller('cli')
export class CliController {
    constructor(
        private readonly deviceAuthorizationService: DeviceAuthorizationService,
    ) {}

    @Get('config')
    @ApiOperation({
        summary: 'Describe this instance to the CLI',
        description:
            'Lets `klein login <url>` find the API, the S3 storage and the ' +
            'login options from a single address. Needs no login.',
    })
    @ApiOkResponse({ description: 'Instance description', type: CliConfigDto })
    config(): CliConfigDto {
        const authProviders: string[] = [];
        if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
            authProviders.push('google');
        if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)
            authProviders.push('github');
        if (env.VITE_USE_FAKE_OAUTH_FOR_DEVELOPMENT)
            authProviders.push('fake-oauth');

        return {
            frontendUrl: env.FRONTEND_URL,
            apiUrl: env.BACKEND_URL,
            s3Url: resolveExternalS3Endpoint(),
            serverVersion: appVersion,
            minCliVersion: MIN_CLIENT_VERSION,
            authProviders,
            deviceFlow: true,
            docsUrl: env.DOCS_URL,
        };
    }

    @Post('device')
    @HttpCode(200)
    @ApiOperation({
        summary: 'Start a CLI login',
        description:
            'Returns a device code for the CLI and a short user code the ' +
            'user approves in the web app.',
    })
    @ApiOkResponse({
        description: 'Codes for the new login',
        type: DeviceAuthorizationDto,
    })
    async createDeviceAuthorization(
        @Body() body: CreateDeviceAuthorizationDto,
        @Req() request: Request,
    ): Promise<DeviceAuthorizationDto> {
        return this.deviceAuthorizationService.create(body, clientIp(request));
    }

    @Post('device/token')
    @HttpCode(200)
    @ApiOperation({
        summary: 'Poll a CLI login',
        description:
            'Returns the tokens once the user approved the login. Each ' +
            'approved login hands out its tokens only once.',
    })
    @ApiOkResponse({ description: 'Login state', type: DeviceTokenDto })
    async pollDeviceAuthorization(
        @Body() body: DeviceTokenRequestDto,
    ): Promise<DeviceTokenDto> {
        return this.deviceAuthorizationService.poll(body.deviceCode);
    }

    @Get('device/:userCode')
    @UserOnly()
    @ApiOperation({ summary: 'Show a pending CLI login' })
    @ApiOkResponse({
        description: 'The pending login',
        type: DeviceAuthorizationInfoDto,
    })
    async deviceAuthorizationInfo(
        @Param('userCode') userCode: string,
    ): Promise<DeviceAuthorizationInfoDto> {
        return this.deviceAuthorizationService.info(userCode);
    }

    @Post('device/:userCode/approve')
    @HttpCode(200)
    @UserOnly()
    @ApiOperation({ summary: 'Approve a CLI login as the signed in user' })
    @ApiOkResponse({
        description: 'The approved login',
        type: DeviceAuthorizationInfoDto,
    })
    async approveDeviceAuthorization(
        @Param('userCode') userCode: string,
        @AddUser() auth: AuthHeader,
    ): Promise<DeviceAuthorizationInfoDto> {
        return this.deviceAuthorizationService.approve(
            userCode,
            auth.user.uuid,
        );
    }

    @Post('device/:userCode/deny')
    @HttpCode(200)
    @UserOnly()
    @ApiOperation({ summary: 'Reject a CLI login' })
    @ApiOkResponse({
        description: 'The rejected login',
        type: DeviceAuthorizationInfoDto,
    })
    async denyDeviceAuthorization(
        @Param('userCode') userCode: string,
    ): Promise<DeviceAuthorizationInfoDto> {
        return this.deviceAuthorizationService.deny(userCode);
    }
}

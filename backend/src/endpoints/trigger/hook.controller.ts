import { TriggerService } from '@/services/trigger.service';
import { ParameterUuid } from '@/validation/parameter-decorators';
import { WebhookTriggerResponseDto } from '@kleinkram/api-dto';
import { ActionState } from '@kleinkram/shared';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiOkResponse, OutputDto } from '../../decorators';
import { PublicGuard } from '../auth/guards';
import { ThrottlerLoggerGuard } from './throttler-logger.guard';

@ApiTags('Hooks')
@Controller('hooks/actions')
export class HookController {
    constructor(private readonly triggerService: TriggerService) {}

    private toResponse(result: {
        actionUuid: string;
        templateUuid: string;
        createdAt: Date;
    }): WebhookTriggerResponseDto {
        return {
            actionUUID: result.actionUuid,
            templateUUID: result.templateUuid,
            state: ActionState.PENDING,
            createdAt: result.createdAt.toISOString(),
        };
    }

    @Post(':uuid')
    @UseGuards(PublicGuard, ThrottlerLoggerGuard)
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @OutputDto(WebhookTriggerResponseDto)
    @ApiOkResponse({ type: WebhookTriggerResponseDto })
    async triggerPost(
        @ParameterUuid('uuid') uuid: string,
        @Body() body: Record<string, unknown>,
    ): Promise<WebhookTriggerResponseDto> {
        const result = await this.triggerService.triggerWebhook(uuid, body);
        return this.toResponse(result);
    }

    @Get(':uuid')
    @UseGuards(PublicGuard)
    @OutputDto(WebhookTriggerResponseDto)
    @ApiOkResponse({ type: WebhookTriggerResponseDto })
    async triggerGet(
        @ParameterUuid('uuid') uuid: string,
    ): Promise<WebhookTriggerResponseDto> {
        const result = await this.triggerService.triggerWebhook(uuid, {});
        return this.toResponse(result);
    }
}

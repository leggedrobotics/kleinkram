import { TriggerService } from '@/services/trigger.service';
import { ParameterUuid } from '@/validation/parameter-decorators';
import { ActionSubmitResponseDto } from '@kleinkram/api-dto';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiOkResponse, OutputDto } from '../../decorators';
import { PublicGuard } from '../auth/guards';

@ApiTags('Hooks')
@Controller('hooks/actions')
export class HookController {
    constructor(private readonly triggerService: TriggerService) {}

    @Post(':uuid')
    @UseGuards(PublicGuard)
    @OutputDto(ActionSubmitResponseDto)
    @ApiOkResponse({ type: ActionSubmitResponseDto })
    async triggerPost(
        @ParameterUuid('uuid') uuid: string,
        @Body() body: Record<string, unknown>,
    ): Promise<ActionSubmitResponseDto> {
        const { actionUuid } = await this.triggerService.triggerWebhook(
            uuid,
            body,
        );
        return { actionUUID: actionUuid };
    }

    @Get(':uuid')
    @UseGuards(PublicGuard)
    @OutputDto(ActionSubmitResponseDto)
    @ApiOkResponse({ type: ActionSubmitResponseDto })
    async triggerGet(
        @ParameterUuid('uuid') uuid: string,
    ): Promise<ActionSubmitResponseDto> {
        const { actionUuid } = await this.triggerService.triggerWebhook(
            uuid,
            {},
        );
        return { actionUUID: actionUuid };
    }
}

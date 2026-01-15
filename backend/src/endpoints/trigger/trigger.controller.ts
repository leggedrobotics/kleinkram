import { TriggerService } from '@/services/trigger.service';
import { ParameterUuid } from '@/validation/parameter-decorators';
import {
    ActionTriggerDto,
    CreateActionTriggerDto,
    UpdateActionTriggerDto,
} from '@kleinkram/api-dto';
import {
    Body,
    Controller,
    Delete,
    Get,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiOkResponse, OutputDto } from '../../decorators';
import { CanCreateInMissionByBody, LoggedIn } from '../auth/roles.decorator';

@ApiTags('Triggers')
@Controller('triggers')
export class TriggerController {
    constructor(private readonly triggerService: TriggerService) {}

    @Get()
    @LoggedIn()
    @ApiOkResponse({ type: ActionTriggerDto, isArray: true })
    async findAll(
        @Query('missionUuid') missionUuid?: string,
    ): Promise<ActionTriggerDto[]> {
        return this.triggerService.findAll(missionUuid);
    }

    @Post()
    @CanCreateInMissionByBody()
    @ApiOkResponse({ type: ActionTriggerDto })
    async create(
        @Body() dto: CreateActionTriggerDto,
    ): Promise<ActionTriggerDto> {
        return this.triggerService.create(dto);
    }

    @Patch(':uuid')
    @LoggedIn()
    @ApiOkResponse({ type: ActionTriggerDto })
    async update(
        @ParameterUuid('uuid') uuid: string,
        @Body() dto: UpdateActionTriggerDto,
    ): Promise<ActionTriggerDto> {
        return this.triggerService.update(uuid, dto);
    }

    @Delete(':uuid')
    @LoggedIn()
    @OutputDto(null)
    async remove(@ParameterUuid('uuid') uuid: string): Promise<void> {
        return this.triggerService.delete(uuid);
    }
}

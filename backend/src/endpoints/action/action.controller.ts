import { ApiCreatedResponse, ApiOkResponse, OutputDto } from '@/decorators';
import { ActionService } from '@/services/action.service';
import { FileQueryService } from '@/services/file-query.service';
import { ParameterUuid } from '@/validation/parameter-decorators';
import {
    ActionDto,
    ActionLogsDto,
    ActionQuery,
    ActionsDto,
    ActionSubmitResponseDto,
    FileEventsDto,
    PaginatedQueryDto,
    SubmitActionDto,
    SubmitActionMulti,
    SuccessResponseDto,
} from '@kleinkram/api-dto';
import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import {
    CanCancelAction,
    CanCreateAction,
    CanCreateActions,
    CanDeleteAction,
    CanReadAction,
    LoggedIn,
} from '../auth/roles.decorator';

@ApiTags('Actions')
@Controller('actions')
export class ActionsController {
    constructor(
        private readonly actionService: ActionService,
        private readonly fileQueryService: FileQueryService,
    ) {}

    @Post()
    @CanCreateAction()
    @ApiOperation({ summary: 'Submit (dispatch) a new action' })
    @ApiCreatedResponse({ type: ActionSubmitResponseDto })
    async create(
        @Body() dto: SubmitActionDto,
        @AddUser() user: AuthHeader,
    ): Promise<ActionSubmitResponseDto> {
        return this.actionService.submit(dto, user);
    }

    @Post('batch')
    @CanCreateActions()
    @ApiOperation({ summary: 'Batch submit multiple actions' })
    @ApiCreatedResponse({ type: [ActionSubmitResponseDto] })
    async createBatch(
        @Body() dto: SubmitActionMulti,
        @AddUser() user: AuthHeader,
    ): Promise<ActionSubmitResponseDto[]> {
        return this.actionService.multiSubmit(dto, user);
    }

    @Get()
    @LoggedIn()
    @ApiOperation({ summary: 'List actions (history or running)' })
    @ApiOkResponse({ type: ActionsDto })
    async findAll(
        @Query() query: ActionQuery,
        @AddUser() auth: AuthHeader,
    ): Promise<ActionsDto> {
        return this.actionService.findAll(query, auth);
    }

    @Get(':uuid')
    @CanReadAction()
    @ApiOperation({ summary: 'Get action details' })
    @ApiOkResponse({ type: ActionDto })
    async findOne(@ParameterUuid('uuid') uuid: string): Promise<ActionDto> {
        return this.actionService.details(uuid);
    }

    @Get(':uuid/logs')
    @CanReadAction()
    @ApiOperation({ summary: 'Get action logs' })
    @ApiOkResponse({ type: ActionLogsDto })
    async getLogs(
        @ParameterUuid('uuid') uuid: string,
        @Query() query: PaginatedQueryDto,
    ): Promise<ActionLogsDto> {
        return this.actionService.getLogs(uuid, query);
    }

    @Get(':uuid/file-events')
    @CanReadAction()
    @ApiOperation({ summary: 'Get file events triggered by this action' })
    @ApiOkResponse({ type: FileEventsDto })
    async getFileEvents(
        @ParameterUuid('uuid') uuid: string,
    ): Promise<FileEventsDto> {
        return this.fileQueryService.getActionFileEvents(uuid);
    }

    @Delete(':uuid')
    @CanDeleteAction()
    @ApiOperation({ summary: 'Delete a specific action run' })
    @OutputDto(SuccessResponseDto)
    async remove(
        @ParameterUuid('uuid') uuid: string,
    ): Promise<SuccessResponseDto> {
        await this.actionService.delete(uuid);
        return { success: true };
    }

    @Post(':uuid/cancel')
    @CanCancelAction()
    @ApiOperation({ summary: 'Cancel a running action' })
    @OutputDto(SuccessResponseDto)
    async cancel(
        @ParameterUuid('uuid') uuid: string,
    ): Promise<SuccessResponseDto> {
        await this.actionService.cancel(uuid);
        return { success: true };
    }
}

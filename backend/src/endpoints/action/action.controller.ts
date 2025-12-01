import { ActionLogsDto } from '@common/api/types/actions/action-logs.dto';
import { ActionDto } from '@common/api/types/actions/action.dto';
import { ActionsDto } from '@common/api/types/actions/actions.dto';
import { FileEventsDto } from '@common/api/types/file/file-event.dto';
import { PaginatedQueryDto } from '@common/api/types/pagination';
import {
    ActionSubmitResponseDto,
    SubmitActionDto,
} from '@common/api/types/submit-action-response.dto';
import {
    ActionQuery,
    SubmitActionMulti,
} from '@common/api/types/submit-action.dto';
import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiOkResponse, OutputDto } from '../../decarators';
import { ActionService } from '../../services/action.service';
import { FileService } from '../../services/file.service';
import { ParameterUuid } from '../../validation/parameter-decorators';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import {
    CanCreateAction,
    CanCreateActions,
    CanDeleteAction,
    LoggedIn,
} from '../auth/roles.decorator';

@ApiTags('Actions')
@Controller('actions')
export class ActionsController {
    constructor(
        private readonly actionService: ActionService,
        private readonly fileService: FileService,
    ) {}

    @Post()
    @CanCreateAction()
    @ApiOperation({ summary: 'Submit (dispatch) a new action' })
    @ApiOkResponse({ type: ActionSubmitResponseDto })
    async create(
        @Body() dto: SubmitActionDto,
        @AddUser() user: AuthHeader,
    ): Promise<ActionSubmitResponseDto> {
        return this.actionService.submit(dto, user);
    }

    @Post('batch')
    @CanCreateActions()
    @ApiOperation({ summary: 'Batch submit multiple actions' })
    @ApiOkResponse({ type: [ActionSubmitResponseDto] })
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
    @LoggedIn()
    @ApiOperation({ summary: 'Get action details' })
    @ApiOkResponse({ type: ActionDto })
    async findOne(@ParameterUuid('uuid') uuid: string): Promise<ActionDto> {
        return this.actionService.details(uuid);
    }

    @Get(':uuid/logs')
    @LoggedIn()
    @ApiOperation({ summary: 'Get action logs' })
    @ApiOkResponse({ type: ActionLogsDto })
    async getLogs(
        @ParameterUuid('uuid') uuid: string,
        @Query() query: PaginatedQueryDto,
    ): Promise<ActionLogsDto> {
        return this.actionService.getLogs(uuid, query);
    }

    @Get(':uuid/file-events')
    @LoggedIn()
    @ApiOperation({ summary: 'Get file events triggered by this action' })
    @ApiOkResponse({ type: FileEventsDto })
    async getFileEvents(
        @ParameterUuid('uuid') uuid: string,
    ): Promise<FileEventsDto> {
        return this.fileService.getActionFileEvents(uuid);
    }

    @Delete(':uuid')
    @CanDeleteAction()
    @ApiOperation({ summary: 'Delete a specific action run' })
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    @OutputDto(null)
    async remove(
        @ParameterUuid('uuid') uuid: string,
    ): Promise<{ success: boolean }> {
        await this.actionService.delete(uuid);
        return { success: true };
    }
}

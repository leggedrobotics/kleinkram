import { ApiCreatedResponse, ApiOkResponse, OutputDto } from '@/decorators';
import { ActionDiagnosticService } from '@/services/action-diagnostic.service';
import { ActionService } from '@/services/action.service';
import { FileQueryService } from '@/services/file-query.service';
import { ParameterUuid } from '@/validation/parameter-decorators';
import {
    ActionDiagnosticsDto,
    ActionDto,
    ActionLogsDto,
    ActionQuery,
    ActionsDto,
    ActionSubmitResponseDto,
    CreateActionDiagnosticDto,
    FileEventsDto,
    PaginatedQueryDto,
    SubmitActionDto,
    SubmitActionMulti,
    SubmitScriptActionDto,
    SuccessResponseDto,
} from '@kleinkram/api-dto';
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Post,
    Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import {
    CanCancelAction,
    CanCreateAction,
    CanCreateActions,
    CanCreateScriptAction,
    CanDeleteAction,
    CanReadAction,
    IsRunningAction,
    LoggedIn,
} from '../auth/roles.decorator';

@ApiTags('Actions')
@Controller('actions')
export class ActionsController {
    constructor(
        private readonly actionService: ActionService,
        private readonly actionDiagnosticService: ActionDiagnosticService,
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

    @Post('script')
    @CanCreateScriptAction()
    @ApiOperation({
        summary: 'Submit a single-file Python script as an action',
        description:
            'Called by `klein action run-script`. Stores the script and dispatches it on the shared `script-runner` template, so no image has to be built or pushed.',
    })
    @ApiCreatedResponse({ type: ActionSubmitResponseDto })
    async createFromScript(
        @Body() dto: SubmitScriptActionDto,
        @AddUser() user: AuthHeader,
    ): Promise<ActionSubmitResponseDto> {
        return this.actionService.submitScript(dto, user);
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

    @Get(':uuid/diagnostics')
    @CanReadAction()
    @ApiOperation({ summary: 'Get the diagnostics an action reported' })
    @ApiOkResponse({ type: ActionDiagnosticsDto })
    async getDiagnostics(
        @ParameterUuid('uuid') uuid: string,
    ): Promise<ActionDiagnosticsDto> {
        return this.actionDiagnosticService.findAll(uuid);
    }

    @Post(':uuid/diagnostics')
    @IsRunningAction()
    @HttpCode(204)
    // The route answers with no body, so response validation has nothing to
    // check; without this the global interceptor rejects it as undeclared.
    @OutputDto(null)
    @Throttle({ default: { limit: 600, ttl: 60_000 } })
    @ApiOperation({
        summary: 'Report a diagnostic from inside the running action container',
        description:
            'Called by `klein action warn` / `klein action fail`. Raises the severity of the action without changing its state.',
    })
    async reportDiagnostic(
        @ParameterUuid('uuid') uuid: string,
        @Body() dto: CreateActionDiagnosticDto,
    ): Promise<void> {
        return this.actionDiagnosticService.record(uuid, dto);
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

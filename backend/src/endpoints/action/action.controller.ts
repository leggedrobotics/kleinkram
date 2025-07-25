import {
    ActionTemplateDto,
    ActionTemplatesDto,
} from '@common/api/types/actions/action-template.dto';
import { ActionDto, ActionsDto } from '@common/api/types/actions/action.dto';
import {
    CreateTemplateDto,
    UpdateTemplateDto,
} from '@common/api/types/create-template.dto';
import { DeleteFileResponseDto } from '@common/api/types/file/delete-file-response.dto';
import {
    ActionSubmitResponseDto,
    SubmitActionDto,
} from '@common/api/types/submit-action-response.dto';
import {
    ActionQuery,
    SubmitActionMulti,
} from '@common/api/types/submit-action.dto';
import { IsSkip } from '@common/validation/skip-validation';
import { IsTake } from '@common/validation/take-validation';
import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation } from '@nestjs/swagger';
import { ApiOkResponse, OutputDto } from '../../decarators';
import { ActionService } from '../../services/action.service';
import { ParameterUuid as ParameterUID } from '../../validation/parameter-decorators';
import {
    QueryOptionalString,
    QuerySkip,
    QueryUUID,
} from '../../validation/query-decorators';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import {
    CanCreate,
    CanCreateAction,
    CanCreateActions,
    CanDeleteAction,
    CanReadAction,
    LoggedIn,
    UserOnly,
} from '../auth/roles.decorator';

export class RunningActionsQuery {
    @IsSkip()
    skip?: number;

    @IsTake()
    take?: number;
}

@Controller('action')
export class ActionController {
    constructor(private readonly actionService: ActionService) {}

    @Post('submit')
    @CanCreateAction()
    @ApiOperation({
        summary: 'Submit an action',
        description:
            'Submit an action to the system. This the action is ' +
            'scheduled to run immediately, as soon as resources are available.',
    })
    @ApiBody({
        type: SubmitActionDto,
    })
    @ApiOkResponse({
        type: ActionSubmitResponseDto,
    })
    async createActionRun(
        @Body() dto: SubmitActionDto,
        @AddUser() user: AuthHeader,
    ): Promise<ActionSubmitResponseDto> {
        return this.actionService.submit(dto, user);
    }

    @Delete(':uuid')
    @CanDeleteAction()
    @ApiOkResponse({
        description: 'True if the action was deleted',
        type: DeleteFileResponseDto,
    })
    async deleteAction(
        @ParameterUID('uuid') uuid: string,
    ): Promise<DeleteFileResponseDto> {
        await this.actionService.delete(uuid);
        return { success: true };
    }

    @Post('multiSubmit')
    @CanCreateActions()
    @OutputDto(null) // TODO: type API response
    async multiSubmit(
        @Body() dto: SubmitActionMulti,
        @AddUser() user: AuthHeader,
    ) {
        return this.actionService.multiSubmit(dto, user);
    }

    @Post('createTemplate')
    @CanCreate()
    @ApiOkResponse({
        description: 'The created template',
        type: ActionTemplateDto,
    })
    async createTemplate(
        @Body() dto: CreateTemplateDto,
        @AddUser() user: AuthHeader,
    ): Promise<ActionTemplateDto> {
        return this.actionService.createTemplate(dto, user);
    }

    @Post('createNewVersion')
    @CanCreate()
    @ApiOkResponse({
        description: 'The created template',
        type: ActionTemplateDto,
    })
    async createNewVersion(
        @Body() dto: UpdateTemplateDto,
        @AddUser() user: AuthHeader,
    ): Promise<ActionTemplateDto> {
        return this.actionService.createNewVersion(dto, user);
    }

    @Get('listActions')
    @LoggedIn()
    @ApiOperation({
        summary: 'List all actions',
    })
    @ApiOkResponse({
        description: 'List of actions',
        type: ActionsDto,
    })
    async list(
        @Query() dto: ActionQuery,
        @AddUser() auth: AuthHeader,
        // TODO: bring back filter options
    ): Promise<ActionsDto> {
        let missionUuid = dto.missionUuid;
        if (auth.apikey) {
            missionUuid = auth.apikey.mission.uuid;
        }
        return this.actionService.listActions(
            dto.projectUuid,
            missionUuid,
            auth.user.uuid,
            Number.parseInt((dto.skip ?? 0).toString()),
            Number.parseInt((dto.take ?? 0).toString()),
            dto.sortBy ?? '',
            (dto.sortDirection as 'ASC' | 'DESC') ?? 'DESC',
            dto.search ?? '',
        );
    }

    @Get('running')
    @UserOnly()
    @ApiOkResponse({
        description: 'List of running actions',
        type: ActionsDto,
    })
    async runningActions(
        @AddUser() auth: AuthHeader,
        @Query() parameters: RunningActionsQuery,
    ): Promise<ActionsDto> {
        return this.actionService.runningActions(
            auth.user.uuid,
            parameters.skip ?? 0,
            parameters.take ?? 10,
        );
    }

    @Get('listTemplates')
    @LoggedIn()
    @ApiOkResponse({
        description: 'List of templates',
        type: ActionTemplatesDto,
    })
    async listTemplates(
        @AddUser() user: AuthHeader,
        @QuerySkip('skip') skip: number,
        @QuerySkip('take') take: number,
        @QueryOptionalString('search', 'Searchkey in name') search: string,
    ): Promise<ActionTemplatesDto> {
        return this.actionService.listTemplates(skip, take, search);
    }

    @Get('details')
    @CanReadAction()
    @ApiOkResponse({
        description: 'Details of the action',
        type: ActionDto,
    })
    async details(
        @QueryUUID('uuid', 'ActionUUID') uuid: string,
    ): Promise<ActionDto> {
        return this.actionService.details(uuid);
    }
}

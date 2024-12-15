import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { ActionService } from '../../services/action.service';
import {
    CanCreate,
    CanCreateAction,
    CanCreateActions,
    CanDeleteAction,
    CanReadAction,
    LoggedIn,
    UserOnly,
} from '../auth/roles.decorator';
import {
    QueryOptionalString,
    QuerySkip,
    QueryUUID,
} from '../../validation/query-decorators';
import {
    CreateTemplateDto,
    UpdateTemplateDto,
} from '@common/api/types/create-template.dto';
import { ParameterUuid as ParameterUID } from '../../validation/param-decorators';
import { ApiBody, ApiOperation } from '@nestjs/swagger';
import { ApiOkResponse, OutputDto } from '../../decarators';
import {
    ActionSubmitResponseDto,
    SubmitActionDto,
} from '@common/api/types/submit-action-response.dto';
import { IsTake } from '@common/validation/take-validation';
import { IsSkip } from '@common/validation/skip-validation';
import {
    ActionTemplateDto,
    ActionTemplatesDto,
} from '@common/api/types/actions/action-template.dto';
import { ActionDto, ActionsDto } from '@common/api/types/actions/action.dto';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import {
    ActionQuery,
    SubmitActionMulti,
} from '@common/api/types/submit-action.dto';
import { DeleteFileResponseDto } from '@common/api/types/files/delete-file-response.dto';

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
        /* @QuerySortBy('sortBy') sortBy: string,
        @QuerySortDirection('sortDirection') sortDirection: 'ASC' | 'DESC',
        @QueryOptionalString(
            'search',
            'Searchkey in name, state_cause or image_name',
        )
        search: string,*/
    ): Promise<ActionsDto> {
        let missionUuid = dto.mission_uuid;
        if (auth.apikey) {
            missionUuid = auth.apikey.mission.uuid;
        }
        return this.actionService.listActions(
            dto.project_uuid,
            missionUuid,
            auth.user.uuid,
            Number.parseInt((dto.skip ?? 0).toString()),
            Number.parseInt((dto.take ?? 0).toString()),
            'updatedAt',
            'ASC',
            '',
            /*
            sortBy,
            sortDirection,
            search,
             */
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

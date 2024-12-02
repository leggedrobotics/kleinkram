import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { ActionService } from './action.service';
import { ActionQuery, SubmitActionMulti } from './entities/submit_action.dto';
import {
    CanCreate,
    CanCreateAction,
    CanCreateActions,
    CanDeleteAction,
    CanReadAction,
    LoggedIn,
    UserOnly,
} from '../auth/roles.decorator';
import { AddUser, AuthRes } from '../auth/paramDecorator';
import {
    QueryOptionalString,
    QuerySkip,
    QuerySortBy,
    QuerySortDirection,
    QueryTake,
    QueryUUID,
} from '../validation/queryDecorators';
import {
    CreateTemplateDto,
    UpdateTemplateDto,
} from './entities/createTemplate.dto';
import { ParamUUID } from '../validation/paramDecorators';
import { ApiBody, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ActionsDto } from '@common/api/types/Actions.dto';
import {
    ActionSubmitResponseDto,
    SubmitActionDto,
} from '@common/api/types/SubmitAction.dto';

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
        @AddUser() user: AuthRes,
    ): Promise<ActionSubmitResponseDto> {
        return this.actionService.submit(dto, user);
    }

    @Delete(':uuid')
    @CanDeleteAction()
    @ApiOkResponse({
        description: 'True if the action was deleted',
        type: Boolean,
    })
    async deleteAction(@ParamUUID('uuid') uuid: string): Promise<boolean> {
        return this.actionService.delete(uuid);
    }

    @Post('multiSubmit')
    @CanCreateActions()
    // TODO: type API response
    async multiSubmit(
        @Body() dto: SubmitActionMulti,
        @AddUser() user: AuthRes,
    ) {
        return this.actionService.multiSubmit(dto, user);
    }

    @Post('createTemplate')
    @CanCreate()
    // TODO: type API response
    async createTemplate(
        @Body() dto: CreateTemplateDto,
        @AddUser() user: AuthRes,
    ) {
        return this.actionService.createTemplate(dto, user);
    }

    @Post('createNewVersion')
    @CanCreate()
    // TODO: type API response
    async createNewVersion(
        @Body() dto: UpdateTemplateDto,
        @AddUser() user: AuthRes,
    ) {
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
        @AddUser() auth: AuthRes,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @QuerySortBy('sortBy') sortBy: string,
        @QuerySortDirection('sortDirection') sortDirection: 'ASC' | 'DESC',
        @QueryOptionalString(
            'search',
            'Searchkey in name, state_cause or image_name',
        )
        search: string,
    ): Promise<ActionsDto> {
        let missionUuid = dto.mission_uuid;
        if (auth.apikey) {
            missionUuid = auth.apikey.mission.uuid;
        }
        return this.actionService.listActions(
            dto.project_uuid,
            missionUuid,
            auth.user.uuid,
            skip,
            take,
            sortBy,
            sortDirection,
            search,
        );
    }

    @Get('running')
    @UserOnly()
    // TODO: type API response
    async runningActions(
        @AddUser() auth: AuthRes,
        @QuerySkip('skip') skip: number,
        @QuerySkip('take') take: number,
    ) {
        return this.actionService.runningActions(auth.user.uuid, skip, take);
    }

    @Get('listTemplates')
    @LoggedIn()
    // TODO: type API response
    async listTemplates(
        @AddUser() user: AuthRes,
        @QuerySkip('skip') skip: number,
        @QuerySkip('take') take: number,
        @QueryOptionalString('search', 'Searchkey in name') search: string,
    ) {
        return this.actionService.listTemplates(skip, take, search);
    }

    @Get('details')
    @CanReadAction()
    // TODO: type API response
    async details(@QueryUUID('uuid', 'ActionUUID') uuid: string) {
        return this.actionService.details(uuid);
    }
}

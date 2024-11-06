import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ActionService } from './action.service';
import {
    ActionQuery,
    SubmitAction,
    SubmitActionMulti,
} from './entities/submit_action.dto';
import {
    CanCreate,
    CanCreateAction,
    CanCreateActions,
    CanReadAction,
    LoggedIn,
    UserOnly,
} from '../auth/roles.decorator';
import { addUser, AuthRes } from '../auth/paramDecorator';
import {
    QueryOptionalBoolean,
    QueryOptionalString,
    QuerySkip, QuerySortBy, QuerySortDirection,
    QueryUUID,
} from '../validation/queryDecorators';
import Action from '@common/entities/action/action.entity';
import {
    CreateTemplateDto,
    UpdateTemplateDto,
} from './entities/createTemplate.dto';

@Controller('action')
export class ActionController {
    constructor(private readonly actionService: ActionService) {}

    @Post('submit')
    @CanCreateAction()
    async createActionRun(
        @Body() dto: SubmitAction,
        @addUser() user: AuthRes,
    ): Promise<Action> {
        return this.actionService.submit(dto, user);
    }

    @Post('multiSubmit')
    @CanCreateActions()
    async multiSubmit(
        @Body() dto: SubmitActionMulti,
        @addUser() user: AuthRes,
    ) {
        return this.actionService.multiSubmit(dto, user);
    }

    @Post('createTemplate')
    @CanCreate()
    async createTemplate(
        @Body() dto: CreateTemplateDto,
        @addUser() user: AuthRes,
    ) {
        return this.actionService.createTemplate(dto, user);
    }

    @Post('createNewVersion')
    @CanCreate()
    async createNewVersion(
        @Body() dto: UpdateTemplateDto,
        @addUser() user: AuthRes,
    ) {
        return this.actionService.createNewVersion(dto, user);
    }
    @Get('listActions')
    @LoggedIn()
    async list(
        @Query() dto: ActionQuery,
        @addUser() auth: AuthRes,
        @QuerySkip('skip') skip: number,
        @QuerySkip('take') take: number,
        @QuerySortBy('sortBy') sortBy: string,
        @QuerySortDirection('descending') descending: boolean,
        @QueryOptionalString('search', 'Searchkey in name, state_cause or image_name') search: string,
    ) {
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
            descending,
            search,
        );
    }

    @Get('running')
    @UserOnly()
    async runningActions(
        @addUser() auth: AuthRes,
        @QuerySkip('skip') skip: number,
        @QuerySkip('take') take: number,
    ) {
        return this.actionService.runningActions(auth.user.uuid, skip, take);
    }

    @Get('listTemplates')
    @LoggedIn()
    async listTemplates(
        @addUser() user: AuthRes,
        @QuerySkip('skip') skip: number,
        @QuerySkip('take') take: number,
        @QueryOptionalString('search', 'Searchkey in name') search: string,
    ) {
        return this.actionService.listTemplates(skip, take, search);
    }

    @Get('details')
    @CanReadAction()
    async details(@QueryUUID('uuid', 'ActionUUID') uuid: string) {
        return this.actionService.details(uuid);
    }
}

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
} from '../auth/roles.decorator';
import { addJWTUser, JWTUser } from '../auth/paramDecorator';
import {
    QueryOptionalBoolean,
    QueryOptionalString,
    QuerySkip,
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
        @addJWTUser() user: JWTUser,
    ): Promise<Action> {
        return this.actionService.submit(dto, user);
    }

    @Post('multiSubmit')
    @CanCreateActions()
    async multiSubmit(
        @Body() dto: SubmitActionMulti,
        @addJWTUser() user: JWTUser,
    ) {
        return this.actionService.multiSubmit(dto, user);
    }

    @Post('createTemplate')
    @CanCreate()
    async createTemplate(
        @Body() dto: CreateTemplateDto,
        @addJWTUser() user: JWTUser,
    ) {
        return this.actionService.createTemplate(dto, user);
    }

    @Post('createNewVersion')
    @CanCreate()
    async createNewVersion(
        @Body() dto: UpdateTemplateDto,
        @addJWTUser() user: JWTUser,
    ) {
        return this.actionService.createNewVersion(dto, user);
    }
    @Get('listActions')
    @LoggedIn()
    async list(
        @Query() dto: ActionQuery,
        @addJWTUser() user: JWTUser,
        @QuerySkip('skip') skip: number,
        @QuerySkip('take') take: number,
        @QueryOptionalString('sortBy') sortBy: string,
        @QueryOptionalBoolean('descending') descending: boolean,
    ) {
        return this.actionService.listActions(
            dto.project_uuid,
            dto.mission_uuid,
            user.uuid,
            skip,
            take,
            sortBy,
            descending,
        );
    }

    @Get('running')
    @LoggedIn()
    async runningActions(
        @addJWTUser() user: JWTUser,
        @QuerySkip('skip') skip: number,
        @QuerySkip('take') take: number,
    ) {
        return this.actionService.runningActions(user.uuid, skip, take);
    }

    @Get('listTemplates')
    @LoggedIn()
    async listTemplates(
        @addJWTUser() user: JWTUser,
        @QuerySkip('skip') skip: number,
        @QuerySkip('take') take: number,
        @QueryOptionalString('search') search: string,
    ) {
        return this.actionService.listTemplates(skip, take, search);
    }

    @Get('details')
    @CanReadAction()
    async details(@QueryUUID('uuid') uuid: string) {
        return this.actionService.details(uuid);
    }
}

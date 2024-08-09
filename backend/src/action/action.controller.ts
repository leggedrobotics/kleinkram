import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { ActionService } from './action.service';
import { ActionQuery, SubmitAction } from './entities/submit_action.dto';
import { QueueService } from '../queue/queue.service';
import {
    AdminOnly,
    CanCreateAction,
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

@Controller('action')
export class ActionController {
    constructor(
        private readonly actionService: ActionService,
        private readonly queueService: QueueService,
    ) {}

    @Post('submit')
    @CanCreateAction()
    async createActionRun(
        @Body() dto: SubmitAction,
        @addJWTUser() user: JWTUser,
    ) {
        // TODO: validate input: similar to the frontend, we should validate the input
        //  to ensure that the user has provided the necessary information to create a new project.

        const action = await this.actionService.submit(dto, user);
        await this.queueService.addActionQueue(action.uuid);
        return action.uuid;
    }

    @Get('list')
    @LoggedIn()
    async list(
        @Query() dto: ActionQuery,
        @addJWTUser() user: JWTUser,
        @QuerySkip('skip') skip: number,
        @QuerySkip('take') take: number,
        @QueryOptionalString('sortBy') sortBy: string,
        @QueryOptionalBoolean('descending') descending: boolean,
    ) {
        return this.actionService.list(
            dto.mission_uuid,
            user.uuid,
            skip,
            take,
            sortBy,
            descending,
        );
    }

    @Get('details')
    @CanReadAction()
    async details(@QueryUUID('uuid') uuid: string) {
        return this.actionService.details(uuid);
    }
}

import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { ActionService } from './action.service';
import {
    ActionQuery,
    SubmitAction,
    ActionDetailsQuery,
} from './entities/submit_action.dto';
import { QueueService } from '../queue/queue.service';
import {
    AdminOnly,
    CanCreateAction,
    CanReadAction,
    LoggedIn,
} from '../auth/roles.decorator';
import { addJWTUser, JWTUser } from '../auth/paramDecorator';
import { QuerySkip, QueryUUID } from '../validation/queryDecorators';

@Controller('action')
export class ActionController {
    constructor(
        private readonly actionService: ActionService,
        private readonly queueService: QueueService,
    ) {}

    @Post('submit')
    @CanCreateAction()
    async createActionRun(@Body() dto: SubmitAction) {
        // TODO: validate input: similar to the frontend, we should validate the input
        // to ensure that the user has provided the necessary information to create a new project.

        // TODO: generate UUID for the mission, return that to the frontend for tracking
        const action = await this.actionService.submit(dto);
        await this.queueService.addActionQueue(action.uuid);
    }

    @Get('list')
    @LoggedIn()
    async list(
        @Query() dto: ActionQuery,
        @addJWTUser() user: JWTUser,
        @QuerySkip('skip') skip: number,
        @QuerySkip('take') take: number,
    ) {
        return this.actionService.list(dto.mission_uuid, user.uuid, skip, take);
    }

    @Get('details')
    @CanReadAction()
    async details(@QueryUUID('uuid') uuid: string) {
        return this.actionService.details(uuid);
    }

    @Delete('clear')
    @AdminOnly()
    async clear() {
        return this.actionService.clear();
    }
}

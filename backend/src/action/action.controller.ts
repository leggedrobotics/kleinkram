import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { ActionService } from './action.service';
import {
    ActionQuery,
    SubmitAction,
    ActionDetailsQuery,
} from './entities/submit_action.dto';
import { QueueService } from '../queue/queue.service';
import { AdminOnly } from '../auth/roles.decorator';

@Controller('action')
export class ActionController {
    constructor(
        private readonly actionService: ActionService,
        private readonly queueService: QueueService,
    ) {}

    @Post('submit')
    async createActionRun(@Body() dto: SubmitAction) {
        // TODO: validate input: similar to the frontend, we should validate the input
        // to ensure that the user has provided the necessary information to create a new project.

        // TODO: generate UUID for the mission, return that to the frontend for tracking
        const action = await this.actionService.submit(dto);
        await this.queueService.addActionQueue(action.uuid);
    }

    @Get('list')
    async list(@Query() dto: ActionQuery) {
        return this.actionService.list(dto.mission_uuids);
    }

    @Get('details')
    async details(@Query() dto: ActionDetailsQuery) {
        return this.actionService.details(dto.action_uuid);
    }

    @Delete('clear')
    @AdminOnly()
    async clear() {
        return this.actionService.clear();
    }
}

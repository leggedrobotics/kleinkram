import {
    Body,
    ConflictException,
    Controller,
    Delete,
    Get,
    Post,
    Query,
} from '@nestjs/common';
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
import { ActionDetails } from '@common/types';
import logger from '../logger';

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
        if (!dto.docker_image.startsWith('rslethz/')) {
            throw new ConflictException(
                'Docker image must start with rslethz/',
            );
        }
        const action = await this.actionService.submit(dto, user);
        await this.queueService.addActionQueue(action.uuid, {
            action_uuid: action.uuid,
            hardware_requirements: {
                needs_gpu: dto.gpu_model !== 'no-gpu',
            },
        } as ActionDetails);
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

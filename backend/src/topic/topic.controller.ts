import { Controller, Get } from '@nestjs/common';
import { TopicService } from './topic.service';
import { LoggedIn } from '../auth/roles.decorator';
import { addUser, JWTUser } from '../auth/paramDecorator';
import { QuerySkip, QueryTake } from '../validation/queryDecorators';

@Controller('topic')
export class TopicController {
    constructor(private readonly topicService: TopicService) {}

    @Get('all')
    @LoggedIn()
    async allTopics(
        @addUser() user: JWTUser,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ) {
        return await this.topicService.findAll(user.uuid, skip, take);
    }

    @Get('names')
    @LoggedIn()
    async allNames(@addUser() user: JWTUser) {
        return await this.topicService.findAllNames(user.uuid);
    }
}

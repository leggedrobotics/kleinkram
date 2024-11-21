import { Controller, Get } from '@nestjs/common';
import { TopicService } from './topic.service';
import { LoggedIn } from '../auth/roles.decorator';
import { AddUser, AuthRes } from '../auth/paramDecorator';
import { QuerySkip, QueryTake } from '../validation/queryDecorators';

@Controller('topic')
export class TopicController {
    constructor(private readonly topicService: TopicService) {}

    @Get('all')
    @LoggedIn()
    async allTopics(
        @AddUser() user: AuthRes,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ) {
        return await this.topicService.findAll(user.user.uuid, skip, take);
    }

    @Get('names')
    @LoggedIn()
    async allNames(@AddUser() user: AuthRes) {
        return await this.topicService.findAllNames(user.user.uuid);
    }
}

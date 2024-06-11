import { Controller, Get } from '@nestjs/common';
import { TopicService } from './topic.service';
import { LoggedIn } from '../auth/roles.decorator';
import { addJWTUser, JWTUser } from '../auth/paramDecorator';

@Controller('topic')
export class TopicController {
    constructor(private readonly topicService: TopicService) {}

    @Get('all')
    @LoggedIn()
    async allTopics(@addJWTUser() user: JWTUser) {
        return await this.topicService.findAll(user.uuid);
    }

    @Get('names')
    @LoggedIn()
    async allNames(@addJWTUser() user: JWTUser) {
        return await this.topicService.findAllNames(user.uuid);
    }
}

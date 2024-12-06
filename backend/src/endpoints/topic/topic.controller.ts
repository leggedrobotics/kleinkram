import { Controller, Get } from '@nestjs/common';
import { TopicService } from '../../services/topic.service';
import { LoggedIn } from '../auth/roles.decorator';
import { QuerySkip, QueryTake } from '../../validation/queryDecorators';
import { ApiOkResponse } from '../../decarators';
import { TopicNamesDto } from '@common/api/types/topic.dto';
import { AddUser, AuthRes } from '../auth/param-decorator';

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
    @ApiOkResponse({
        description: 'Get all topic names',
        type: TopicNamesDto,
    })
    async allNames(@AddUser() user: AuthRes): Promise<TopicNamesDto> {
        return await this.topicService.findAllNames(user.user.uuid);
    }
}

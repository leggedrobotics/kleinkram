import { TopicNamesDto, TopicsDto } from '@common/api/types/topic.dto';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse } from '../../decarators';
import { TopicService } from '../../services/topic.service';
import { QuerySkip, QueryTake } from '../../validation/query-decorators';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import { LoggedIn } from '../auth/roles.decorator';

@Controller('topic')
export class TopicController {
    constructor(private readonly topicService: TopicService) {}

    @Get('all')
    @LoggedIn()
    @ApiOkResponse({
        description: 'Get all topics',
        type: TopicsDto,
    })
    async allTopics(
        @AddUser() user: AuthHeader,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ): Promise<TopicsDto> {
        return await this.topicService.findAll(user.user.uuid, skip, take);
    }

    @Get('names')
    @LoggedIn()
    @ApiOkResponse({
        description: 'Get all topic names',
        type: TopicNamesDto,
    })
    async allNames(@AddUser() user: AuthHeader): Promise<TopicNamesDto> {
        return await this.topicService.findAllNames(user.user.uuid);
    }
}

import { Controller, Get } from '@nestjs/common';
import { TopicService } from '../../services/topic.service';
import { LoggedIn } from '../auth/roles.decorator';
import { Query } from '@nestjs/common';
import { PaginatedQueryDto } from '@common/api/types/pagination.dto';
import { ApiOkResponse } from '../../decarators';
import { TopicNamesDto, TopicsDto } from '@common/api/types/topic.dto';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';

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
        @Query() { skip, take }: PaginatedQueryDto,
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

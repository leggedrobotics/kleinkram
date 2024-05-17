import { Controller, Get } from '@nestjs/common';
import { TopicService } from './topic.service';
import { LoggedIn } from '../auth/roles.decorator';

@Controller('topic')
export class TopicController {
  constructor(private readonly topicService: TopicService) {}

  @Get('all')
  @LoggedIn()
  async allTopics() {
    return await this.topicService.findAll();
  }

  @Get('names')
  @LoggedIn()
  async allNames() {
    return await this.topicService.findAllNames();
  }
}

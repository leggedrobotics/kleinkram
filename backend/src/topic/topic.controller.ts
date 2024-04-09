import { Controller, Get } from '@nestjs/common';
import { TopicService } from './topic.service';

@Controller('topic')
export class TopicController {
  constructor(private readonly topicService: TopicService) {}

  @Get('all')
  async allTopics() {
    return await this.topicService.findAll();
  }

  @Get('names')
  async allNames() {
    return await this.topicService.findAllNames();
  }
}

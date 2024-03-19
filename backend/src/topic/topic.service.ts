import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Topic from './entities/topic.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TopicService {
  constructor(
    @InjectRepository(Topic) private topicRepository: Repository<Topic>,
  ) {}

  async findAll() {
    return this.topicRepository.find();
  }

  async create(topic: string): Promise<Topic> {
    this.topicRepository.count({ where: { name: topic } }).then((count) => {
      if (count === 0) {
        const newTopic = this.topicRepository.create({ name: topic });
        this.topicRepository.save(newTopic);
      }
    });
    return this.topicRepository.findOne({ where: { name: topic } });
  }
}

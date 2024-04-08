import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Topic from './entities/topic.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TopicService {
  constructor(
    @InjectRepository(Topic) private topicRepository: Repository<Topic>,
  ) {}

  async findAllNames() {
    const distinctNames = await this.topicRepository
      .createQueryBuilder('entity')
      .select('DISTINCT entities.name', 'name')
      .orderBy('name') // Optional: Order by name if desired
      .getRawMany();

    return distinctNames.map((item) => item.name);
  }

  async findAll() {
    return this.topicRepository.find();
  }

  async create(
    name: string,
    type: string,
    messageCount: bigint,
    frequency: number,
  ): Promise<Topic> {
    const newTopic = this.topicRepository.create({
      name,
      type,
      nrMessages: messageCount,
      frequency,
    });
    await this.topicRepository.save(newTopic);

    return this.topicRepository.findOne({ where: { name: name } });
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Project from '../project/entities/project.entity';
import { Like, Repository, Between } from 'typeorm';
import Run from './entities/run.entity';
import { CreateRun } from './entities/create-run.dto';
import { UpdateRun } from './entities/update-run.dto';
import axios from 'axios';
import * as FormData from 'form-data';
import { TopicService } from '../topic/topic.service';
import Topic from 'src/topic/entities/topic.entity';

@Injectable()
export class RunService {
  constructor(
    @InjectRepository(Run) private runRepository: Repository<Run>,
    @InjectRepository(Project) private projectRepository: Repository<Project>,
    private topicService: TopicService,
  ) {}

  async findAll() {
    return this.runRepository.find({ relations: ['project'] });
  }

  async findFiltered(
    runName: string,
    projectUUID: string,
    startDate: string,
    endDate: string,
    topics: string,
    and_or: boolean,
  ) {
    // Start building your query with basic filters
    const query = this.runRepository
      .createQueryBuilder('run')
      .leftJoinAndSelect('run.project', 'project')
      .leftJoinAndSelect('run.topics', 'topic');

    // Apply filters for runName, projectUUID, and date
    if (runName) {
      query.andWhere('run.name LIKE :runName', { runName: `%${runName}%` });
    }
    if (projectUUID) {
      query.andWhere('project.uuid = :projectUUID', { projectUUID });
    }
    if (startDate && endDate) {
      query.andWhere('run.date BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    }
    const splitTopics = topics.split(',');
    console.log('and_or:', and_or);
    if (topics && topics.length > 0) {
      if (and_or) {
        splitTopics.forEach((topic, index) => {
          query.andWhere((qb) => {
            const key = `topicUuid${index}`;
            const subQuery = qb
              .subQuery()
              .select('runTopic.runUuid')
              .from('run_topics_topic', 'runTopic')
              .where(`runTopic.topicUuid = :topicUuid${index}`, {
                [key]: topic,
              })
              .getQuery();
            return `run.Uuid IN ${subQuery}`;
          });
        });
      } else {
        query.andWhere('topic.uuid IN (:...splitTopics)', { splitTopics });
      }
    } // Execute the query
    return query.getMany();
  }

  async findOne(uuid: string) {
    return this.runRepository.findOne({
      where: { uuid },
      relations: ['project', 'topics'],
    });
  }

  async create(createRun: CreateRun, file: Express.Multer.File) {
    const project = await this.projectRepository.findOneOrFail({
      where: { uuid: createRun.projectUUID },
    });
    const formData = new FormData();
    formData.append('file', file.buffer, file.originalname);
    try {
      const response = await axios.post(
        'http://fastapi_app:8000/newBag',
        formData,
      );
      const data = response.data;
      const topics = await Promise.all(
        Object.keys(data.Topics).map((key) => {
          const topic = data.Topics[key];
          const type = data.Types[key];
          const messageCount = data['Message Count'][key];
          const frequency = data.Frequency[key];

          // Assuming this.topicService.create exists and is ready to be called
          // with the topic, type, message count, and frequency
          return this.topicService.create(topic, type, messageCount, frequency);
        }),
      );
      const date = new Date(data['start_time'] * 1000);
      console.log(topics);
      const newRun = this.runRepository.create({
        name: createRun.name,
        date,
        project,
        topics,
      });
      return this.runRepository.save(newRun);
    } catch (error) {
      console.error(error);
    }
  }

  async update(uuid: string, run: UpdateRun) {
    const db_run = await this.runRepository.findOne({ where: { uuid } });
    db_run.name = run.name;
    db_run.date = run.date;
    const project = await this.projectRepository.findOne({
      where: { uuid: run.project.uuid },
    });
    db_run.project = project;
    await this.runRepository.save(db_run);
    console.log('Updated run:', db_run);
    return this.runRepository.findOne({ where: { uuid } });
  }
}

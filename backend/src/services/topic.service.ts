import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Topic from '@common/entities/topic/topic.entity';
import { Repository } from 'typeorm';
import User from '@common/entities/user/user.entity';
import { UserRole } from '@common/frontend_shared/enum';
import { TopicNamesDto } from '@common/api/types/Topic.dto';
import { addAccessConstraints } from '../endpoints/auth/auth-helper';

@Injectable()
export class TopicService {
    constructor(
        @InjectRepository(Topic) private topicRepository: Repository<Topic>,
        @InjectRepository(User) private userRepository: Repository<User>,
    ) {}

    async findAllNames(userUuid): Promise<TopicNamesDto> {
        const baseQuery = this.topicRepository
            .createQueryBuilder('topic')
            .select('DISTINCT topic.name', 'name')
            .orderBy('name');
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUuid },
        });
        const [topics, count] = await (user.role === UserRole.ADMIN
            ? baseQuery.getRawMany()
            : addAccessConstraints(
                  baseQuery
                      .leftJoin('topic.file', 'file')
                      .leftJoin('file.mission', 'mission')
                      .leftJoin('mission.project', 'project'),
                  userUuid,
              ).getManyAndCount());

        return {
            count,
            data: topics.map((t) => t.name),
            take: count,
            skip: 0,
        };
    }

    async findAll(userUUID: string, skip: number, take: number) {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        if (user.role === UserRole.ADMIN) {
            return this.topicRepository.find({ skip, take });
        }
        return addAccessConstraints(
            this.topicRepository
                .createQueryBuilder('topic')
                .leftJoin('topic.file', 'file')
                .leftJoin('file.mission', 'mission')
                .leftJoin('mission.project', 'project')
                .take(take)
                .skip(skip),
            userUUID,
        ).getMany();
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

        return this.topicRepository.findOneOrFail({ where: { name: name } });
    }
}

import { TopicNamesDto, TopicsDto } from '@common/api/types/topic.dto';
import Topic from '@common/entities/topic/topic.entity';
import User from '@common/entities/user/user.entity';
import { UserRole } from '@common/frontend_shared/enum';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { addAccessConstraints } from '../endpoints/auth/auth-helper';
import { topicEntityToDto } from '../serialization';

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

        const topicsQuery =
            user.role === UserRole.ADMIN
                ? baseQuery
                : addAccessConstraints(
                      baseQuery
                          .leftJoin('topic.file', 'file')
                          .leftJoin('file.mission', 'mission')
                          .leftJoin('mission.project', 'project'),
                      userUuid,
                  );

        const topics = await topicsQuery.clone().getRawMany();
        const count = await topicsQuery.getCount();

        return {
            count,
            data: topics.map((topic) => topic.name),
            take: count,
            skip: 0,
        };
    }

    async findAll(
        userUUID: string,
        skip: number,
        take: number,
    ): Promise<TopicsDto> {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        if (user.role === UserRole.ADMIN) {
            const [topics, count] = await this.topicRepository.findAndCount({
                skip,
                take,
            });
            return {
                data: topics.map((element) => topicEntityToDto(element)),
                count,
                take,
                skip,
            };
        }
        const [topics, count] = await addAccessConstraints(
            this.topicRepository
                .createQueryBuilder('topic')
                .leftJoin('topic.file', 'file')
                .leftJoin('file.mission', 'mission')
                .leftJoin('mission.project', 'project')
                .take(take)
                .skip(skip),
            userUUID,
        ).getManyAndCount();

        return {
            data: topics.map((element) => topicEntityToDto(element)),
            count,
            take,
            skip,
        };
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

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Topic from '@common/entities/topic/topic.entity';
import { Brackets, Repository } from 'typeorm';
import User from '@common/entities/user/user.entity';
import { UserRole } from '@common/enum';
import { addAccessConstraints } from '../auth/authHelper';

@Injectable()
export class TopicService {
    constructor(
        @InjectRepository(Topic) private topicRepository: Repository<Topic>,
        @InjectRepository(User) private userRepository: Repository<User>,
    ) {}

    async findAllNames(userUUID) {
        const baseQuery = this.topicRepository
            .createQueryBuilder('topic')
            .select('DISTINCT topic.name', 'name')
            .orderBy('name');
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        let distinctNames: any[];
        if (user.role === UserRole.ADMIN) {
            distinctNames = await baseQuery.getRawMany();
        } else {
            distinctNames = await addAccessConstraints(
                baseQuery
                    .leftJoin('topic.file', 'file')
                    .leftJoin('file.mission', 'mission')
                    .leftJoin('mission.project', 'project'),
                userUUID,
            ).getRawMany();
        }

        return distinctNames.map((item) => item.name);
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

        return this.topicRepository.findOne({ where: { name: name } });
    }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Topic from '@common/entities/topic/topic.entity';
import { Brackets, Repository } from 'typeorm';
import User from '@common/entities/user/user.entity';
import { UserRole } from '@common/enum';

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
            distinctNames = await baseQuery
                .leftJoin('topic.file', 'file')
                .leftJoin('file.mission', 'mission')
                .leftJoin('mission.project', 'project')
                .leftJoin(
                    'ProjectAccessViewEntity',
                    'projectAccessView',
                    'projectAccessView.projectuuid = project.uuid',
                )
                .leftJoin(
                    'MissionAccessViewEntity',
                    'missionAccessView',
                    'missionAccessView.missionuuid = mission.uuid',
                )
                .leftJoin(
                    'AccessGroup',
                    'projectAccessGroup',
                    'projectAccessGroup.uuid = projectAccessView.accessgroupuuid',
                )
                .leftJoin('projectAccessGroup.users', 'projectUsers')
                .leftJoin(
                    'AccessGroup',
                    'missionAccessGroup',
                    'missionAccessGroup.uuid = missionAccessView.accessGroupUUID',
                )
                .leftJoin('missionAccessGroup.users', 'missionUsers')
                .where(
                    new Brackets((qb) => {
                        qb.where('projectUsers.uuid = :user', {
                            user: userUUID,
                        }).orWhere('missionUsers.uuid = :user', {
                            user: userUUID,
                        });
                    }),
                )
                .getRawMany();
        }

        return distinctNames.map((item) => item.name);
    }

    async findAll(userUUID: string) {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        if (user.role === UserRole.ADMIN) {
            return this.topicRepository.find();
        }
        return this.topicRepository
            .createQueryBuilder('topic')
            .leftJoin('topic.file', 'file')
            .leftJoin('file.mission', 'mission')
            .leftJoin('mission.project', 'project')
            .leftJoin(
                'ProjectAccessViewEntity',
                'projectAccessView',
                'projectAccessView.projectUUID = project.uuid',
            )
            .leftJoin(
                'MissionAccessViewEntity',
                'missionAccessView',
                'missionAccessView.missionUUID = mission.uuid',
            )
            .leftJoin('projectAccessView.accessGroup', 'projectAccessGroup')
            .leftJoin('projectAccessGroup.users', 'projectUsers')
            .leftJoin('missionAccessView.accessGroup', 'missionAccessGroup')
            .leftJoin('missionAccessGroup.users', 'missionUsers')
            .where(
                new Brackets((qb) => {
                    qb.where('projectUsers.userUUID = :user', {
                        user: userUUID,
                    }).orWhere('missionUsers.userUUID = :user', {
                        user: userUUID,
                    });
                }),
            )
            .getMany();
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

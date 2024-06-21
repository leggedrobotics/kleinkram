import { Injectable } from '@nestjs/common';
import { Brackets, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import Action from './entities/action.entity';
import { SubmitAction } from './entities/submit_action.dto';
import Apikey from '../auth/entities/apikey.entity';
import { ActionState, KeyTypes, UserRole } from '../enum';
import User from '../user/entities/user.entity';

@Injectable()
export class ActionService {
    constructor(
        @InjectRepository(Action)
        private actionRepository: Repository<Action>,

        @InjectRepository(Apikey)
        private apikeyRepository: Repository<Apikey>,

        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) {}

    async submit(data: SubmitAction): Promise<Action> {
        // TODO: write to the database

        const now = new Date();
        const newToken = this.apikeyRepository.create({
            mission: { uuid: data.missionUUID },
            apikeytype: KeyTypes.CONTAINER,
            deletedAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7),
        });
        const apikey = await this.apikeyRepository.save(newToken);

        let action = this.actionRepository.create({
            mission: { uuid: data.missionUUID },
            state: ActionState.PENDING,
            docker_image: data.docker_image,
            key: apikey,
        });
        const saved_action = await this.actionRepository.save(action);

        // return the created action mission
        action = await this.actionRepository.findOne({
            where: { uuid: action.uuid },
            relations: ['mission', 'mission.project'],
        });

        return action;
    }

    async list(mission_uuids: string, userUUID: string): Promise<Action[]> {
        const user = await this.userRepository.findOne({
            where: { uuid: userUUID },
        });
        if (user.role === UserRole.ADMIN) {
            return this.actionRepository.find({
                where: { mission: { uuid: mission_uuids } },
                relations: ['mission', 'mission.project'],
                order: { createdAt: 'DESC' },
            });
        }
        return this.actionRepository
            .createQueryBuilder('action')
            .leftJoinAndSelect('action.mission', 'mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoin('project.accessGroups', 'projectAccessgroup')
            .leftJoin('projectAccessgroup.users', 'projectUser')
            .leftJoin('mission.accessGroups', 'missionAccessgroup')
            .leftJoin('missionAccessgroup.users', 'missionUser')
            .where('mission.uuid IN (:...uuids)', {
                uuids: mission_uuids.split(','),
            })
            .where(
                new Brackets((qb) => {
                    qb.where('projectUser.uuid = :userUUID', {
                        userUUID,
                    }).orWhere('missionUser.uuid = :userUUID', { userUUID });
                }),
            )
            .orderBy('action.createdAt', 'DESC')
            .getMany();
    }

    async details(action_uuid: string) {
        return await this.actionRepository.findOne({
            where: { uuid: action_uuid },
            relations: ['mission', 'mission.project'],
        });
    }

    async clear() {
        return await this.actionRepository.query('DELETE FROM "action"');
    }
}

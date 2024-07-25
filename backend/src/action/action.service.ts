import { Injectable } from '@nestjs/common';
import { Brackets, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { SubmitAction } from './entities/submit_action.dto';
import Action from '@common/entities/action/action.entity';
import User from '@common/entities/user/user.entity';
import { ActionState, UserRole } from '@common/enum';
import { addAccessJoinsAndConditions } from '../auth/authHelper';

@Injectable()
export class ActionService {
    constructor(
        @InjectRepository(Action)
        private actionRepository: Repository<Action>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) {}

    async submit(data: SubmitAction): Promise<Action> {
        let action = this.actionRepository.create({
            mission: { uuid: data.missionUUID },
            state: ActionState.PENDING,
            docker_image: data.docker_image,
        });
        await this.actionRepository.save(action);

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
        return addAccessJoinsAndConditions(
            this.actionRepository
                .createQueryBuilder('action')
                .leftJoinAndSelect('action.mission', 'mission')
                .leftJoinAndSelect('mission.project', 'project')
                .where('mission.uuid IN (:...uuids)', {
                    uuids: mission_uuids.split(','),
                })
                .orderBy('action.createdAt', 'DESC'),
            userUUID,
        ).getMany();
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

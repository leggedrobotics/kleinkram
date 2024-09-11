import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { SubmitAction } from './entities/submit_action.dto';
import Action from '@common/entities/action/action.entity';
import User from '@common/entities/user/user.entity';
import { ActionState, UserRole } from '@common/enum';
import { addAccessConstraints } from '../auth/authHelper';
import { JWTUser } from '../auth/paramDecorator';
import { RuntimeRequirements } from '@common/types';

@Injectable()
export class ActionService {
    constructor(
        @InjectRepository(Action)
        private actionRepository: Repository<Action>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) {}

    async submit(
        data: SubmitAction,
        runtime_requirements: RuntimeRequirements,
        user: JWTUser,
    ): Promise<Action> {
        let action = this.actionRepository.create({
            mission: { uuid: data.missionUUID },
            createdBy: { uuid: user.uuid },
            state: ActionState.PENDING,
            runtime_requirements,
            image: {
                name: data.docker_image,
                sha: null,
                repo_digests: null,
            },
            command: data.command,
        });
        await this.actionRepository.save(action);

        // return the created action mission
        action = await this.actionRepository.findOne({
            where: { uuid: action.uuid },
            relations: ['mission', 'mission.project'],
        });

        return action;
    }

    async list(
        mission_uuid: string,
        userUUID: string,
        skip: number,
        take: number,
        sortBy: string,
        descending: boolean,
    ): Promise<[Action[], number]> {
        const user = await this.userRepository.findOne({
            where: { uuid: userUUID },
        });
        if (user.role === UserRole.ADMIN) {
            return this.actionRepository.findAndCount({
                where: { mission: { uuid: mission_uuid } },
                relations: ['mission', 'mission.project', 'createdBy'],
                order: { [sortBy]: descending ? 'DESC' : 'ASC' },
                skip,
                take,
            });
        }
        return addAccessConstraints(
            this.actionRepository
                .createQueryBuilder('action')
                .leftJoinAndSelect('action.mission', 'mission')
                .leftJoinAndSelect('mission.project', 'project')
                .where('mission.uuid IN (:...uuids)', {
                    uuids: mission_uuid.split(','),
                })
                .skip(skip)
                .take(take)
                .orderBy('action.' + sortBy, descending ? 'DESC' : 'ASC'),
            userUUID,
        )
            .leftJoinAndSelect('action.createdBy', 'createdBy')
            .getManyAndCount();
    }

    async details(action_uuid: string) {
        return await this.actionRepository.findOneOrFail({
            where: { uuid: action_uuid },
            relations: ['mission', 'mission.project', 'createdBy'],
        });
    }
}

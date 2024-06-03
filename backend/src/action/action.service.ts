import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import Action from './entities/action.entity';
import { SubmitAction } from './entities/submit_action.dto';
import Apikey from '../auth/entities/apikey.entity';
import { ActionState, KeyTypes } from '../enum';

@Injectable()
export class ActionService {
    constructor(
        @InjectRepository(Action)
        private actionRepository: Repository<Action>,

        @InjectRepository(Apikey)
        private apikeyRepository: Repository<Apikey>,
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

    async list(mission_uuids: string): Promise<Action[]> {
        return await this.actionRepository.find({
            where: { mission: { uuid: mission_uuids } },
            relations: ['mission', 'mission.project'],
            order: { createdAt: 'DESC' },
        });
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

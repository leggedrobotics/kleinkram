import { ConflictException, Injectable } from '@nestjs/common';
import { ILike, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { SubmitAction, SubmitActionMulti } from './entities/submit_action.dto';
import Action from '@common/entities/action/action.entity';
import User from '@common/entities/user/user.entity';
import { ActionState, UserRole } from '@common/enum';
import { addAccessConstraints } from '../auth/authHelper';
import { JWTUser } from '../auth/paramDecorator';
import ActionTemplate from '@common/entities/action/actionTemplate.entity';
import { QueueService } from '../queue/queue.service';
import {
    CreateTemplateDto,
    UpdateTemplateDto,
} from './entities/createTemplate.dto';

@Injectable()
export class ActionService {
    constructor(
        @InjectRepository(Action)
        private actionRepository: Repository<Action>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(ActionTemplate)
        private actionTemplateRepository: Repository<ActionTemplate>,
        private readonly queueService: QueueService,
    ) {}

    async submit(data: SubmitAction, user: JWTUser): Promise<Action> {
        const template = await this.actionTemplateRepository.findOneOrFail({
            where: { uuid: data.templateUUID },
        });

        let action = this.actionRepository.create({
            mission: { uuid: data.missionUUID },
            createdBy: { uuid: user.uuid },
            state: ActionState.PENDING,
            template,
        });
        await this.actionRepository.save(action);

        // return the created action mission
        action = await this.actionRepository.findOne({
            where: { uuid: action.uuid },
            relations: ['mission', 'mission.project'],
        });

        await this.queueService.addActionQueue(action.uuid);
        return action;
    }

    async multiSubmit(data: SubmitActionMulti, user: JWTUser) {
        return Promise.all(
            data.missionUUIDs.map((uuid) =>
                this.submit(
                    { missionUUID: uuid, templateUUID: data.templateUUID },
                    user,
                ),
            ),
        );
    }

    async createTemplate(data: CreateTemplateDto, user: JWTUser) {
        if (!data.image.startsWith('rslethz/')) {
            throw new ConflictException(
                'Only images from the rslethz namespace are allowed',
            );
        }
        const exists = await this.actionTemplateRepository.exists({
            where: {
                name: data.name,
            },
        });
        if (exists) {
            throw new ConflictException(
                'Template with this name already exists',
            );
        }
        const template = this.actionTemplateRepository.create({
            createdBy: { uuid: user.uuid },
            name: data.name,
            runtime_requirements: data.runtime_requirements,
            image_name: data.image,
            command: data.command,
            searchable: data.searchable,
        });
        return this.actionTemplateRepository.save(template);
    }

    async createNewVersion(data: UpdateTemplateDto, user: JWTUser) {
        if (!data.image.startsWith('rslethz/')) {
            throw new ConflictException(
                'Only images from the rslethz namespace are allowed',
            );
        }
        const template = await this.actionTemplateRepository.findOneOrFail({
            where: { uuid: data.uuid },
        });
        if (
            !template.searchable &&
            data.searchable &&
            template.runtime_requirements.gpu_model.name ===
                data.runtime_requirements.gpu_model.name &&
            template.image_name === data.image &&
            template.command === data.command
        ) {
            console.log('making template searchable');
            template.searchable = true;
            return this.actionTemplateRepository.save(template);
        }
        const dbuser = await this.userRepository.findOneOrFail({
            where: { uuid: user.uuid },
        });
        const direction = data.searchable ? 'DESC' : 'ASC';
        const change = data.searchable ? 1 : -1;
        const previousVersions = await this.actionTemplateRepository.find({
            where: { name: data.name },
            order: { version: direction },
            take: 1,
        });
        template.name = data.name;
        template.runtime_requirements = data.runtime_requirements;
        template.image_name = data.image;
        template.createdBy = dbuser;
        template.command = data.command;
        template.version = previousVersions[0].version + change;
        template.uuid = undefined;
        template.searchable = data.searchable;
        return this.actionTemplateRepository.save(template);
    }

    async listTemplates(skip: number, take: number, search: string) {
        const where = { searchable: true };
        if (search) {
            where['name'] = ILike(`%${search}%`);
        }
        return this.actionTemplateRepository.findAndCount({
            where,
            skip,
            take,
            relations: ['createdBy'],
        });
    }

    async listActions(
        project_uuid: string,
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
                where: {
                    mission: {
                        uuid: mission_uuid,
                        project: { uuid: project_uuid },
                    },
                },
                relations: [
                    'mission',
                    'mission.project',
                    'createdBy',
                    'template',
                ],
                order: { [sortBy]: descending ? 'DESC' : 'ASC' },
                skip,
                take,
            });
        }

        const baseQuery = this.actionRepository
            .createQueryBuilder('action')
            .leftJoinAndSelect('action.mission', 'mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('action.template', 'template')
            .leftJoinAndSelect('action.createdBy', 'createdBy')
            .andWhere('project.uuid = :project_uuid', { project_uuid })
            .skip(skip)
            .take(take)
            .orderBy('action.' + sortBy, descending ? 'DESC' : 'ASC');

        if (mission_uuid) {
            baseQuery.andWhere('mission.uuid = :mission_uuid', {
                mission_uuid,
            });
        }
        return addAccessConstraints(baseQuery, userUUID).getManyAndCount();
    }

    async details(action_uuid: string) {
        return await this.actionRepository.findOneOrFail({
            where: { uuid: action_uuid },
            relations: ['mission', 'mission.project', 'createdBy', 'template'],
        });
    }
}

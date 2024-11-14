import { ConflictException, Injectable } from '@nestjs/common';
import { Brackets, ILike, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { SubmitAction, SubmitActionMulti } from './entities/submit_action.dto';
import Action from '@common/entities/action/action.entity';
import User from '@common/entities/user/user.entity';
import { ActionState, UserRole } from '@common/enum';
import { addAccessConstraints } from '../auth/authHelper';
import { AuthRes } from '../auth/paramDecorator';
import ActionTemplate from '@common/entities/action/actionTemplate.entity';
import { QueueService } from '../queue/queue.service';
import {
    CreateTemplateDto,
    UpdateTemplateDto,
} from './entities/createTemplate.dto';
import Apikey from '@common/entities/auth/apikey.entity';
import { RuntimeDescription } from '@common/types';

@Injectable()
export class ActionService {
    constructor(
        @InjectRepository(Action)
        private actionRepository: Repository<Action>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(ActionTemplate)
        private actionTemplateRepository: Repository<ActionTemplate>,
        @InjectRepository(Apikey)
        private apikeyRepository: Repository<Apikey>,
        private readonly queueService: QueueService,
    ) {}

    async submit(data: SubmitAction, auth: AuthRes): Promise<Action> {
        const template = await this.actionTemplateRepository.findOneOrFail({
            where: { uuid: data.templateUUID },
        });

        let action = this.actionRepository.create({
            mission: { uuid: data.missionUUID },
            createdBy: { uuid: auth.user.uuid },
            state: ActionState.PENDING,
            template,
        });
        await this.actionRepository.save(action);

        // return the created action mission
        action = await this.actionRepository.findOne({
            where: { uuid: action.uuid },
            relations: ['mission', 'mission.project', 'template'],
        });
        const res = await this.queueService._addActionQueue(action, {
            cpuCores: template.cpuCores,
            cpuMemory: template.cpuMemory,
            gpuMemory: template.gpuMemory,
            maxRuntime: template.maxRuntime,
        } as RuntimeDescription);
        if (!res) {
            action.state = ActionState.UNPROCESSABLE;
            await this.actionRepository.save(action);
            throw new ConflictException(
                'No worker available with the required hardware capabilities',
            );
        }
        return action;
    }

    async delete(actionUUID: string) {
        await this.actionRepository.delete(actionUUID);
        return true;
    }

    async multiSubmit(data: SubmitActionMulti, user: AuthRes) {
        return Promise.all(
            data.missionUUIDs.map((uuid) =>
                this.submit(
                    { missionUUID: uuid, templateUUID: data.templateUUID },
                    user,
                ),
            ),
        );
    }

    async createTemplate(data: CreateTemplateDto, auth: AuthRes) {
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
            createdBy: { uuid: auth.user.uuid },
            name: data.name,
            cpuCores: data.cpuCores,
            cpuMemory: data.cpuMemory,
            gpuMemory: data.gpuMemory,
            maxRuntime: data.maxRuntime,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            image_name: data.image,
            command: data.command,
            searchable: data.searchable,
            entrypoint: data.entrypoint,
            accessRights: data.accessRights,
        });
        return this.actionTemplateRepository.save(template);
    }

    async createNewVersion(data: UpdateTemplateDto, auth: AuthRes) {
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
            template.image_name === data.image &&
            template.command === data.command &&
            template.cpuCores === data.cpuCores &&
            template.cpuMemory === data.cpuMemory &&
            template.gpuMemory === data.gpuMemory &&
            template.maxRuntime === data.maxRuntime &&
            template.entrypoint === data.entrypoint &&
            template.accessRights === data.accessRights
        ) {
            template.searchable = true;
            return this.actionTemplateRepository.save(template);
        }
        const dbuser = await this.userRepository.findOneOrFail({
            where: { uuid: auth.user.uuid },
        });
        const direction = data.searchable ? 'DESC' : 'ASC';
        const change = data.searchable ? 1 : -1;
        const previousVersions = await this.actionTemplateRepository.find({
            where: { name: data.name },
            order: { version: direction },
            take: 1,
        });
        template.name = data.name;
        template.cpuCores = data.cpuCores;
        template.cpuMemory = data.cpuMemory;
        template.gpuMemory = data.gpuMemory;
        template.image_name = data.image;
        template.createdBy = dbuser;
        template.command = data.command;
        template.version = previousVersions[0].version + change;
        template.uuid = undefined;
        template.searchable = data.searchable;
        template.maxRuntime = data.maxRuntime;
        template.entrypoint = data.entrypoint;
        template.accessRights = data.accessRights;
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
        projectUuid: string,
        missionUuid: string,
        userUUID: string,
        skip: number,
        take: number,
        sortBy: string,
        descending: boolean,
        search: string,
    ): Promise<[Action[], number]> {
        const user = await this.userRepository.findOne({
            where: { uuid: userUUID },
        });
        if (user.role === UserRole.ADMIN) {
            const query = this.actionRepository
                .createQueryBuilder('action')
                .leftJoinAndSelect('action.mission', 'mission')
                .leftJoinAndSelect('mission.project', 'project')
                .leftJoinAndSelect('action.createdBy', 'createdBy')
                .leftJoinAndSelect('action.template', 'template')
                .andWhere('project.uuid = :projectUuid', { projectUuid })
                .orderBy(`action.${sortBy}`, descending ? 'DESC' : 'ASC')
                .skip(skip)
                .take(take);
            if (search) {
                query.andWhere(
                    new Brackets((qb) => {
                        qb.where('template.name ILIKE :searchTerm', {
                            searchTerm: `%${search}%`,
                        })
                            .orWhere('action.state_cause ILIKE :searchTerm', {
                                searchTerm: `%${search}%`,
                            })
                            .orWhere('template.image_name ILIKE :searchTerm', {
                                searchTerm: `%${search}%`,
                            });
                    }),
                );
            }
            if (missionUuid) {
                query.andWhere('mission.uuid = :missionUuid', { missionUuid });
            }
            return query.getManyAndCount();
        }

        const baseQuery = this.actionRepository
            .createQueryBuilder('action')
            .leftJoinAndSelect('action.mission', 'mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('action.template', 'template')
            .leftJoinAndSelect('action.createdBy', 'createdBy')
            .andWhere('project.uuid = :project_uuid', {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                project_uuid: projectUuid,
            })
            .skip(skip)
            .take(take)
            .orderBy('action.' + sortBy, descending ? 'DESC' : 'ASC');

        if (missionUuid) {
            baseQuery.andWhere('mission.uuid = :mission_uuid', {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                mission_uuid: missionUuid,
            });
        }
        if (search) {
            baseQuery.andWhere(
                new Brackets((qb) => {
                    qb.where('template.name ILIKE :searchTerm', {
                        searchTerm: `%${search}%`,
                    })
                        .orWhere('action.state_cause ILIKE :searchTerm', {
                            searchTerm: `%${search}%`,
                        })
                        .orWhere('template.image_name ILIKE :searchTerm', {
                            searchTerm: `%${search}%`,
                        });
                }),
            );
        }
        return addAccessConstraints(baseQuery, userUUID).getManyAndCount();
    }

    async details(actionUuid: string) {
        return await this.actionRepository.findOneOrFail({
            where: { uuid: actionUuid },
            relations: [
                'mission',
                'mission.project',
                'createdBy',
                'template',
                'worker',
            ],
        });
    }

    async runningActions(userUUID: string, skip: number, take: number) {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });

        const baseQuery = this.actionRepository
            .createQueryBuilder('action')
            .leftJoinAndSelect('action.mission', 'mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('action.template', 'template')
            .leftJoinAndSelect('action.createdBy', 'createdBy')
            .where(
                new Brackets((qb) => {
                    qb.where('action.state = :state', {
                        state: ActionState.PENDING,
                    }).orWhere('action.state = :state', {
                        state: ActionState.PROCESSING,
                    });
                }),
            )
            .take(take)
            .skip(skip);
        if (user.role !== UserRole.ADMIN) {
            addAccessConstraints(baseQuery, userUUID);
        }
        return baseQuery.getManyAndCount();
    }

    async writeAuditLog(
        apiKey: string,
        auditLog: {
            method: string;
            url: string;
        },
    ) {
        await this.apikeyRepository.manager.transaction(async (manager) => {
            const key = await manager.findOneOrFail(Apikey, {
                where: { apikey: apiKey },
                relations: ['action'],
            });

            const action = key.action;
            if (!action) {
                return;
            }

            if (!action.auditLogs) {
                action.auditLogs = [];
            }

            action.auditLogs.push(auditLog);
            await manager.save(action);
        });
    }
}

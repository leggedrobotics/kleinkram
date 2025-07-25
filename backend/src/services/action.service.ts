import ActionTemplate from '@common/entities/action/action-template.entity';
import Action from '@common/entities/action/action.entity';
import User from '@common/entities/user/user.entity';
import { ActionState, UserRole } from '@common/frontend_shared/enum';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { actionEntityToDto, actionTemplateEntityToDto } from '../serialization';
import { QueueService } from './queue.service';

import {
    ActionTemplateDto,
    ActionTemplatesDto,
} from '@common/api/types/actions/action-template.dto';
import { ActionDto, ActionsDto } from '@common/api/types/actions/action.dto';
import {
    CreateTemplateDto,
    UpdateTemplateDto,
} from '@common/api/types/create-template.dto';
import {
    ActionSubmitResponseDto,
    SubmitActionDto,
} from '@common/api/types/submit-action-response.dto';
import { SubmitActionMulti } from '@common/api/types/submit-action.dto';
import Apikey from '@common/entities/auth/apikey.entity';
import { RuntimeDescription } from '@common/types';
import { addAccessConstraints } from '../endpoints/auth/auth-helper';
import { AuthHeader } from '../endpoints/auth/parameter-decorator';

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

    async submit(
        data: SubmitActionDto,
        auth: AuthHeader,
    ): Promise<ActionSubmitResponseDto> {
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
        action = await this.actionRepository.findOneOrFail({
            where: { uuid: action.uuid },
            relations: ['mission', 'mission.project', 'template'],
        });
        const result = await this.queueService._addActionQueue(action, {
            cpuCores: template.cpuCores,
            cpuMemory: template.cpuMemory,
            gpuMemory: template.gpuMemory,
            maxRuntime: template.maxRuntime,
        } as RuntimeDescription);
        if (!Boolean(result)) {
            action.state = ActionState.UNPROCESSABLE;
            await this.actionRepository.save(action);
            throw new ConflictException(
                'No worker available with the required hardware capabilities',
            );
        }
        return {
            actionUUID: action.uuid,
        };
    }

    async delete(actionUUID: string) {
        await this.actionRepository.delete(actionUUID);
        return true;
    }

    async multiSubmit(data: SubmitActionMulti, user: AuthHeader) {
        return Promise.all(
            data.missionUUIDs.map((uuid) =>
                this.submit(
                    { missionUUID: uuid, templateUUID: data.templateUUID },
                    user,
                ),
            ),
        );
    }

    async createTemplate(
        data: CreateTemplateDto,
        auth: AuthHeader,
    ): Promise<ActionTemplateDto> {
        if (!data.dockerImage.startsWith('rslethz/')) {
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
            image_name: data.dockerImage,
            command: data.command ?? '',
            searchable: data.searchable,
            entrypoint: data.entrypoint ?? '',
            accessRights: data.accessRights,
        });

        const createdTemplate =
            await this.actionTemplateRepository.save(template);

        return actionTemplateEntityToDto(createdTemplate);
    }

    async createNewVersion(
        data: UpdateTemplateDto,
        auth: AuthHeader,
    ): Promise<ActionTemplateDto> {
        if (!data.dockerImage.startsWith('rslethz/')) {
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
            template.image_name === data.dockerImage &&
            template.command === data.command &&
            template.cpuCores === data.cpuCores &&
            template.cpuMemory === data.cpuMemory &&
            template.gpuMemory === data.gpuMemory &&
            template.maxRuntime === data.maxRuntime &&
            template.entrypoint === data.entrypoint &&
            template.accessRights === data.accessRights
        ) {
            template.searchable = true;
            const savedTemplate =
                await this.actionTemplateRepository.save(template);
            return actionTemplateEntityToDto(savedTemplate);
        }
        const dbuser = await this.userRepository.findOneOrFail({
            where: { uuid: auth.user.uuid },
        });
        const direction = data.searchable ? 'DESC' : 'ASC';
        const change = data.searchable ? 1 : -1;
        const previousVersions =
            await this.actionTemplateRepository.findOneOrFail({
                where: { name: data.name },
                order: { version: direction },
            });
        template.name = data.name;
        template.cpuCores = data.cpuCores;
        template.cpuMemory = data.cpuMemory;
        template.gpuMemory = data.gpuMemory;
        template.image_name = data.dockerImage;
        template.createdBy = dbuser;
        template.command = data.command ?? '';
        template.version = previousVersions[0]?.version ?? 0 + change;
        template.uuid = '';
        template.searchable = data.searchable;
        template.maxRuntime = data.maxRuntime;
        template.entrypoint = data.entrypoint ?? '';
        template.accessRights = data.accessRights;

        const savedTemplate =
            await this.actionTemplateRepository.save(template);
        return actionTemplateEntityToDto(savedTemplate);
    }

    async listTemplates(
        skip: number,
        take: number,
        search: string,
    ): Promise<ActionTemplatesDto> {
        const where: FindOptionsWhere<ActionTemplate> = { searchable: true };
        if (search !== '') {
            where.name = ILike(`%${search}%`);
        }
        const [templates, count] =
            await this.actionTemplateRepository.findAndCount({
                where,
                skip,
                take,
                relations: ['createdBy'],
            });

        return {
            count,
            data: templates.map((element) =>
                actionTemplateEntityToDto(element),
            ),
            skip,
            take,
        };
    }

    async listActions(
        projectUuid: string | undefined,
        missionUuid: string | undefined,
        userUUID: string,
        skip: number,
        take: number,
        sortBy: string,
        sortDirection: 'ASC' | 'DESC',
        search: string,
    ): Promise<ActionsDto> {
        const user = await this.userRepository.findOneOrFail({
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
                .orderBy(`action.${sortBy}`, sortDirection)
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

            const [actions, count] = await query.getManyAndCount();
            return {
                count,
                data: actions.map((element) => actionEntityToDto(element)),
                skip,
                take,
            };
        }

        const baseQuery = this.actionRepository
            .createQueryBuilder('action')
            .leftJoinAndSelect('action.mission', 'mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('action.template', 'template')
            .leftJoinAndSelect('action.createdBy', 'createdBy')
            .andWhere('project.uuid = :projectUuid', {
                projectUuid: projectUuid,
            })
            .skip(skip)
            .take(take)
            .orderBy(`action.${sortBy}`, sortDirection);

        if (missionUuid) {
            baseQuery.andWhere('mission.uuid = :missionUuid', {
                missionUuid: missionUuid,
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

        const [actions, count] = await addAccessConstraints(
            baseQuery,
            userUUID,
        ).getManyAndCount();

        return {
            count,
            data: actions.map((element) => actionEntityToDto(element)),
            skip,
            take,
        };
    }

    async details(actionUuid: string): Promise<ActionDto> {
        const action = await this.actionRepository.findOneOrFail({
            where: { uuid: actionUuid },
            relations: [
                'mission',
                'mission.project',
                'createdBy',
                'template',
                'worker',
            ],
        });

        return actionEntityToDto(action);
    }

    async runningActions(
        userUUID: string,
        skip: number,
        take: number,
    ): Promise<ActionsDto> {
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
        const [data, count] = await baseQuery.getManyAndCount();
        return { data: data as unknown as ActionDto[], count, skip, take };
    }

    async writeAuditLog(
        apiKey: string,
        auditLog: {
            method: string;
            url: string;
        },
    ) {
        await this.apikeyRepository.manager.transaction(async (manager) => {
            const key: Apikey = await manager.findOneOrFail(Apikey, {
                where: { apikey: apiKey },
                relations: ['action'],
            });

            const action: Action | undefined = key.action;
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

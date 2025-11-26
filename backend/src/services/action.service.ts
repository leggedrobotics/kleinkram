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
import ActionTemplateEntity from '@common/entities/action/action-template.entity';
import ActionEntity from '@common/entities/action/action.entity';
import ApikeyEntity from '@common/entities/auth/apikey.entity';
import MissionEntity from '@common/entities/mission/mission.entity';
import UserEntity from '@common/entities/user/user.entity';
import environment from '@common/environment';
import {
    ActionState,
    ArtifactState,
    UserRole,
} from '@common/frontend_shared/enum';
import { ActionDispatcherService } from '@common/modules/action-dispatcher/action-dispatcher.service';
import { StorageService } from '@common/modules/storage/storage.service';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
    Brackets,
    EntityManager,
    FindOptionsWhere,
    ILike,
    QueryFailedError,
    Repository,
    SelectQueryBuilder,
} from 'typeorm';
import { addAccessConstraints } from '../endpoints/auth/auth-helper';
import { AuthHeader } from '../endpoints/auth/parameter-decorator';
import logger from '../logger';
import { actionEntityToDto, actionTemplateEntityToDto } from '../serialization';

@Injectable()
export class ActionService {
    private readonly DOCKER_NAMESPACE =
        process.env['VITE_DOCKER_HUB_NAMESPACE'];

    constructor(
        @InjectRepository(ActionEntity)
        private actionRepository: Repository<ActionEntity>,
        @InjectRepository(UserEntity)
        private userRepository: Repository<UserEntity>,
        @InjectRepository(ActionTemplateEntity)
        private actionTemplateRepository: Repository<ActionTemplateEntity>,
        @InjectRepository(ApikeyEntity)
        private apikeyRepository: Repository<ApikeyEntity>,
        @InjectRepository(MissionEntity)
        private missionRepository: Repository<MissionEntity>,
        private readonly actionDispatcher: ActionDispatcherService,
        private readonly storageService: StorageService,
    ) {}

    /**
     * Refactored submit: Delegates lifecycle management to the Dispatcher.
     */
    async submit(
        data: SubmitActionDto,
        auth: AuthHeader,
    ): Promise<ActionSubmitResponseDto> {
        // Resolve Entities (Dispatcher requires Entities, not UUIDs)
        const creator = await this.userRepository.findOneOrFail({
            where: { uuid: auth.user.uuid },
        });

        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: data.missionUUID },
        });

        const actionUUID = await this.actionDispatcher.dispatch(
            data.templateUUID,
            mission,
            creator,
            {}, // DTO doesn't currently support dynamic params, passing empty
        );

        return { actionUUID };
    }

    async delete(actionUUID: string): Promise<boolean> {
        // Note: If the action is running, you might want to call actionDispatcher.stopAction(actionUUID) first.
        // For now, maintaining existing behavior of entity deletion.
        await this.actionRepository.delete(actionUUID);
        return true;
    }

    async multiSubmit(
        data: SubmitActionMulti,
        user: AuthHeader,
    ): Promise<ActionSubmitResponseDto[]> {
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
        this.validateDockerNamespace(data.dockerImage);

        const template = this.actionTemplateRepository.create({
            ...data,
            creator: { uuid: auth.user.uuid },
            image_name: data.dockerImage,
            command: data.command ?? '',
            entrypoint: data.entrypoint ?? '',
        });

        try {
            const saved = await this.actionTemplateRepository.save(template);
            return actionTemplateEntityToDto(saved);
        } catch (error) {
            // Postgres Error 23505 is Unique Violation
            if (
                error instanceof QueryFailedError &&
                error.driverError?.code === '23505'
            ) {
                throw new ConflictException(
                    'Template with this name already exists',
                );
            }
            throw error;
        }
    }

    async createNewVersion(
        data: UpdateTemplateDto,
        auth: AuthHeader,
    ): Promise<ActionTemplateDto> {
        const currentTemplate =
            await this.actionTemplateRepository.findOneOrFail({
                where: { uuid: data.uuid },
            });

        if (this.isMetadataUpdateOnly(currentTemplate, data)) {
            currentTemplate.searchable = true;
            return actionTemplateEntityToDto(
                await this.actionTemplateRepository.save(currentTemplate),
            );
        }

        const creator = await this.userRepository.findOneOrFail({
            where: { uuid: auth.user.uuid },
        });
        const nextVersion = await this.calculateNextVersion(
            data.name,
            data.searchable,
        );

        const newTemplate = this.actionTemplateRepository.create({
            ...data,
            image_name: data.dockerImage,
            creator,
            version: nextVersion,
            command: data.command ?? '',
            entrypoint: data.entrypoint ?? '',
        });

        return actionTemplateEntityToDto(
            await this.actionTemplateRepository.save(newTemplate),
        );
    }

    async listTemplates(
        skip: number,
        take: number,
        search: string,
    ): Promise<ActionTemplatesDto> {
        const where: FindOptionsWhere<ActionTemplateEntity> = {
            searchable: true,
        };
        if (search !== '') {
            where.name = ILike(`%${search}%`);
        }
        const [templates, count] =
            await this.actionTemplateRepository.findAndCount({
                where,
                skip,
                take,
                relations: ['creator'],
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
        const isAdmin = user.role === UserRole.ADMIN;

        const qb = this.buildBaseActionQuery();

        // Apply Filters
        if (projectUuid)
            qb.andWhere('project.uuid = :projectUuid', { projectUuid });
        if (missionUuid)
            qb.andWhere('mission.uuid = :missionUuid', { missionUuid });
        if (search) this.applySearchFilter(qb, search);

        // Apply Sorting
        if (sortBy && ['ASC', 'DESC'].includes(sortDirection)) {
            qb.orderBy(`action.${sortBy}`, sortDirection);
        }

        // Apply Security & Pagination
        if (!isAdmin) {
            addAccessConstraints(qb, userUUID);
        }

        const [actions, count] = await qb
            .skip(skip)
            .take(take)
            .getManyAndCount();

        return {
            count,
            skip,
            take,
            data: actions.map((element) => actionEntityToDto(element)),
        };
    }

    async details(actionUuid: string): Promise<ActionDto> {
        const action = await this.actionRepository.findOneOrFail({
            where: { uuid: actionUuid },
            relations: [
                'mission',
                'mission.project',
                'creator',
                'template',
                'worker',
            ],
        });

        const dto = actionEntityToDto(action);

        if (action.artifacts === ArtifactState.UPLOADED) {
            dto.artifactUrl = await this.generateArtifactUrl(
                dto.artifactUrl,
                action,
            );
        }

        return dto;
    }

    async runningActions(
        userUUID: string,
        skip: number,
        take: number,
    ): Promise<ActionsDto> {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });

        const qb = this.buildBaseActionQuery();
        qb.andWhere('action.state IN (:...states)', {
            states: [ActionState.PENDING, ActionState.PROCESSING],
        });

        if (user.role !== UserRole.ADMIN) {
            addAccessConstraints(qb, userUUID);
        }

        const [actions, count] = await qb
            .skip(skip)
            .take(take)
            .getManyAndCount();
        return {
            count,
            data: actions.map((element) => actionEntityToDto(element)),
            skip,
            take,
        };
    }

    async writeAuditLog(
        apiKey: string,
        auditLog: {
            method: string;
            url: string;
        },
    ): Promise<void> {
        await this.apikeyRepository.manager.transaction(
            async (manager: EntityManager): Promise<void> => {
                const key: ApikeyEntity = await manager.findOneOrFail(
                    ApikeyEntity,
                    {
                        where: { apikey: apiKey },
                        relations: ['action'],
                    },
                );

                const action: ActionEntity | undefined = key.action;
                if (action === undefined) return;

                action.auditLogs ??= [];
                action.auditLogs.push(auditLog);
                await manager.save(action);
            },
        );
    }

    private validateDockerNamespace(imageName: string): void {
        if (
            this.DOCKER_NAMESPACE &&
            !imageName.startsWith(this.DOCKER_NAMESPACE)
        ) {
            throw new ConflictException(
                `Only images from the ${this.DOCKER_NAMESPACE} namespace are allowed`,
            );
        }
    }

    private async calculateNextVersion(
        name: string,
        isSearchable: boolean,
    ): Promise<number> {
        const direction = isSearchable ? 'DESC' : 'ASC';
        const lastVersionTemplate = await this.actionTemplateRepository.findOne(
            {
                where: { name },
                order: { version: direction },
            },
        );

        const currentVersion = lastVersionTemplate?.version ?? 0;
        const change = isSearchable ? 1 : -1;

        return currentVersion + change;
    }

    private isMetadataUpdateOnly(
        current: ActionTemplateEntity,
        incoming: UpdateTemplateDto,
    ): boolean {
        if (current.searchable) return false;
        if (!incoming.searchable) return false;

        return (
            current.image_name === incoming.dockerImage &&
            current.command === incoming.command &&
            current.cpuCores === incoming.cpuCores &&
            current.cpuMemory === incoming.cpuMemory &&
            current.gpuMemory === incoming.gpuMemory &&
            current.maxRuntime === incoming.maxRuntime &&
            current.entrypoint === incoming.entrypoint &&
            current.accessRights === incoming.accessRights
        );
    }

    private buildBaseActionQuery(): SelectQueryBuilder<ActionEntity> {
        return this.actionRepository
            .createQueryBuilder('action')
            .leftJoinAndSelect('action.mission', 'mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('action.template', 'template')
            .leftJoinAndSelect('action.creator', 'creator');
    }

    private applySearchFilter(
        qb: SelectQueryBuilder<ActionEntity>,
        search: string,
    ): void {
        qb.andWhere(
            new Brackets((sub) => {
                sub.where('template.name ILIKE :searchTerm', {
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

    private async generateArtifactUrl(
        currentUrl: string,
        action: ActionEntity,
    ): Promise<string> {
        const bucketName = environment.MINIO_ARTIFACTS_BUCKET_NAME;

        if (currentUrl && !currentUrl.includes(bucketName)) {
            return currentUrl;
        }

        try {
            const friendlyFilename = `${action.template?.name ?? 'artifact'}-${action.uuid}.tar.gz`;

            return await this.storageService.getPresignedDownloadUrl(
                bucketName,
                `${action.uuid}.tar.gz`,
                4 * 60 * 60,
                {
                    'response-content-disposition': `attachment; filename="${friendlyFilename}"`,
                },
            );
        } catch (error) {
            logger.error(
                `Failed to generate presigned URL for action ${action.uuid}:`,
                error,
            );
            return '';
        }
    }

    /**
     * Checks if an action template name is already in use.
     */
    async isNameAvailable(name: string): Promise<boolean> {
        // We only check against searchable templates or all templates depending on requirement.
        // Usually, names must be unique globally or per visibility.
        // Based on createTemplate, unique violation happens on 'name'.
        const count = await this.actionTemplateRepository.count({
            where: { name },
        });
        return count === 0;
    }
}

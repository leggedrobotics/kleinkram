import { AuthHeader } from '@/endpoints/auth/parameter-decorator';
import { actionTemplateEntityToDto } from '@/serialization/action-template';
import {
    ActionTemplateDto,
    ActionTemplatesDto,
    CreateTemplateDto,
    DeleteTemplateResponseDto,
    UpdateTemplateDto,
} from '@kleinkram/api-dto';
import { ActionTemplateEntity } from '@kleinkram/backend-common/entities/action/action-template.entity';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { UserRole } from '@kleinkram/shared';
import {
    isImageInDockerNamespace,
    normalizeDockerNamespace,
    validateDockerImageName,
} from '@kleinkram/validation';
import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, QueryFailedError, Repository } from 'typeorm';

@Injectable()
export class TemplateService {
    private readonly DOCKER_NAMESPACE = normalizeDockerNamespace(
        process.env.VITE_DOCKER_HUB_NAMESPACE,
    );

    constructor(
        @InjectRepository(ActionTemplateEntity)
        private actionTemplateRepository: Repository<ActionTemplateEntity>,
        @InjectRepository(ActionEntity)
        private actionRepository: Repository<ActionEntity>,
    ) {}

    async create(
        data: CreateTemplateDto,
        auth: AuthHeader,
    ): Promise<ActionTemplateDto> {
        this.validateDockerNamespace(data.dockerImage);

        const template = this.actionTemplateRepository.create({
            // eslint-disable-next-line @typescript-eslint/no-misused-spread
            ...data,
            creator: { uuid: auth.user.uuid },

            // eslint-disable-next-line @typescript-eslint/naming-convention
            image_name: data.dockerImage,
            command: data.command ?? '',
            entrypoint: data.entrypoint ?? '',
            isArchived: false,
        });

        try {
            const saved = await this.actionTemplateRepository.save(template);
            const fullEntity =
                await this.actionTemplateRepository.findOneOrFail({
                    where: { uuid: saved.uuid },
                    relations: { creator: true },
                });

            return actionTemplateEntityToDto(fullEntity);
        } catch (error) {
            if (
                error instanceof QueryFailedError &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error.driverError?.code === '23505'
            ) {
                throw new ConflictException(
                    'Template with this name already exists',
                );
            }
            throw error;
        }
    }

    /**
     * Save a new version of the template identified by `uuid`.
     *
     * The template is resolved from the route, never from the body: the name
     * of the new version is always the stored name, so this endpoint cannot be
     * used to append to another template's history or to create a new one.
     * Only the creator of the template (the author of its first version) or
     * an admin may add versions.
     */
    async createVersion(
        uuid: string,
        data: UpdateTemplateDto,
        auth: AuthHeader,
    ): Promise<ActionTemplateDto> {
        const base = await this.findModifiableTemplate(uuid, auth);

        if (data.name !== base.name) {
            throw new BadRequestException(
                'A new version cannot change the template name.',
            );
        }

        this.validateDockerNamespace(data.dockerImage);

        const nextVersion = await this.calculateNextVersion(base.name);

        const { uuid: _ignored, ...fields } = data;

        const newTemplate = this.actionTemplateRepository.create({
            ...fields,

            name: base.name,
            description: data.description,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            image_name: data.dockerImage,
            creator: { uuid: auth.user.uuid },
            version: nextVersion,
            command: data.command ?? '',
            entrypoint: data.entrypoint ?? '',
            isArchived: false,
        });

        try {
            const saved = await this.actionTemplateRepository.save(newTemplate);

            const fullEntity =
                await this.actionTemplateRepository.findOneOrFail({
                    where: { uuid: saved.uuid },
                    relations: { creator: true },
                });

            return actionTemplateEntityToDto(fullEntity);
        } catch (error) {
            if (
                error instanceof QueryFailedError &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error.driverError?.code === '23505'
            ) {
                throw new ConflictException(
                    'Another version of this template was saved at the same time, please retry.',
                );
            }
            throw error;
        }
    }

    /**
     * Load the template `uuid` and make sure `auth` may change it.
     *
     * Ownership belongs to the creator of the first version, not of the latest
     * one; otherwise anyone who got a version in would become an owner.
     * System templates cannot be changed by anyone through the API.
     */
    private async findModifiableTemplate(
        uuid: string,
        auth: AuthHeader,
    ): Promise<ActionTemplateEntity> {
        const template = await this.actionTemplateRepository.findOne({
            where: { uuid },
            select: { uuid: true, name: true },
        });

        if (!template) {
            throw new NotFoundException('Template not found');
        }

        await this.assertNotSystemTemplate(template.name);

        if (auth.user.role === UserRole.ADMIN) {
            return template;
        }

        const first = await this.actionTemplateRepository.findOne({
            where: { name: template.name },
            order: { version: 'ASC' },
            relations: { creator: true },
        });

        if (first?.creator.uuid !== auth.user.uuid) {
            throw new ForbiddenException(
                'Only the creator of this template or an admin can modify it. Save your changes as a new template instead.',
            );
        }

        return template;
    }

    async findAll(
        skip: number,
        take: number,
        search?: string,
        includeArchived?: boolean,
    ): Promise<ActionTemplatesDto> {
        const qb = this.actionTemplateRepository
            .createQueryBuilder('template')
            .leftJoinAndSelect('template.creator', 'creator')
            .skip(skip)
            .take(take)
            .orderBy('template.name', 'ASC')
            .addOrderBy('template.version', 'DESC');

        if (!includeArchived) {
            qb.andWhere('template.isArchived = :archived', { archived: false });
        }

        if (search) {
            qb.andWhere(
                new Brackets((sub) => {
                    sub.where('template.name ILIKE :searchTerm', {
                        searchTerm: `%${search}%`,
                    }).orWhere('template.image_name ILIKE :searchTerm', {
                        searchTerm: `%${search}%`,
                    });
                }),
            );
        }

        qb.addSelect((subQuery) => {
            return subQuery
                .select('COUNT(action.uuid)', 'count')
                .from(ActionEntity, 'action')
                .leftJoin('action.template', 't')
                .where('t.name = template.name');
        }, 'executionCount');

        const { entities, raw } = await qb.getRawAndEntities();
        const count = await qb.getCount();

        const data = entities.map((entity) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const rawRow = raw.find((r) => r.template_uuid === entity.uuid);
            const execCount = rawRow
                ? // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                  Number.parseInt(rawRow.executionCount, 10)
                : 0;

            return actionTemplateEntityToDto(entity, execCount);
        });

        return {
            count,
            data,
            skip,
            take,
        };
    }

    /**
     * Refuse to change or remove a template the platform owns.
     *
     * `script-runner` is shared by every `run-script` execution across the
     * deployment, so one person editing or deleting it would break the feature
     * for everyone. It is seeded by migration and changed the same way.
     */
    private async assertNotSystemTemplate(name: string): Promise<void> {
        const system = await this.actionTemplateRepository.findOne({
            where: { name, isSystem: true },
            select: { uuid: true },
        });

        if (system) {
            throw new ForbiddenException(
                `"${name}" is managed by Kleinkram and cannot be modified or deleted.`,
            );
        }
    }

    /**
     * Delete or archive a template based on its usage.
     *
     * This will target all versions of the template with the same name.
     *
     * @param uuid
     */
    async delete(
        uuid: string,
        auth: AuthHeader,
    ): Promise<DeleteTemplateResponseDto> {
        const { name } = await this.findModifiableTemplate(uuid, auth);

        const totalExecutionCount = await this.actionRepository
            .createQueryBuilder('action')
            .innerJoin('action.template', 'template')
            .where('template.name = :name', { name })
            .getCount();

        if (totalExecutionCount > 0) {
            await this.actionTemplateRepository.update(
                { name },
                { isArchived: true },
            );
            return { archived: true, deleted: false };
        } else {
            await this.actionTemplateRepository.delete({ name });
            return { archived: false, deleted: true };
        }
    }

    async findRevisions(
        uuid: string,
        skip: number,
        take: number,
    ): Promise<ActionTemplatesDto> {
        const current = await this.actionTemplateRepository.findOne({
            where: { uuid },
            select: {
                name: true,
            },
        });

        if (!current) {
            throw new NotFoundException('Template not found');
        }

        // `loadRelationCountAndMap()` was removed in TypeORM v1; count the
        // executions with a correlated sub-query instead, the same way
        // `findAll` above already does.
        const qb = this.actionTemplateRepository
            .createQueryBuilder('template')
            .leftJoinAndSelect('template.creator', 'creator')
            .addSelect((subQuery) => {
                return subQuery
                    .select('COUNT(action.uuid)', 'count')
                    .from(ActionEntity, 'action')
                    .leftJoin('action.template', 't')
                    .where('t.uuid = template.uuid');
            }, 'executionCount')
            .where('template.name = :name', { name: current.name })
            .orderBy('template.version', 'DESC')
            .skip(skip)
            .take(take);

        const { entities, raw } = await qb.getRawAndEntities();
        const count = await qb.getCount();

        const data = entities.map((entity) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const rawRow = raw.find((r) => r.template_uuid === entity.uuid);
            const execCount = rawRow
                ? // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                  Number.parseInt(rawRow.executionCount, 10)
                : 0;

            return actionTemplateEntityToDto(entity, execCount);
        });

        return {
            count,
            data,
            skip,
            take,
        };
    }

    async isNameAvailable(name: string): Promise<boolean> {
        const count = await this.actionTemplateRepository.count({
            where: { name },
        });
        return count === 0;
    }

    private validateDockerNamespace(imageName: string): void {
        if (!isImageInDockerNamespace(imageName, this.DOCKER_NAMESPACE)) {
            throw new ConflictException(
                `Only images from the ${this.DOCKER_NAMESPACE} namespace are allowed`,
            );
        }
        validateDockerImageName(imageName);
    }

    private async calculateNextVersion(name: string): Promise<number> {
        const lastVersionTemplate = await this.actionTemplateRepository.findOne(
            {
                where: { name },
                order: { version: 'DESC' },
            },
        );

        const currentVersion = lastVersionTemplate?.version ?? 0;
        return currentVersion + 1;
    }
}

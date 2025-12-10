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
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, QueryFailedError, Repository } from 'typeorm';

@Injectable()
export class TemplateService {
    private readonly DOCKER_NAMESPACE = process.env.VITE_DOCKER_HUB_NAMESPACE;

    constructor(
        @InjectRepository(ActionTemplateEntity)
        private actionTemplateRepository: Repository<ActionTemplateEntity>,
        @InjectRepository(ActionEntity)
        private actionRepository: Repository<ActionEntity>,
        @InjectRepository(UserEntity)
        private userRepository: Repository<UserEntity>,
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

    async createVersion(
        uuid: string,
        data: UpdateTemplateDto,
        auth: AuthHeader,
    ): Promise<ActionTemplateDto> {
        const nextVersion = await this.calculateNextVersion(data.name);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        delete (data as any).uuid;
        this.validateDockerNamespace(data.dockerImage);

        const newTemplate = this.actionTemplateRepository.create({
            // eslint-disable-next-line @typescript-eslint/no-misused-spread
            ...data,

            description: data.description,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            image_name: data.dockerImage,
            creator: { uuid: auth.user.uuid },
            version: nextVersion,
            command: data.command ?? '',
            entrypoint: data.entrypoint ?? '',
            isArchived: false,
        });

        const saved = await this.actionTemplateRepository.save(newTemplate);

        const fullEntity = await this.actionTemplateRepository.findOneOrFail({
            where: { uuid: saved.uuid },
            relations: { creator: true },
        });

        return actionTemplateEntityToDto(fullEntity);
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
     * Delete or archive a template based on its usage.
     *
     * This will target all versions of the template with the same name.
     *
     * @param uuid
     */
    async delete(uuid: string): Promise<DeleteTemplateResponseDto> {
        const template = await this.actionTemplateRepository.findOne({
            where: { uuid },
            select: ['name'],
        });

        if (!template) {
            throw new NotFoundException('Template not found');
        }

        const { name } = template;

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
            select: ['name'],
        });

        if (!current) {
            throw new NotFoundException('Template not found');
        }

        const qb = this.actionTemplateRepository
            .createQueryBuilder('template')
            .leftJoinAndSelect('template.creator', 'creator')
            .loadRelationCountAndMap(
                'template.executionCount',
                'template.actions',
            )
            .where('template.name = :name', { name: current.name })
            .orderBy('template.version', 'DESC')
            .skip(skip)
            .take(take);

        const [entities, count] = await qb.getManyAndCount();

        const data = entities.map((entity) => {
            return actionTemplateEntityToDto(
                entity,
                entity.executionCount ?? 0,
            );
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
        if (
            this.DOCKER_NAMESPACE &&
            !imageName.startsWith(this.DOCKER_NAMESPACE)
        ) {
            throw new ConflictException(
                `Only images from the ${this.DOCKER_NAMESPACE} namespace are allowed`,
            );
        }
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

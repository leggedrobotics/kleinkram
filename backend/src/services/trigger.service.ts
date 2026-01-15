import {
    ActionTriggerDto,
    CreateActionTriggerDto,
    UpdateActionTriggerDto,
} from '@kleinkram/api-dto';
import {
    ActionTemplateEntity,
    ActionTriggerEntity,
    MissionEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { redis, systemUser } from '@kleinkram/backend-common/consts';
import { ActionDispatcherService } from '@kleinkram/backend-common/modules/action-dispatcher/action-dispatcher.service';
import {
    ActionTriggerSource,
    isValidCron,
    TriggerEvent,
    TriggerType,
} from '@kleinkram/shared';
import {
    BadRequestException,
    Injectable,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import Queue from 'bull';
import { Repository } from 'typeorm';

@Injectable()
export class TriggerService implements OnModuleInit {
    private triggerQueue!: Queue.Queue;

    constructor(
        @InjectRepository(ActionTriggerEntity)
        private triggerRepository: Repository<ActionTriggerEntity>,
        @InjectRepository(ActionTemplateEntity)
        private templateRepository: Repository<ActionTemplateEntity>,
        @InjectRepository(MissionEntity)
        private missionRepository: Repository<MissionEntity>,
        @InjectRepository(UserEntity)
        private userRepository: Repository<UserEntity>,
        private readonly actionDispatcher: ActionDispatcherService,
    ) {}

    onModuleInit(): void {
        this.triggerQueue = new Queue('trigger-queue', { redis });
    }

    async findAll(missionUuid?: string): Promise<ActionTriggerDto[]> {
        const query = this.triggerRepository
            .createQueryBuilder('trigger')
            .leftJoinAndSelect('trigger.template', 'template');

        if (missionUuid) {
            query.where('trigger.missionUuid = :missionUuid', { missionUuid });
        }
        const entities = await query.getMany();
        return entities.map((entity) => this.toDto(entity));
    }

    async create(dto: CreateActionTriggerDto): Promise<ActionTriggerDto> {
        this.validateConfig(dto.type, dto.config as Record<string, unknown>);

        const template = await this.templateRepository.findOneBy({
            uuid: dto.templateUuid,
        });
        if (!template) {
            throw new NotFoundException('Template not found');
        }

        const mission = await this.missionRepository.findOneBy({
            uuid: dto.missionUuid,
        });
        if (!mission) {
            throw new NotFoundException('Mission not found');
        }

        const entity = this.triggerRepository.create({
            name: dto.name,
            description: dto.description,
            type: dto.type,
            config: dto.config,
            template,
            mission,
        });

        const saved = await this.triggerRepository.save(entity);
        return this.toDto(saved);
    }

    async update(
        uuid: string,
        dto: UpdateActionTriggerDto,
    ): Promise<ActionTriggerDto> {
        const trigger = await this.triggerRepository.findOne({
            where: { uuid },
            relations: { template: true, mission: true },
        });

        if (!trigger) {
            throw new NotFoundException('Trigger not found');
        }

        if (dto.type || dto.config) {
            const type = dto.type ?? trigger.type;
            const config = (dto.config ?? trigger.config) as Record<
                string,
                unknown
            >;
            this.validateConfig(type, config);
        }

        if (dto.templateUuid) {
            const template = await this.templateRepository.findOneBy({
                uuid: dto.templateUuid,
            });
            if (!template) {
                throw new NotFoundException('Template not found');
            }
            trigger.template = template;
        }

        if (dto.missionUuid) {
            const mission = await this.missionRepository.findOneBy({
                uuid: dto.missionUuid,
            });
            if (!mission) {
                throw new NotFoundException('Mission not found');
            }
            trigger.mission = mission;
        }

        // Partial update of matching fields
        if (dto.name !== undefined) trigger.name = dto.name;
        if (dto.description !== undefined)
            trigger.description = dto.description;
        if (dto.type !== undefined) trigger.type = dto.type;
        if (dto.config !== undefined) trigger.config = dto.config;

        const saved = await this.triggerRepository.save(trigger);
        return this.toDto(saved);
    }

    async delete(uuid: string): Promise<void> {
        const result = await this.triggerRepository.delete({ uuid });
        if (result.affected === 0) {
            throw new NotFoundException('Trigger not found');
        }
    }

    private toDto(entity: ActionTriggerEntity): ActionTriggerDto {
        return {
            uuid: entity.uuid,
            name: entity.name,
            description: entity.description,
            templateUuid: entity.templateUuid,
            templateName: entity.template.name,
            missionUuid: entity.missionUuid,
            type: entity.type,
            config: entity.config,
        };
    }

    async triggerWebhook(
        uuid: string,
        payload: Record<string, unknown>,
    ): Promise<{ actionUuid: string }> {
        const trigger = await this.triggerRepository.findOne({
            where: { uuid },
            relations: ['template', 'mission'],
        });

        if (!trigger) {
            throw new NotFoundException('Trigger not found');
        }

        if (trigger.type !== TriggerType.WEBHOOK) {
            throw new BadRequestException('Trigger is not a webhook trigger');
        }

        const creator = await this.userRepository.findOneOrFail({
            where: { uuid: systemUser.uuid },
        });

        const actionUuid = await this.actionDispatcher.dispatch(
            trigger.template.uuid,
            trigger.mission,
            creator,
            payload,
            ActionTriggerSource.WEBHOOK,
            trigger.uuid,
        );

        return { actionUuid };
    }

    private validateConfig(
        type: TriggerType,
        config: Record<string, unknown>,
    ): void {
        if (type !== TriggerType.TIME) return;

        const cron = config.cron;
        if (typeof cron !== 'string' || !isValidCron(cron)) {
            throw new BadRequestException('Invalid cron expression');
        }
    }

    async addFileEvent(fileUuid: string, event: TriggerEvent): Promise<void> {
        await this.triggerQueue.add('fileEvent', {
            fileUuid,
            event,
        });
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async addCronCheck(): Promise<void> {
        await this.triggerQueue.add('cronCheck', {
            timestamp: new Date(),
        });
    }
}

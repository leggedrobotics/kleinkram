import { ActionTriggerEntity, FileEntity } from '@kleinkram/backend-common';
import { ActionDispatcherService } from '@kleinkram/backend-common/modules/action-dispatcher/action-dispatcher.service';
import {
    ActionTriggerSource,
    TriggerEvent,
    TriggerType,
    isValidCron,
} from '@kleinkram/shared';
import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bull';
import { CronExpressionParser } from 'cron-parser';
import { minimatch } from 'minimatch';
import { Repository } from 'typeorm';

@Processor('trigger-queue')
@Injectable()
export class TriggerQueueProcessorProvider {
    private readonly logger = new Logger(TriggerQueueProcessorProvider.name);

    constructor(
        @InjectRepository(ActionTriggerEntity)
        private triggerRepository: Repository<ActionTriggerEntity>,
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        private readonly actionDispatcher: ActionDispatcherService,
    ) {}

    @Process('fileEvent')
    async handleFileEvent(
        job: Job<{ fileUuid: string; event: TriggerEvent }>,
    ): Promise<void> {
        const { fileUuid, event } = job.data;
        this.logger.debug(
            `Processing file event ${event} for file ${fileUuid}`,
        );

        const file = await this.fileRepository.findOne({
            where: { uuid: fileUuid },
            relations: ['mission'],
        });

        if (!file?.mission) {
            this.logger.warn(`File ${fileUuid} not found or has no mission`);
            return;
        }

        const triggers = await this.triggerRepository.find({
            where: {
                mission: { uuid: file.mission.uuid },
                type: TriggerType.FILE,
            },
            relations: ['template', 'mission', 'creator'],
        });

        for (const trigger of triggers) {
            const config = trigger.config as {
                patterns?: string[];
                event?: TriggerEvent[];
            };

            // Check event type match
            if (config.event && !config.event.includes(event)) {
                continue;
            }

            // Check pattern match
            const patterns = config.patterns ?? [];
            const matches = patterns.some((p) =>
                minimatch(file.filename, p, { dot: true, matchBase: true }),
            );

            if (patterns.length > 0 && !matches) {
                continue;
            }

            this.logger.log(
                `Trigger ${trigger.name} matched file ${file.filename}`,
            );
            await this.dispatchAction(
                trigger,
                {
                    fileUuid: file.uuid,
                    filename: file.filename,
                    event,
                },
                ActionTriggerSource.FILE_EVENT,
            );
        }
    }

    @Process('cronCheck')
    async handleCronCheck(job: Job<{ timestamp: string }>): Promise<void> {
        const timestamp = new Date(job.data.timestamp);
        this.logger.debug(
            `Processing cron check for ${timestamp.toISOString()}`,
        );

        const triggers = await this.triggerRepository.find({
            where: { type: TriggerType.TIME },
            relations: ['template', 'mission', 'creator'],
        });

        for (const trigger of triggers) {
            const config = trigger.config as { cron: string };
            if (!config.cron || !isValidCron(config.cron)) {
                continue;
            }

            try {
                const interval = CronExpressionParser.parse(config.cron, {
                    currentDate: timestamp,
                });
                const previous = interval.prev();

                // transform to date objects
                const previousDate: Date = previous.toDate();

                const now = timestamp.getTime();
                const oneMinuteAgo = now - 60_000;

                // We check if the previous scheduled date is after oneMinuteAgo.
                if (
                    previousDate.getTime() > oneMinuteAgo &&
                    previousDate.getTime() <= now
                ) {
                    this.logger.log(
                        `Trigger ${trigger.name} matched cron time ${previousDate.toISOString()}`,
                    );
                    await this.dispatchAction(
                        trigger,
                        {
                            scheduledTime: previousDate.toISOString(),
                            triggerTime: timestamp.toISOString(),
                        },
                        ActionTriggerSource.CRON,
                    );
                }
            } catch (error) {
                this.logger.error(
                    `Error parsing cron for trigger ${trigger.uuid}: ${String(error)}`,
                );
            }
        }
    }

    private async dispatchAction(
        trigger: ActionTriggerEntity,
        payload: Record<string, unknown>,
        triggerSource: ActionTriggerSource,
    ): Promise<void> {
        try {
            await this.actionDispatcher.dispatch(
                trigger.template.uuid,
                trigger.mission,
                trigger.creator,
                payload,
                triggerSource,
                trigger.uuid,
            );
        } catch (error) {
            this.logger.error(
                `Failed to dispatch action for trigger ${trigger.uuid}: ${String(error)}`,
            );
        }
    }
}

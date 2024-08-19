import { Injectable } from '@nestjs/common';
import { tracing } from '../../tracing';
import { Cron, CronExpression } from '@nestjs/schedule';
import logger from '../../logger';
import { ActionManagerService } from './actionManager.service';

@Injectable()
export class ContainerCleanupService {
    constructor(private actionManager: ActionManagerService) {}

    @Cron(CronExpression.EVERY_5_MINUTES)
    @tracing('cleanup_containers')
    async handleCron() {
        logger.debug('Cleaning up containers...');
        await this.actionManager.cleanupContainers();
    }
}

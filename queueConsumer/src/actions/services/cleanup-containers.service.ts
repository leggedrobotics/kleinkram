import { Injectable } from '@nestjs/common';
import { tracing } from '../../tracing';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActionManagerService } from './action-manager.service';

@Injectable()
export class ContainerCleanupService {
    constructor(private actionManager: ActionManagerService) {}

    @Cron(CronExpression.EVERY_30_SECONDS)
    @tracing('cleanup_containers')
    async handleCron() {
        await this.actionManager.cleanupContainers();
    }
}

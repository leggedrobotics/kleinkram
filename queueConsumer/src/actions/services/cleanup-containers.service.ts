import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { tracing } from '../../tracing';
import { ActionManagerService } from './action-manager.service';
import { ContainerLifecycleService } from './container-lifecycle.service';

@Injectable()
export class ContainerCleanupService {
    constructor(
        private actionManager: ActionManagerService,
        private containerLifecycle: ContainerLifecycleService,
    ) {}

    @Cron(CronExpression.EVERY_30_SECONDS)
    @tracing('cleanup_containers')
    async handleCron() {
        // Update runner heartbeat and perform reconciliation
        await this.actionManager.updateHeartbeat();
        const runnerId = this.actionManager.getCurrentInstanceId();
        if (runnerId) {
            await this.containerLifecycle.performReconciliation(runnerId);
        }
    }
}

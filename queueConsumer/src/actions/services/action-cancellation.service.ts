import { redis } from '@kleinkram/backend-common/consts';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Dockerode from 'dockerode';
import { Redis } from 'ioredis';
import logger from '../../logger';

@Injectable()
export class ActionCancellationService
    implements OnModuleInit, OnModuleDestroy
{
    private redisSubscriber!: Redis;
    private activeContainers = new Map<string, Dockerode.Container>();
    private cancelledActions = new Set<string>();
    private activeActions = new Set<string>();

    async onModuleInit(): Promise<void> {
        this.redisSubscriber = new Redis(redis);
        await this.redisSubscriber.subscribe('action-cancellation');
        this.redisSubscriber.on('message', (channel, message) => {
            if (channel === 'action-cancellation') {
                void this.handleActionCancellation(message);
            }
        });
    }

    async onModuleDestroy(): Promise<void> {
        await this.redisSubscriber.quit();
    }

    private async handleActionCancellation(actionUuid: string): Promise<void> {
        logger.info(`Received cancellation event for action ${actionUuid}`);
        if (!this.activeActions.has(actionUuid)) {
            logger.debug(
                `Action ${actionUuid} is not active on this worker, ignoring cancellation.`,
            );
            return;
        }

        const container = this.activeContainers.get(actionUuid);
        if (container) {
            logger.info(
                `Killing container ${container.id} for action ${actionUuid}`,
            );
            this.cancelledActions.add(actionUuid);
            try {
                await container.kill();
            } catch (error) {
                logger.error(
                    `Failed to kill container ${container.id} for action ${actionUuid}: ${String(error)}`,
                );
            }
        } else {
            this.cancelledActions.add(actionUuid);
        }
    }

    registerAction(actionUuid: string): void {
        this.activeActions.add(actionUuid);
    }

    registerContainer(
        actionUuid: string,
        container: Dockerode.Container,
    ): void {
        this.activeContainers.set(actionUuid, container);
    }

    unregisterContainer(actionUuid: string): void {
        this.activeContainers.delete(actionUuid);
    }

    isCancelled(actionUuid: string): boolean {
        return this.cancelledActions.has(actionUuid);
    }

    cleanup(actionUuid: string): void {
        this.cancelledActions.delete(actionUuid);
        this.activeContainers.delete(actionUuid);
        this.activeActions.delete(actionUuid);
    }
}

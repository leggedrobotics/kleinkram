import { redis } from '@kleinkram/backend-common/consts';
import { GroupMembershipEntity } from '@kleinkram/backend-common/entities/auth/group-membership.entity';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import Redlock from 'redlock';
import type { Repository } from 'typeorm';
import { LessThan } from 'typeorm';
import logger from '../logger';

const LOCK_KEY = 'groupMembershipExpiry';
const LOCK_TTL = 10_000; // 10 second

@Injectable()
export class AccessGroupExpiryProvider implements OnModuleInit {
    private redlock?: Redlock;

    constructor(
        @InjectRepository(GroupMembershipEntity)
        private groupMembershipRepository: Repository<GroupMembershipEntity>,
    ) {}

    onModuleInit(): void {
        const redisClient = new Redis(redis);
        this.redlock = new Redlock([redisClient as any], {
            retryCount: 0,
            retryDelay: 200, // Time in ms between retries
        });
    }

    @Cron(CronExpression.EVERY_4_HOURS)
    async removeExpiredAccessGroups(): Promise<void> {
        if (!this.redlock) {
            throw new Error('RedLock not initialized');
        }

        // @ts-ignore
        await this.redlock.using(
            [LOCK_KEY],
            LOCK_TTL,
            this._performExpirySoftDelete.bind(this),
        );
    }

    /**
     *
     * Performs the soft-delete operation for expired group memberships.
     * This method assumes it is being run within a distributed lock.
     *
     */
    private async _performExpirySoftDelete(): Promise<void> {
        const result = await this.groupMembershipRepository.softDelete({
            expirationDate: LessThan(new Date()),
        });

        const affectedRows = result.affected ?? 0;
        logger.debug(
            `Successfully soft-deleted ${affectedRows} expired group memberships.`,
        );
    }
}

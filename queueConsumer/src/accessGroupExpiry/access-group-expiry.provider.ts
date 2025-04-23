import { redis } from '@common/consts';
import GroupMembership from '@common/entities/auth/group-membership.entity';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import Redlock from 'redlock';
import { LessThan, Repository } from 'typeorm';

@Injectable()
export class AccessGroupExpiryProvider implements OnModuleInit {
    private redlock?: Redlock;

    constructor(
        @InjectRepository(GroupMembership)
        private groupMembershipRepository: Repository<GroupMembership>,
    ) {}

    onModuleInit(): void {
        const redisClient = new Redis(redis);
        this.redlock = new Redlock([redisClient], {
            retryCount: 0,
            retryDelay: 200, // Time in ms between retries
        });
    }

    @Cron(CronExpression.EVERY_4_HOURS)
    async removeExpiredAccessGroups(): Promise<void> {
        if (!this.redlock) throw new Error('RedLock not initialized');

        await this.redlock.using([`accessGroupExpiry`], 10_000, async () => {
            await this.groupMembershipRepository.softDelete({
                expirationDate: LessThan(new Date()),
            });
        });
    }
}

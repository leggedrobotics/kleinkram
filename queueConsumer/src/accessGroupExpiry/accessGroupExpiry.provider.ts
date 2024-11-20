import { Injectable, OnModuleInit } from '@nestjs/common';
import Redlock from 'redlock';
import { Redis } from 'ioredis';
import { redis } from '@common/consts';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import GroupMembership from '@common/entities/auth/group_membership.entity';
import { LessThan, Repository } from 'typeorm';

@Injectable()
export class AccessGroupExpiryProvider implements OnModuleInit {
    private redlock: Redlock;

    constructor(
        @InjectRepository(GroupMembership)
        private groupMembershipRepository: Repository<GroupMembership>,
    ) {}

    onModuleInit() {
        const redisClient = new Redis(redis);
        this.redlock = new Redlock([redisClient], {
            retryCount: 0,
            retryDelay: 200, // Time in ms between retries
        });
    }

    @Cron(CronExpression.EVERY_4_HOURS)
    async removeExpiredAccessGroups() {
        await this.redlock.using([`accessGroupExpiry`], 10000, async () => {
            await this.groupMembershipRepository.softDelete({
                expirationDate: LessThan(new Date()),
            });
        });
    }
}

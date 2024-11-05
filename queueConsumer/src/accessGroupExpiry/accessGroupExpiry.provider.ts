import { Injectable, OnModuleInit } from '@nestjs/common';
import Redlock from 'redlock';
import { Redis } from 'ioredis';
import { redis } from '@common/consts';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import AccessGroupUser from '@common/entities/auth/accessgroup_user.entity';
import { LessThan, Repository } from 'typeorm';

@Injectable()
export class AccessGroupExpiryProvider implements OnModuleInit {
    private redlock: Redlock;

    constructor(
        @InjectRepository(AccessGroupUser)
        private accessGroupUserRepository: Repository<AccessGroupUser>,
    ) {}

    async onModuleInit() {
        const redisClient = new Redis(redis);
        this.redlock = new Redlock([redisClient], {
            retryCount: 0,
            retryDelay: 200, // Time in ms between retries
        });
    }

    @Cron(CronExpression.EVERY_4_HOURS)
    async removeExpiredAccessGroups() {
        await this.redlock.using([`accessGroupExpiry`], 10000, async () => {
            await this.accessGroupUserRepository.softDelete({
                expirationDate: LessThan(new Date()),
            });
        });
    }
}

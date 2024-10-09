import {
    Injectable,
    MiddlewareConsumer,
    Module,
    NestMiddleware,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileModule } from './file/file.module';
import { ProjectModule } from './project/project.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from '@common/typeorm_config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { TopicModule } from './topic/topic.module';
import { MissionModule } from './mission/mission.module';
import { QueueModule } from './queue/queue.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { PassportModule } from '@nestjs/passport';
import { ActionModule } from './action/actionModule';
import env from '@common/env';
import { TagModule } from './tag/tag.module';
import { ScheduleModule } from '@nestjs/schedule';
import access_config from '../access_config.json';
import { DBDumper } from './dbdumper/dbdumper.service';
import { UserResolverMiddleware } from './UserResolverMiddleware';
import { WorkerModule } from './worker/worker.module';
import { NextFunction, Request, Response } from 'express';
import logger from './logger';
import { CookieNames } from '@common/enum';
import { ActionService } from './action/action.service';
import Category from '@common/entities/category/category.entity';
import { CategoryModule } from './category/category.module';

/**
 *
 * Logger middleware for audit logging.
 * Logs every authenticated request made to the application.*
 *
 */
@Injectable()
export class AuditLoggerMiddleware implements NestMiddleware {
    constructor(private actionService: ActionService) {}

    use(req: Request, _: Response, next: NextFunction) {
        if (!req || !req.cookies) {
            next();
            return;
        }

        const key = req.cookies[CookieNames.CLI_KEY];
        if (!key) {
            next();
            return;
        }

        const auditLog = {
            method: req.method,
            url: req.originalUrl,
        };

        logger.debug(
            `AuditLoggerMiddleware: ${JSON.stringify(auditLog, null, 2)}`,
        );

        this.actionService.writeAuditLog(key, auditLog).then((r) => {});
        next();
    }
}

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration, () => ({ accessConfig: access_config })],
        }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) =>
                ({
                    type: 'postgres',
                    host: configService.getOrThrow<string>('database.host'),
                    port: configService.getOrThrow<number>('database.port'),
                    username:
                        configService.getOrThrow<string>('database.username'),
                    password:
                        configService.getOrThrow<string>('database.password'),
                    database:
                        configService.getOrThrow<string>('database.database'),
                    entities: [configService.getOrThrow<string>('entities')],
                    synchronize: env.DEV,
                    logging: ['warn', 'error'],
                }) as PostgresConnectionOptions,
            inject: [ConfigService],
        }),
        FileModule,
        ProjectModule,
        TopicModule,
        MissionModule,
        QueueModule,
        UserModule,
        AuthModule,
        PassportModule,
        ActionModule,
        TagModule,
        WorkerModule,
        CategoryModule,
        ScheduleModule.forRoot(),
    ],
    providers: [DBDumper],
})
export class AppModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(UserResolverMiddleware, AuditLoggerMiddleware)
            .forRoutes('*');
    }
}

export type AccessGroupConfig = {
    emails: [{ email: string; access_groups: string[] }];
    access_groups: [{ name: string; uuid: string; rights: number }];
};

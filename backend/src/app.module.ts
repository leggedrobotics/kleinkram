import env from '@kleinkram/backend-common/environment';
import { StorageModule } from '@kleinkram/backend-common/modules/storage/storage.module';
import configuration from '@kleinkram/backend-common/typeorm-config';
import { AccessGroupConfig } from '@kleinkram/shared';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { appVersion } from './app-version';
import { AccessModule } from './endpoints/access/access.module';
import { ActionModule } from './endpoints/action/action.module';
import { AuthModule } from './endpoints/auth/auth.module';
import { CategoryModule } from './endpoints/category/category.module';
import { FileModule } from './endpoints/file/file.module';
import { HealthModule } from './endpoints/health/health.module';
import { FoxgloveModule } from './endpoints/integrations/foxglove.module';
import { MissionModule } from './endpoints/mission/mission.module';
import { ProjectModule } from './endpoints/project/project.module';
import { QueueModule } from './endpoints/queue/queue.module';
import { TagModule } from './endpoints/tag/tag.module';
import { TemplatesModule } from './endpoints/templates/templates.module';
import { TopicModule } from './endpoints/topic/topic.module';
import { TriggerModule } from './endpoints/trigger/trigger.module';
import { UserModule } from './endpoints/user/user.module';
import { WorkerModule } from './endpoints/worker/worker.module';
import { APIKeyResolverMiddleware } from './routing/middlewares/api-key-resolver-middleware.service';
import { AuditLoggerMiddleware } from './routing/middlewares/audit-logger-middleware.service';
import { VersionCheckerMiddlewareService } from './routing/middlewares/version-checker-middleware.service';
import { DBDumper } from './services/dbdumper.service';

@Module({
    imports: [
        PrometheusModule.register({
            defaultLabels: {
                app: 'backend',
                version: appVersion,
            },
        }),

        ConfigModule.forRoot({
            envFilePath: ['.env', '../.env'],
            isGlobal: true,
            load: [
                configuration,
                (): {
                    accessConfig: AccessGroupConfig;
                } => {
                    const configPath =
                        process.env.ACCESS_CONFIG_PATH ??
                        path.resolve(process.cwd(), '..', 'access_config.json');
                    let rawConfig: string;
                    try {
                        rawConfig = fs.readFileSync(configPath, 'utf8');
                    } catch {
                        throw new Error(
                            `Cannot read access config at "${configPath}". Set ACCESS_CONFIG_PATH or place access_config.json at the repo root.`,
                        );
                    }
                    const accessConfig = JSON.parse(
                        rawConfig,
                    ) as AccessGroupConfig;
                    if (
                        !Array.isArray(accessConfig.emails) ||
                        !Array.isArray(accessConfig.access_groups)
                    ) {
                        throw new TypeError(
                            `Invalid access_config.json: "emails" and "access_groups" must be arrays`,
                        );
                    }
                    const configGroupUuids = new Set(
                        accessConfig.access_groups.map((g) => g.uuid),
                    );
                    for (const emailEntry of accessConfig.emails) {
                        if (!Array.isArray(emailEntry.access_groups)) {
                            throw new TypeError(
                                `Invalid access_config.json: each entry in "emails" must have an "access_groups" array`,
                            );
                        }
                        for (const uuid of emailEntry.access_groups) {
                            if (!configGroupUuids.has(uuid)) {
                                throw new TypeError(
                                    `Invalid access_config.json: UUID "${uuid}" in emails config is not defined in access_groups`,
                                );
                            }
                        }
                    }
                    return { accessConfig };
                },
            ],
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
                    entities: configService.getOrThrow('entities'),
                    synchronize: env.DEV,
                    logging: ['warn', 'error'],
                }) as PostgresConnectionOptions,
            inject: [ConfigService],
        }),
        FileModule,
        HealthModule,
        FoxgloveModule,
        ProjectModule,
        TopicModule,
        MissionModule,
        QueueModule,
        TriggerModule,
        UserModule,
        AuthModule,
        AccessModule,
        PassportModule,
        ActionModule,
        TemplatesModule,
        TagModule,
        WorkerModule,
        CategoryModule,
        ScheduleModule.forRoot(),
        StorageModule,
    ],
    providers: [DBDumper],
})
export class AppModule implements NestModule {
    /**
     * Apply middleware to all routes.
     * Middleware is a function which is called before the route handler.
     *
     * The middleware function has access to the request and response objects
     * and is used find the user by the API key or JWT token.
     *
     * @param consumer
     */
    configure(consumer: MiddlewareConsumer): void {
        consumer
            .apply(APIKeyResolverMiddleware, AuditLoggerMiddleware)
            .forRoutes('*');

        consumer
            .apply(VersionCheckerMiddlewareService)
            .exclude(
                '/auth/{*path}', // excludes auth endpoints
                '/integrations/{*path}', // excludes integration endpoints
                '/hooks/{*path}', // excludes hook endpoints
                '/api/health', // excludes health check
                '/', // excludes root for convenience
                '/favicon.ico', // excludes favicon for browser requests
            )
            .forRoutes('*');
    }
}

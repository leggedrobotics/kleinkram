import env from '@common/environment';
import configuration from '@common/typeorm-config';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import accessConfig from '../access_config.json';
import { appVersion } from './app-version';
import { ActionModule } from './endpoints/action/action.module';
import { AuthModule } from './endpoints/auth/auth.module';
import { CategoryModule } from './endpoints/category/category.module';
import { FileModule } from './endpoints/file/file.module';
import { MissionModule } from './endpoints/mission/mission.module';
import { ProjectModule } from './endpoints/project/project.module';
import { QueueModule } from './endpoints/queue/queue.module';
import { TagModule } from './endpoints/tag/tag.module';
import { TopicModule } from './endpoints/topic/topic.module';
import { UserModule } from './endpoints/user/user.module';
import { WorkerModule } from './endpoints/worker/worker.module';
import { APIKeyResolverMiddleware } from './routing/middlewares/api-key-resolver-middleware.service';
import { AuditLoggerMiddleware } from './routing/middlewares/audit-logger-middleware.service';
import { VersionCheckerMiddlewareService } from './routing/middlewares/version-checker-middleware.service';
import { DBDumper } from './services/dbdumper.service';

export interface AccessGroupConfig {
    emails: [{ email: string; access_groups: string[] }];
    access_groups: [{ name: string; uuid: string; rights: number }];
}

@Module({
    imports: [
        PrometheusModule.register({
            defaultLabels: {
                app: 'backend',
                version: appVersion,
            },
        }),
        ConfigModule.forRoot({
            isGlobal: true,
            load: [
                configuration,
                (): {
                    accessConfig: AccessGroupConfig;
                } => ({ accessConfig: accessConfig as AccessGroupConfig }),
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
        // Apply APIKeyResolverMiddleware and AuditLoggerMiddleware to all routes
        consumer
            .apply(
                APIKeyResolverMiddleware,
                AuditLoggerMiddleware,
                VersionCheckerMiddlewareService,
            )
            .forRoutes('*');
    }
}

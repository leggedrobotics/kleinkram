import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileModule } from './endpoints/file/file.module';
import { ProjectModule } from './endpoints/project/project.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from '@common/typeorm-config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { TopicModule } from './endpoints/topic/topic.module';
import { MissionModule } from './endpoints/mission/mission.module';
import { QueueModule } from './endpoints/queue/queue.module';
import { UserModule } from './endpoints/user/user.module';
import { AuthModule } from './endpoints/auth/auth.module';
import { PassportModule } from '@nestjs/passport';
import env from '@common/environment';
import { TagModule } from './endpoints/tag/tag.module';
import { ScheduleModule } from '@nestjs/schedule';
import accessConfig from '../access_config.json';
import { DBDumper } from './services/dbdumper.service';
import { APIKeyResolverMiddleware } from './routing/middlewares/api-key-resolver-middleware.service';
import { WorkerModule } from './endpoints/worker/worker.module';
import { CategoryModule } from './endpoints/category/category.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AuditLoggerMiddleware } from './routing/middlewares/audit-logger-middleware.service';
import { appVersion } from './app-version';
import { ActionModule } from './endpoints/action/action.module';
import { VersionCheckerMiddlewareService } from './routing/middlewares/version-checker-middleware.service';

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

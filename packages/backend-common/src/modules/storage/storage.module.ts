import { FileAuditService } from '@backend-common/audit/file-audit.service';
import { FileEventEntity } from '@backend-common/entities/file/file-event.entity';
import { FileEntity } from '@backend-common/entities/file/file.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import environment from '@backend-common/environment';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { S3StorageBucket } from './s3-storage-bucket';
import { StorageAuthService } from './storage-auth.service';
import { S3ClientContainer, S3ClientFactory } from './storage-config.factory';
import { StorageMetricsService } from './storage-metrics.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([FileEventEntity, FileEntity, MissionEntity]),
    ],
    providers: [
        FileAuditService,
        S3ClientFactory,
        StorageMetricsService,
        StorageAuthService,
        {
            provide: 'DataStorageBucket',
            useFactory: (
                clients: S3ClientContainer,
                auth: StorageAuthService,
                metrics: StorageMetricsService,
            ) =>
                new S3StorageBucket(
                    environment.S3_DATA_BUCKET_NAME,
                    clients,
                    auth,
                    metrics,
                ),
            inject: ['S3_CLIENTS', StorageAuthService, StorageMetricsService],
        },
        {
            provide: 'ArtifactStorageBucket',
            useFactory: (
                clients: S3ClientContainer,
                auth: StorageAuthService,
            ) =>
                new S3StorageBucket(
                    environment.S3_ARTIFACTS_BUCKET_NAME,
                    clients,
                    auth,
                ),
            inject: ['S3_CLIENTS', StorageAuthService],
        },
        {
            provide: 'DbDumpStorageBucket',
            useFactory: (
                clients: S3ClientContainer,
                auth: StorageAuthService,
            ) =>
                new S3StorageBucket(
                    environment.S3_DB_BUCKET_NAME,
                    clients,
                    auth,
                ),
            inject: ['S3_CLIENTS', StorageAuthService],
        },
    ],
    exports: [
        FileAuditService,
        'DataStorageBucket',
        'ArtifactStorageBucket',
        'DbDumpStorageBucket',
    ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class StorageModule {}

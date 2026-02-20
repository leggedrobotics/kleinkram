import { FileAuditService } from '@backend-common/audit/file-audit.service';
import { FileEventEntity } from '@backend-common/entities/file/file-event.entity';
import { FileEntity } from '@backend-common/entities/file/file.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageAuthService } from './storage-auth.service';
import { S3ClientFactory } from './storage-config.factory';
import { StorageMetricsService } from './storage-metrics.service';
import { StorageService } from './storage.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([FileEventEntity, FileEntity, MissionEntity]),
    ],
    providers: [
        FileAuditService,
        StorageService,
        S3ClientFactory,
        StorageMetricsService,
        StorageAuthService,
    ],
    exports: [StorageService, FileAuditService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class StorageModule {}

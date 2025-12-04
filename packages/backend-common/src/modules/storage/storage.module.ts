import { FileAuditService } from '@backend-common/audit/file-audit.service';
import FileEventEntity from '@backend-common/entities/file/file-event.entity';
import FileEntity from '@backend-common/entities/file/file.entity';
import MissionEntity from '@backend-common/entities/mission/mission.entity';
import { StorageAuthService } from '@backend-common/modules/storage/storage-auth.service';
import { MinioClientFactory } from '@backend-common/modules/storage/storage-config.factory';
import { StorageMetricsService } from '@backend-common/modules/storage/storage-metrics.service';
import { StorageService } from '@backend-common/modules/storage/storage.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
    imports: [
        TypeOrmModule.forFeature([FileEventEntity, FileEntity, MissionEntity]),
    ],
    providers: [
        FileAuditService,
        StorageService,
        MinioClientFactory,
        StorageMetricsService,
        StorageAuthService,
    ],
    exports: [StorageService, FileAuditService],
})
export class StorageModule {}

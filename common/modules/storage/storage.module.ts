import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileAuditService } from '../../audit/file-audit.service';
import FileEventEntity from '../../entities/file/file-event.entity';
import FileEntity from '../../entities/file/file.entity';
import MissionEntity from '../../entities/mission/mission.entity';
import { MinioClientFactory } from '../../modules/storage/storage-config.factory';
import { StorageAuthService } from './storage-auth.service';
import { StorageMetricsService } from './storage-metrics.service';
import { StorageService } from './storage.service';

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

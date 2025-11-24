import FileEventEntity from '@common/entities/file/file-event.entity';
import FileEntity from '@common/entities/file/file.entity';
import { StorageModule } from '@common/modules/storage/storage.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileGuardService } from '../../services/file-guard.service';
import { FoxgloveService } from '../../services/foxglove.service';
import { FoxgloveController } from './foxglove.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([FileEntity, FileEventEntity]),
        StorageModule,
    ],
    providers: [FoxgloveService, FileGuardService],
    controllers: [FoxgloveController],
    exports: [FoxgloveService],
})
export class FoxgloveModule {}

import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import env from '@kleinkram/backend-common/environment';
import { StorageService } from '@kleinkram/backend-common/modules/storage/storage.service';
import { FileState } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileHandler, FileProcessingContext } from './file-handler.interface';
import { McapMetadataService } from './mcap-metadata.service';

@Injectable()
export class McapHandler implements FileHandler {
    constructor(
        private readonly mcapMetadataService: McapMetadataService,
        private readonly storageService: StorageService,
        @InjectRepository(FileEntity) private fileRepo: Repository<FileEntity>,
    ) {}

    canHandle(filename: string): boolean {
        return filename.endsWith('.mcap');
    }

    async process(context: FileProcessingContext): Promise<void> {
        const { primaryFile } = context;

        try {
            const presignedUrl =
                await this.storageService.getInternalPresignedDownloadUrl(
                    env.MINIO_DATA_BUCKET_NAME,
                    primaryFile.uuid,
                    15 * 60,
                );

            await this.mcapMetadataService.extractFromUrl(
                presignedUrl,
                primaryFile,
            );
        } catch (error) {
            primaryFile.state = FileState.CORRUPTED;
            await this.fileRepo.save(primaryFile);
            throw error;
        }
    }
}

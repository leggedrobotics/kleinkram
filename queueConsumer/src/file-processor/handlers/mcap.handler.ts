import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { FileState } from '@kleinkram/shared';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileHandler, FileProcessingContext } from './file-handler.interface';
import { McapMetadataService } from './mcap-metadata.service';

@Injectable()
export class McapHandler implements FileHandler {
    constructor(
        private readonly mcapMetadataService: McapMetadataService,
        @Inject('DataStorageBucket')
        private readonly dataStorage: IStorageBucket,
        @InjectRepository(FileEntity) private fileRepo: Repository<FileEntity>,
    ) {}

    canHandle(filename: string): boolean {
        return filename.endsWith('.mcap');
    }

    async process(context: FileProcessingContext): Promise<void> {
        const { primaryFile } = context;

        try {
            const presignedUrl =
                await this.dataStorage.getInternalPresignedDownloadUrl(
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

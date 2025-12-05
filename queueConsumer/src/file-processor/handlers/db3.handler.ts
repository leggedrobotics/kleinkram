import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { FileState } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Db3MetadataService } from './db3-metadata.service';
import { FileHandler, FileProcessingContext } from './file-handler.interface';

@Injectable()
export class Db3Handler implements FileHandler {
    constructor(
        private readonly db3MetadataService: Db3MetadataService,
        @InjectRepository(FileEntity) private fileRepo: Repository<FileEntity>,
    ) {}

    canHandle(filename: string): boolean {
        return filename.endsWith('.db3');
    }

    async process(context: FileProcessingContext): Promise<void> {
        const { primaryFile, filePath } = context;

        try {
            await this.db3MetadataService.extractFromLocalFile(
                filePath,
                primaryFile,
            );
        } catch (error) {
            primaryFile.state = FileState.CORRUPTED;
            await this.fileRepo.save(primaryFile);
            throw error;
        }
    }
}

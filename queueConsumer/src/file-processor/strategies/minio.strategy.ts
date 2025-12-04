import FileEntity from '@kleinkram/backend-common/entities/file/file.entity';
import env from '@kleinkram/backend-common/environment';
import { StorageService } from '@kleinkram/backend-common/modules/storage/storage.service';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileSourceResult, FileSourceStrategy } from './file-source.interface';

@Injectable()
export class MinioStrategy implements FileSourceStrategy {
    constructor(
        private readonly storageService: StorageService,
        @InjectRepository(FileEntity)
        private fileEntityRepository: Repository<FileEntity>,
    ) {}

    supports(location: string): boolean {
        // Assuming internal uploads don't strictly have a 'location' enum yet, or map to 'LOCAL'
        return location !== 'GOOGLE_DRIVE';
    }

    async fetch(identifier: string): Promise<FileSourceResult> {
        const fileEntity = await this.fileEntityRepository.findOneOrFail({
            where: { uuid: identifier },
        });

        const stream = await this.storageService.getFileStream(
            env.MINIO_DATA_BUCKET_NAME,
            identifier,
        );

        return {
            stream,
            filename: fileEntity.filename,
        };
    }
}

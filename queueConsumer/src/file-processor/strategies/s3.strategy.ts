import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileSourceResult, FileSourceStrategy } from './file-source.interface';

@Injectable()
export class S3Strategy implements FileSourceStrategy {
    constructor(
        @Inject('DataStorageBucket')
        private readonly dataStorage: IStorageBucket,
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

        const stream = await this.dataStorage.getFileStream(identifier);

        return {
            stream,
            filename: fileEntity.filename,
        };
    }
}

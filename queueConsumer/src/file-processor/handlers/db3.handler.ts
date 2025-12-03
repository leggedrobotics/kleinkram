import { Injectable } from '@nestjs/common';
import { Db3MetadataService } from './db3-metadata.service';
import { FileHandler, FileProcessingContext } from './file-handler.interface';

@Injectable()
export class Db3Handler implements FileHandler {
    constructor(private readonly db3MetadataService: Db3MetadataService) {}

    canHandle(filename: string): boolean {
        return filename.endsWith('.db3');
    }

    async process(context: FileProcessingContext): Promise<void> {
        const { primaryFile, filePath } = context;

        await this.db3MetadataService.extractFromLocalFile(
            filePath,
            primaryFile,
        );
    }
}

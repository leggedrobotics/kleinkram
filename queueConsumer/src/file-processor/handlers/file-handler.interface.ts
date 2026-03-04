import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IngestionJobEntity } from '@kleinkram/backend-common/entities/file/ingestion-job.entity';

export interface FileProcessingContext {
    workDirectory: string;
    filePath: string;
    fileType: string;
    queueItem: IngestionJobEntity;
    primaryFile: FileEntity;
}

export interface FileHandler {
    canHandle(filename: string): boolean;
    process(context: FileProcessingContext): Promise<void>;
}

export const FILE_HANDLER = 'FILE_HANDLER_TOKEN';

/**
 * Standardized structure for a topic found during extraction.
 * Hoisted here to be shared between Mcap and Rosbag services.
 */
export interface ExtractedTopicInfo {
    name: string;
    type: string;
    nrMessages: bigint;
    frequency?: number;
}

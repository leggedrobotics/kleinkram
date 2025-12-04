import { FileEventDto } from '@kleinkram/api-dto/types/file/file-event.dto';

export interface GroupedFileEvent extends FileEventDto {
    count: number;
    events: FileEventDto[];
    isUploadGroup?: boolean;
}

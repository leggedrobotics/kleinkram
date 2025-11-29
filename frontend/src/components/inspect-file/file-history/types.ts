import { FileEventDto } from '@api/types/file/file-event.dto';

export interface GroupedFileEvent extends FileEventDto {
    count: number;
    events: FileEventDto[];
    isUploadGroup?: boolean;
}

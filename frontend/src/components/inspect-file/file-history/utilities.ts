import { FileEventType } from '@common/enum';

export function formatEventType(type: FileEventType): string {
    const map: Record<string, string> = {
        [FileEventType.CREATED]: 'File Created',
        [FileEventType.UPLOAD_STARTED]: 'Upload Started',
        [FileEventType.UPLOAD_COMPLETED]: 'Upload Completed',
        [FileEventType.DOWNLOADED]: 'Downloaded',
        [FileEventType.FOXGLOVE_URL_GENERATED]: 'Foxglove URL Generated',
        [FileEventType.RENAMED]: 'Renamed',
        [FileEventType.MOVED]: 'Moved',
        [FileEventType.TOPICS_EXTRACTED]: 'Topics Extracted',
        [FileEventType.FILE_CONVERTED]: 'Auto Converted To',
        [FileEventType.FILE_CONVERTED_FROM]: 'Auto Converted From',
    };
    return map[type] ?? type;
}

export function getEventIcon(type: FileEventType): string {
    if (type.includes('FAILED') || type.includes('ERROR')) return 'sym_o_error';
    if (type.includes('COMPLETED') || type.includes('CREATED'))
        return 'sym_o_check_circle';
    if (type.includes('DOWNLOAD')) return 'sym_o_download';
    if (type.includes(FileEventType.FOXGLOVE_URL_GENERATED))
        return 'sym_o_dataset_linked';
    if (type.includes('UPLOAD')) return 'sym_o_upload';
    if (type.includes('DELETE')) return 'sym_o_delete';
    if (type === FileEventType.TOPICS_EXTRACTED) return 'sym_o_topic';
    if (type === FileEventType.FILE_CONVERTED) return 'sym_o_transform';
    if (type === FileEventType.FILE_CONVERTED_FROM) return 'sym_o_input';

    return 'sym_o_history';
}

export function getEventColor(type: string): string {
    if (type.includes('FAILED') || type.includes('ERROR')) return 'negative';
    if (type.includes(FileEventType.FOXGLOVE_URL_GENERATED)) return 'secondary';
    if (type.includes('COMPLETED') || type.includes('CREATED'))
        return 'positive';
    if (type.includes('DELETE')) return 'grey-6';
    if ((type as FileEventType) === FileEventType.TOPICS_EXTRACTED)
        return 'info';
    if (type.includes('CONVERTED')) return 'accent';

    return 'primary';
}

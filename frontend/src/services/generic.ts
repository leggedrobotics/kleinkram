import { DataType } from 'src/enums/TAG_TYPES';
import { AccessGroupRights } from 'src/enums/ACCESS_RIGHTS';
import { FileState } from 'src/enums/QUEUE_ENUM';
import { FileEntity } from 'src/types/FileEntity';

export const icon = (type: DataType) => {
    switch (type) {
        case DataType.BOOLEAN:
            return 'sym_o_check_box';
        case DataType.NUMBER:
            return 'sym_o_looks_one';
        case DataType.STRING:
            return 'sym_o_text_fields';
        case DataType.DATE:
            return 'sym_o_event';
        case DataType.LOCATION:
            return 'sym_o_location_on';
        case DataType.LINK:
            return 'sym_o_link';
        case DataType.ANY:
            return 'sym_o_help';
    }
};

export const accessGroupRightsMap = {
    [AccessGroupRights.NONE]: 'None',
    [AccessGroupRights.READ]: 'Read',
    [AccessGroupRights.CREATE]: 'Create',
    [AccessGroupRights.WRITE]: 'Write',
    [AccessGroupRights.DELETE]: 'Delete',
};

export function getAccessRightDescription(value: AccessGroupRights): string {
    return accessGroupRightsMap[value] || 'Unknown';
}

export function getColor(state: FileState) {
    switch (state) {
        case FileState.COMPLETED:
            return 'green';
        case FileState.ERROR:
            return 'red';
        case FileState.AWAITING_PROCESSING:
            return 'yellow';
        case FileState.CONVERTING_AND_EXTRACTING_TOPICS:
        case FileState.UPLOADING:
        case FileState.DOWNLOADING:
        case FileState.PROCESSING:
            return 'blue';
        case FileState.AWAITING_UPLOAD:
            return 'purple';
        case FileState.CORRUPTED:
            return 'orange';

        default:
            return 'grey'; // Default color for unknown states
    }
}

export function getSimpleFileStateName(state: FileState) {
    switch (state) {
        case FileState.COMPLETED:
            return 'Completed';
        case FileState.ERROR:
            return 'Error';
        case FileState.AWAITING_PROCESSING:
            return 'Awaiting Processing';
        case FileState.CONVERTING_AND_EXTRACTING_TOPICS:
        case FileState.UPLOADING:
        case FileState.DOWNLOADING:
        case FileState.PROCESSING:
            return 'Processing';
        case FileState.AWAITING_UPLOAD:
            return 'Awaiting Upload';
        case FileState.CORRUPTED:
            return 'Corrupted';
        default:
            return 'Unknown'; // Default color for unknown states
    }
}

export function getDetailedFileState(state: FileState) {
    switch (state) {
        case FileState.COMPLETED:
            return 'File has been processed and is ready for download';
        case FileState.ERROR:
            return 'An error occurred during processing';
        case FileState.AWAITING_PROCESSING:
            return 'File is awaiting processing';
        case FileState.CONVERTING_AND_EXTRACTING_TOPICS:
            return 'File is being converted and topics are being extracted';
        case FileState.UPLOADING:
            return 'File is being uploaded';
        case FileState.PROCESSING:
            return 'File is being processed';
        case FileState.AWAITING_UPLOAD:
            return 'File is awaiting upload';
        case FileState.CORRUPTED:
            return 'File is corrupted';
        case FileState.DOWNLOADING:
            return 'File is being downloaded';
        default:
            return 'Unknown'; // Default color for unknown states
    }
}

export function getTentativeRowStyle(row: FileEntity) {
    return {
        backgroundColor: row.tentative ? '#ffdbcb' : '',
    };
}

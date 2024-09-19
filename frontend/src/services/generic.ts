import { DataType } from 'src/enums/TAG_TYPES';
import { AccessGroupRights } from 'src/enums/ACCESS_RIGHTS';
import { ActionState, FileState } from 'src/enums/QUEUE_ENUM';
import { FileEntity } from 'src/types/FileEntity';
import { downloadFile } from 'src/services/queries/file';

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
        case FileState.CANCELED:
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
        case FileState.CANCELED:
            return 'Canceled';
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
        case FileState.CANCELED:
            return 'File upload was canceled';
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
export async function _downloadFile(fileUUID: string, filename: string) {
    const res = await downloadFile(fileUUID, true);
    const a = document.createElement('a');
    a.href = res;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

export async function _downloadFiles(files: FileEntity[]) {
    const downloadPromises = files.map(async (file) => {
        try {
            const url = await downloadFile(file.uuid, true);
            return { url, filename: file.filename };
        } catch (e) {
            return { url: '', filename: file.filename };
        }
    });
    const downloadURLs = await Promise.all(downloadPromises);
    for (const { url, filename } of downloadURLs.filter((d) => d.url)) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        await new Promise((resolve) => setTimeout(resolve, 100)); // Delay of 100ms
    }
    return downloadURLs.filter((d) => !d.url).map((d) => d.filename);
}

export function getActionColor(state: ActionState) {
    switch (state) {
        case ActionState.DONE:
            return 'green';
        case ActionState.FAILED:
            return 'red';
        case ActionState.PENDING:
            return 'orange';
        case ActionState.PROCESSING:
            return 'blue';
        default:
            return 'grey'; // Default color for unknown states
    }
}

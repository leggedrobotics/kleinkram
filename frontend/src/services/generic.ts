import { DataType } from 'src/enums/TAG_TYPES';
import { AccessGroupRights } from 'src/enums/ACCESS_RIGHTS';
import { ActionState, QueueState } from 'src/enums/QUEUE_ENUM';
import { FileEntity } from 'src/types/FileEntity';
import { downloadFile } from 'src/services/queries/file';
import { FileState } from 'src/enums/FILE_ENUM';

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

export function getColor(state: QueueState) {
    switch (state) {
        case QueueState.COMPLETED:
            return 'green';
        case QueueState.ERROR:
        case QueueState.CANCELED:
            return 'red';
        case QueueState.AWAITING_PROCESSING:
            return 'yellow';
        case QueueState.CONVERTING_AND_EXTRACTING_TOPICS:
        case QueueState.UPLOADING:
        case QueueState.DOWNLOADING:
        case QueueState.PROCESSING:
            return 'blue';
        case QueueState.AWAITING_UPLOAD:
            return 'purple';
        case QueueState.CORRUPTED:
            return 'orange';

        default:
            return 'grey'; // Default color for unknown states
    }
}

export function getSimpleFileStateName(state: QueueState) {
    switch (state) {
        case QueueState.COMPLETED:
            return 'Completed';
        case QueueState.ERROR:
            return 'Error';
        case QueueState.CANCELED:
            return 'Canceled';
        case QueueState.AWAITING_PROCESSING:
            return 'Awaiting Processing';
        case QueueState.CONVERTING_AND_EXTRACTING_TOPICS:
        case QueueState.UPLOADING:
        case QueueState.DOWNLOADING:
        case QueueState.PROCESSING:
            return 'Processing';
        case QueueState.AWAITING_UPLOAD:
            return 'Awaiting Upload';
        case QueueState.CORRUPTED:
            return 'Corrupted';
        default:
            return 'Unknown'; // Default color for unknown states
    }
}

export function getDetailedFileState(state: QueueState) {
    switch (state) {
        case QueueState.COMPLETED:
            return 'File has been processed and is ready for download';
        case QueueState.ERROR:
            return 'An error occurred during processing';
        case QueueState.CANCELED:
            return 'File upload was canceled';
        case QueueState.AWAITING_PROCESSING:
            return 'File is awaiting processing';
        case QueueState.CONVERTING_AND_EXTRACTING_TOPICS:
            return 'File is being converted and topics are being extracted';
        case QueueState.UPLOADING:
            return 'File is being uploaded';
        case QueueState.PROCESSING:
            return 'File is being processed';
        case QueueState.AWAITING_UPLOAD:
            return 'File is awaiting upload';
        case QueueState.CORRUPTED:
            return 'File is corrupted';
        case QueueState.DOWNLOADING:
            return 'File is being downloaded';
        default:
            return 'Unknown'; // Default color for unknown states
    }
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
        case ActionState.STARTING:
            return 'blue-4';
        case ActionState.PROCESSING:
            return 'blue';
        case ActionState.UNPROCESSABLE:
            return 'purple';
        default:
            return 'grey'; // Default color for unknown states
    }
}

export function getTooltip(state: FileState) {
    switch (state) {
        case FileState.OK:
            return 'File is OK';
        case FileState.ERROR:
            return 'File has an error';
        case FileState.UPLOADING:
            return 'File is uploading';
        case FileState.CORRUPTED:
            return 'File is corrupted';
        case FileState.MOVING:
            return 'File is currently moving';
        case FileState.LOST:
            return 'File cannot be found in storage';
        case FileState.FOUND:
            return 'File was recovered';
        case FileState.CONVERSION_ERROR:
            return 'File conversion failed';
    }
}

export function getIcon(state: FileState) {
    switch (state) {
        case FileState.OK:
            return 'sym_o_check_circle';
        case FileState.ERROR:
            return 'sym_o_error';
        case FileState.UPLOADING:
            return 'sym_o_arrow_upload_progress';
        case FileState.CORRUPTED:
            return 'sym_o_sentiment_very_dissatisfied';
        case FileState.MOVING:
            return 'sym_o_move_up';
        case FileState.LOST:
            return 'sym_o_pulse_alert';
        case FileState.FOUND:
            return 'sym_o_helicopter';
        case FileState.CONVERSION_ERROR:
            return 'sym_o_conversion_path_off';
    }
}

export function getColorFileState(state: FileState) {
    switch (state) {
        case FileState.OK:
            return 'positive';
        case FileState.ERROR:
            return 'negative';
        case FileState.UPLOADING:
            return 'warning';
        case FileState.CORRUPTED:
            return 'negative';
        case FileState.MOVING:
            return 'warning';
        case FileState.LOST:
            return 'negative';
        case FileState.FOUND:
            return 'positive';
        case FileState.CONVERSION_ERROR:
            return 'negative';
    }
}

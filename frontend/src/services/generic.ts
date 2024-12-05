import { downloadFile } from 'src/services/queries/file';
import {
    AccessGroupRights,
    ActionState,
    DataType,
    FileState,
    QueueState,
} from '@common/enum';

import { FileWithTopicDto } from '@api/types/files/file.dto';

export const icon = (type: DataType) => {
    switch (type) {
        case DataType.BOOLEAN: {
            return 'sym_o_check_box';
        }
        case DataType.NUMBER: {
            return 'sym_o_looks_one';
        }
        case DataType.STRING: {
            return 'sym_o_text_fields';
        }
        case DataType.DATE: {
            return 'sym_o_event';
        }
        case DataType.LOCATION: {
            return 'sym_o_location_on';
        }
        case DataType.LINK: {
            return 'sym_o_link';
        }
        case DataType.ANY: {
            return 'sym_o_help';
        }
    }
};

export const accessGroupRightsMap = {
    [AccessGroupRights.READ]: 'Read',
    [AccessGroupRights.CREATE]: 'Create',
    [AccessGroupRights.WRITE]: 'Write',
    [AccessGroupRights.DELETE]: 'Delete',
    [AccessGroupRights._ADMIN]: 'Admin',
};

export function getAccessRightDescription(
    value: AccessGroupRights | undefined,
): string {
    if (value === undefined || value === AccessGroupRights._ADMIN) {
        return 'Unknown';
    }
    return accessGroupRightsMap[value];
}

export function getColor(state: QueueState) {
    switch (state) {
        case QueueState.COMPLETED: {
            return 'green';
        }
        case QueueState.ERROR:
        case QueueState.CANCELED: {
            return 'red';
        }
        case QueueState.AWAITING_PROCESSING: {
            return 'yellow';
        }
        case QueueState.CONVERTING_AND_EXTRACTING_TOPICS:
        case QueueState.UPLOADING:
        case QueueState.DOWNLOADING:
        case QueueState.PROCESSING: {
            return 'blue';
        }
        case QueueState.AWAITING_UPLOAD: {
            return 'purple';
        }
        case QueueState.CORRUPTED:
        case QueueState.UNSUPPORTED_FILE_TYPE:
        case QueueState.FILE_ALREADY_EXISTS: {
            return 'orange';
        }

        default: {
            return 'grey';
        } // Default color for unknown states
    }
}

export function getSimpleFileStateName(state: QueueState) {
    switch (state) {
        case QueueState.COMPLETED: {
            return 'Completed';
        }
        case QueueState.ERROR: {
            return 'Error';
        }
        case QueueState.CANCELED: {
            return 'Canceled';
        }
        case QueueState.AWAITING_PROCESSING: {
            return 'Awaiting Processing';
        }
        case QueueState.CONVERTING_AND_EXTRACTING_TOPICS:
        case QueueState.UPLOADING:
        case QueueState.DOWNLOADING:
        case QueueState.PROCESSING: {
            return 'Processing';
        }
        case QueueState.AWAITING_UPLOAD: {
            return 'Awaiting Upload';
        }
        case QueueState.CORRUPTED: {
            return 'Corrupted';
        }
        case QueueState.UNSUPPORTED_FILE_TYPE:
        case QueueState.FILE_ALREADY_EXISTS: {
            return 'Skipped';
        }
        default: {
            return 'Unknown';
        } // Default color for unknown states
    }
}

export function getDetailedFileState(state: QueueState) {
    switch (state) {
        case QueueState.COMPLETED: {
            return 'File has been processed and is ready for download';
        }
        case QueueState.ERROR: {
            return 'An error occurred during processing';
        }
        case QueueState.CANCELED: {
            return 'File upload was canceled';
        }
        case QueueState.AWAITING_PROCESSING: {
            return 'File is awaiting processing';
        }
        case QueueState.CONVERTING_AND_EXTRACTING_TOPICS: {
            return 'File is being converted and topics are being extracted';
        }
        case QueueState.UPLOADING: {
            return 'File is being uploaded';
        }
        case QueueState.PROCESSING: {
            return 'File is being processed';
        }
        case QueueState.AWAITING_UPLOAD: {
            return 'File is awaiting upload';
        }
        case QueueState.CORRUPTED: {
            return 'File is corrupted';
        }
        case QueueState.DOWNLOADING: {
            return 'File is being downloaded';
        }
        case QueueState.UNSUPPORTED_FILE_TYPE: {
            return 'File has an unsupported file type';
        }
        case QueueState.FILE_ALREADY_EXISTS: {
            return 'A File with the same name already exists';
        }
        default: {
            return 'Unknown';
        } // Default color for unknown states
    }
}

export async function _downloadFile(fileUUID: string, filename: string) {
    const res = await downloadFile(fileUUID, true);
    const a = document.createElement('a');
    a.href = res;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
}

export async function _downloadFiles(files: FileWithTopicDto[]) {
    const downloadPromises = files.map(async (file) => {
        try {
            const url = await downloadFile(file.uuid, true);
            return { url, filename: file.filename };
        } catch {
            return { url: '', filename: file.filename };
        }
    });
    const downloadURLs = await Promise.all(downloadPromises);
    await downloadFiles(downloadURLs);
}

async function downloadFiles(files: { url: string; filename: string }[]) {
    // Ensure that the File System Access API is supported
    // @ts-expect-error
    if (!globalThis.showDirectoryPicker) {
        throw new Error(
            'File System Access API is not supported in this browser.',
        );
    }

    try {
        // Open a directory picker so the user can select where to save the files
        // @ts-expect-error
        const directoryHandle = await globalThis.showDirectoryPicker();

        for (const { url, filename } of files) {
            // Fetch the file using streaming
            const response = await fetch(url);

            if (!response.ok) {
                console.error(`Failed to fetch ${url}`);
                continue;
            }

            // Create a file handle and writable stream for the file
            const fileHandle = await directoryHandle.getFileHandle(filename, {
                create: true,
            });
            const writableStream = await fileHandle.createWritable();

            // Create a reader for the response body stream
            const reader = response.body?.getReader();

            // Function to pump the stream chunks to the file
            async function streamToFileSystem() {
                let done: boolean;
                let value: Uint8Array;

                while (true) {
                    if (reader === undefined) break;

                    // Read the next chunk from the stream
                    const { done: streamDone, value: chunk } =
                        await reader.read();
                    done = streamDone;
                    if (chunk === undefined) break;
                    value = chunk;
                    if (done) break;

                    // Write the current chunk to the file
                    await writableStream.write(value);
                }
            }

            // Stream the file contents
            await streamToFileSystem();

            // Close the writable stream once done
            await writableStream.close();

            console.log(`Successfully saved ${filename}`);
        }
    } catch (error) {
        console.error('Error during file download:', error);
    }
}

export function getActionColor(state: ActionState) {
    switch (state) {
        case ActionState.DONE: {
            return 'green';
        }
        case ActionState.FAILED: {
            return 'red';
        }
        case ActionState.PENDING: {
            return 'orange';
        }
        case ActionState.STARTING: {
            return 'blue-4';
        }
        case ActionState.PROCESSING: {
            return 'blue';
        }
        case ActionState.UNPROCESSABLE: {
            return 'purple';
        }
        case ActionState.STOPPING: {
            return 'light-green';
        }
        default: {
            return 'grey';
        } // Default color for unknown states
    }
}

export function getTooltip(state: FileState | undefined) {
    if (state === undefined) {
        return 'Unknown';
    }

    switch (state) {
        case FileState.OK: {
            return 'File is OK';
        }
        case FileState.ERROR: {
            return 'File has an error';
        }
        case FileState.UPLOADING: {
            return 'File is uploading';
        }
        case FileState.CORRUPTED: {
            return 'File is corrupted';
        }
        case FileState.LOST: {
            return 'File cannot be found in storage';
        }
        case FileState.FOUND: {
            return 'File was recovered';
        }
        case FileState.CONVERSION_ERROR: {
            return 'File conversion failed';
        }
    }
}

export function getIcon(state: FileState) {
    switch (state) {
        case FileState.OK: {
            return 'sym_o_check_circle';
        }
        case FileState.ERROR: {
            return 'sym_o_error';
        }
        case FileState.UPLOADING: {
            return 'sym_o_arrow_upload_progress';
        }
        case FileState.CORRUPTED: {
            return 'sym_o_sentiment_very_dissatisfied';
        }
        case FileState.LOST: {
            return 'sym_o_pulse_alert';
        }
        case FileState.FOUND: {
            return 'sym_o_helicopter';
        }
        case FileState.CONVERSION_ERROR: {
            return 'sym_o_conversion_path_off';
        }
    }
}

export function getColorFileState(state: FileState) {
    switch (state) {
        case FileState.OK: {
            return 'positive';
        }
        case FileState.ERROR: {
            return 'negative';
        }
        case FileState.UPLOADING: {
            return 'warning';
        }
        case FileState.CORRUPTED: {
            return 'negative';
        }
        case FileState.LOST: {
            return 'negative';
        }
        case FileState.FOUND: {
            return 'positive';
        }
        case FileState.CONVERSION_ERROR: {
            return 'negative';
        }
    }
}

const colorPalette = [
    'red',
    'pink',
    'purple',
    'deep-purple',
    'indigo',
    'blue',
    'light-blue',
    'cyan',
    'teal',
    'green',
    'light-green',
    'lime',
    'yellow',
    'amber',
    'orange',
    'deep-orange',
    'brown',
    'grey',
    'blue-grey',
    'black',
];

export function hashUUIDtoColor(uuid: string): string {
    const hash = uuid
        .split('')
        .reduce((accumulator, char) => accumulator + char.charCodeAt(0), 0);
    const colorIndex = hash % colorPalette.length;
    return colorPalette[colorIndex];
}

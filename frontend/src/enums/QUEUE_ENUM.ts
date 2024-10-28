/* eslint-disable @typescript-eslint/naming-convention */
export enum QueueState {
    'AWAITING_UPLOAD' = 0,
    'AWAITING_PROCESSING' = 10,
    'PROCESSING' = 20,
    'DOWNLOADING' = 21,
    'CONVERTING_AND_EXTRACTING_TOPICS' = 22,
    'UPLOADING' = 23,
    'COMPLETED' = 30,
    'ERROR' = 40,
    'CORRUPTED' = 41,
    'CANCELED' = 42,
    'UNSUPPORTED_FILE_TYPE' = 43,
    'FILE_ALREADY_EXISTS' = 44,
}

export enum FileLocation {
    DRIVE = 'DRIVE',
    MINIO = 'MINIO',
}

export enum ActionState {
    PENDING = 'PENDING',
    STARTING = 'STARTING',
    PROCESSING = 'PROCESSING',
    DONE = 'DONE',
    FAILED = 'FAILED',
    UNPROCESSABLE = 'UNPROCESSABLE',
}

export enum FileState {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    DONE = 'DONE',
    ERROR = 'ERROR',
    AWAITING_UPLOAD = 'AWAITING_UPLOAD',
}

export enum FileLocation {
    DRIVE = 'DRIVE',
    MINIO = 'MINIO',
}

export enum ActionState {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    DONE = 'DONE',
    FAILED = 'FAILED',
}

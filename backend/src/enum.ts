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
export enum UserRole {
    ADMIN = 'ADMIN',
    USER = 'USER',
}

export enum AnalysisState {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    DONE = 'DONE',
    ERROR = 'ERROR',
}

export enum TokenTypes {
    CONTAINER = 'CONTAINER',
}

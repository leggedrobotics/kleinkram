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

export enum ActionState {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    DONE = 'DONE',
    ERROR = 'ERROR',
    FAILED = 'FAILED',
}

export enum KeyTypes {
    CONTAINER = 'CONTAINER',
}

export enum CookieNames {
    AUTH_TOKEN = 'authtoken',
    REFRESH_TOKEN = 'refreshtoken',
    CLI_KEY = 'clikey',
}

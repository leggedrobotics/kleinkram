// disable naming-convention rule for enum.ts
/* eslint @typescript-eslint/naming-convention: 0 */

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

export enum FileOrigin {
    GOOGLE_DRIVE = 'GOOGLE_DRIVE',
    UPLOAD = 'UPLOAD',
    CONVERTED = 'CONVERTED',
    UNKNOWN = 'UNKNOWN',
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
    STARTING = 'STARTING',
    PROCESSING = 'PROCESSING',
    DONE = 'DONE',
    FAILED = 'FAILED',
    UNPROCESSABLE = 'UNPROCESSABLE',
}

export enum KeyTypes {
    CONTAINER = 'CONTAINER',
}

export enum CookieNames {
    AUTH_TOKEN = 'authtoken',
    REFRESH_TOKEN = 'refreshtoken',
    CLI_KEY = 'clikey',
}

export enum FileType {
    BAG = 'BAG',
    MCAP = 'MCAP',
}

export enum Providers {
    GOOGLE = 'google',
}

export enum AccessGroupRights {
    READ = 0,
    CREATE = 10,
    WRITE = 20,
    DELETE = 30,
}

export enum DataType {
    STRING = 'STRING',
    NUMBER = 'NUMBER',
    BOOLEAN = 'BOOLEAN',
    DATE = 'DATE',
    LOCATION = 'LOCATION',
    LINK = 'LINK',
}

export enum ArtifactState {
    AWAITING_ACTION = 10,
    UPLOADING = 20,
    UPLOADED = 30,
    ERROR = 40,
}

export enum FileState {
    OK = 'OK',
    CORRUPTED = 'CORRUPTED',
    UPLOADING = 'UPLOADING',
    MOVING = 'MOVING',
    ERROR = 'ERROR',
    CONVERSION_ERROR = 'CONVERSION_ERROR',
    LOST = 'LOST',
    FOUND = 'FOUND',
}

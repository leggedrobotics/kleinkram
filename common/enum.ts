export enum FileState {
    PENDING = 'PENDING',
    UPLOADING = 'UPLOADING',
    PROCESSING = 'PROCESSING',
    CORRUPTED_FILE = 'CORRUPTED_FILE',
    ERROR = 'ERROR',
    DONE = 'DONE',
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
}

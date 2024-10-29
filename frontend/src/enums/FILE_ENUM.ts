/* eslint-disable @typescript-eslint/naming-convention */
export enum FileType {
    BAG = 'BAG',
    MCAP = 'MCAP',
    ALL = 'ALL',
}

export enum FileState {
    OK = 'OK',
    CORRUPTED = 'CORRUPTED',
    UPLOADING = 'UPLOADING',
    ERROR = 'ERROR',
    CONVERSION_ERROR = 'CONVERSION_ERROR',
    LOST = 'LOST',
    FOUND = 'FOUND',
}

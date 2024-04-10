export enum FileState {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  DONE = 'DONE',
  ERROR = 'ERROR',
}

export enum FileLocation {
  DRIVE = 'DRIVE',
  MINIO = 'MINIO',
}

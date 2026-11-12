/**
 * Maximum number of files a single `POST /files/temporaryAccess` request may
 * ask credentials for. Each file costs one STS call, so this caps the work one
 * request can trigger.
 */
export const MAX_FILES_PER_UPLOAD_REQUEST = 1000;

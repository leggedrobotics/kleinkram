export const MISSION_NAME_REGEX = /^[\w\-_]{3,50}$/;

export const PROJECT_NAME_REGEX = /^[\w\-_]{3,50}$/;

export const NON_UUID_REGEX =
    /^(?![0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$)/;

export { FILE_NAME_REGEX } from '../../../common/frontend_shared/validation/filename.validation';

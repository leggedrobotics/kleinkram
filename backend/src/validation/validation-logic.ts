import { FileType } from '@common/frontend_shared/enum';

export const MISSION_NAME_REGEX = /^[\w\-_]{3,50}$/;

export const PROJECT_NAME_REGEX = /^[\w\-_]{3,50}$/;

const validTypes = Object.values(FileType).filter(
    (type) => type !== FileType.ALL,
);
const extensionsGroup = validTypes.map((type) => type.toLowerCase()).join('|');
const regexString = `^[\\w\\-.()]{3,50}\\.(${extensionsGroup})$`;
export const FILE_NAME_REGEX = new RegExp(regexString);

export const NON_UUID_REGEX =
    /^(?![0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$)/;

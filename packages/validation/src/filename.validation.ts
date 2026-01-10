import { FileType } from '@kleinkram/shared';

const validTypes = Object.values(FileType).filter(
    (type) => type !== FileType.ALL,
);
const extensionsGroup = [
    ...validTypes.map((type) => type.toLowerCase()),
    'yml',
].join('|');

// Regex for the full filename including extension
const regexString = String.raw`^[\w\-.()]{3,50}\.(${extensionsGroup})$`;
export const FILE_NAME_REGEX = new RegExp(regexString);

// Regex for the filename part (without extension)
// Allow alphanumeric, underscore, hyphen, dot, brackets
export const FILENAME_PART_REGEX = /^[a-zA-Z0-9_\-.()[\]äöüÄÖÜ]+$/;

export const FILENAME_MAX_LENGTH = 50;

// Validation functions

export const isValidFileName = (filename: string): boolean => {
    return (
        filename.length <= FILENAME_MAX_LENGTH && FILE_NAME_REGEX.test(filename)
    );
};

export const isValidFileNamePart = (namePart: string): boolean => {
    return FILENAME_PART_REGEX.test(namePart);
};

export const splitFileName = (
    filename: string,
): { name: string; extension: string } => {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex <= 0) {
        return { name: filename, extension: '' };
    }
    return {
        name: filename.slice(0, lastDotIndex),
        extension: filename.slice(lastDotIndex),
    };
};

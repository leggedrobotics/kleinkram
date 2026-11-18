import { FileType } from '@kleinkram/shared';

import {
    getNameCharacterProblem,
    NAME_ALLOWED_CHARACTERS,
    suggestName,
} from './name.validation';
import { NON_UUID_REGEX } from './validation-logic';

/**
 * Naming rules for files. The part before the extension follows the rules of
 * project and mission names (`name.validation.ts`): letters, digits, '.', '-'
 * and '_', not starting with '.' or '-', not a UUID; 3 to 50 characters long.
 * The extension must be one of the supported file types, in lowercase.
 *
 * The CLI mirrors these rules in `cli/kleinkram/utils.py`. Both are checked
 * against the shared cases in `packages/validation/test-cases/names.json`.
 */
export const FILENAME_MIN_LENGTH = 3;
export const FILENAME_MAX_LENGTH = 50;

export const FILE_EXTENSIONS: readonly string[] = [
    ...Object.values(FileType)
        .filter((type) => type !== FileType.ALL)
        .map((type) => `.${type.toLowerCase()}`),
    '.yml',
];

const extensionsGroup = FILE_EXTENSIONS.map((extension) =>
    extension.slice(1),
).join('|');

// the whole file name, extension included
export const FILE_NAME_REGEX = new RegExp(
    String.raw`^(?![.-])[${NAME_ALLOWED_CHARACTERS}]{${String(FILENAME_MIN_LENGTH)},${String(FILENAME_MAX_LENGTH)}}\.(${extensionsGroup})$`,
);

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

/**
 * Turns an invalid file name into a valid one, e.g. `run 1.MCAP` into
 * `run-1.mcap`. Returns undefined if no valid name can be derived.
 */
export const suggestFileName = (filename: string): string | undefined => {
    const { name, extension } = splitFileName(filename);
    const lowerExtension = extension.toLowerCase();
    if (!FILE_EXTENSIONS.includes(lowerExtension)) return undefined;
    const suggestion = suggestName(name.slice(0, FILENAME_MAX_LENGTH));
    if (suggestion === undefined) return undefined;
    const candidate = suggestion.slice(0, FILENAME_MAX_LENGTH) + lowerExtension;
    return getFileNameValidationError(candidate) === undefined
        ? candidate
        : undefined;
};

/**
 * Returns a human-readable error for an invalid file name, or undefined if
 * the name is valid.
 */
export const getFileNameValidationError = (
    filename: string,
    label = 'File name',
): string | undefined => {
    if (!filename) return `${label} is required`;

    const { name, extension } = splitFileName(filename);
    if (!FILE_EXTENSIONS.includes(extension)) {
        if (FILE_EXTENSIONS.includes(extension.toLowerCase()))
            return `${label} must end with a lowercase extension. Try "${name}${extension.toLowerCase()}".`;
        return `${label} must end with one of ${FILE_EXTENSIONS.join(', ')}`;
    }

    if (name.length < FILENAME_MIN_LENGTH)
        return `${label} must be at least ${String(FILENAME_MIN_LENGTH)} characters long without the extension`;

    if (name.length > FILENAME_MAX_LENGTH)
        return `${label} must be at most ${String(FILENAME_MAX_LENGTH)} characters long without the extension`;

    if (!NON_UUID_REGEX.test(name)) return `${label} must not be a UUID`;

    if (FILE_NAME_REGEX.test(filename)) return undefined;

    const problem = getNameCharacterProblem(name, label);
    const suggestion = suggestFileName(filename);
    return suggestion ? `${problem}. Try "${suggestion}".` : `${problem}.`;
};

export const isValidFileName = (filename: string): boolean =>
    getFileNameValidationError(filename) === undefined;

/**
 * Names of Python scripts submitted with `klein action run-script`. The name
 * only labels the stored object, it never becomes a path: a flat `.py` name
 * of up to 96 characters before the extension. Spelled out instead of `\w`,
 * which matches only ASCII in JavaScript but any letter in Python.
 */
export const SCRIPT_FILENAME_REGEX = /^[A-Za-z0-9_.-]{1,96}\.py$/;

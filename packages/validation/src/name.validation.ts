import { NON_UUID_REGEX } from './validation-logic';

/**
 * Naming rules for projects, missions and access groups. These names are
 * used as identifiers in the CLI and SDK, so they are limited to characters
 * that need no quoting in a shell and are valid directory names.
 *
 * File names follow the same rules for the part before the extension, see
 * `filename.validation.ts`.
 *
 * The CLI mirrors these rules in `cli/kleinkram/core.py`. Both are checked
 * against the shared cases in `packages/validation/test-cases/names.json`.
 */
export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 100;

export const NAME_ALLOWED_CHARACTERS = String.raw`A-Za-z0-9_.\-`;

// must not start with '.' (a hidden directory) or '-' (read as an option on
// a command line)
export const NAME_REGEX = new RegExp(
    `^(?![.-])[${NAME_ALLOWED_CHARACTERS}]{${String(NAME_MIN_LENGTH)},${String(NAME_MAX_LENGTH)}}$`,
);

const INVALID_CHARACTER_REGEX = new RegExp(
    `[^${NAME_ALLOWED_CHARACTERS}]`,
    'g',
);

/**
 * Turns an invalid name into a valid one, e.g. `My Project` into `My-Project`.
 * Returns undefined if no valid name can be derived.
 */
export const suggestName = (name: string): string | undefined => {
    const suggestion = name
        .normalize('NFKD')
        .replaceAll(/[\u0300-\u036F]/g, '') // drop accents: ü -> u
        .replaceAll(new RegExp(`[^${NAME_ALLOWED_CHARACTERS}]+`, 'g'), '-')
        .replaceAll(/-{2,}/g, '-')
        .replace(/^[.-]+/, '')
        .replace(/-+$/, '')
        .slice(0, NAME_MAX_LENGTH);

    return NAME_REGEX.test(suggestion) && NON_UUID_REGEX.test(suggestion)
        ? suggestion
        : undefined;
};

/**
 * What is wrong with the characters of a name that has a valid length:
 * a character outside the allowed set, or a leading '.'.
 */
export const getNameCharacterProblem = (
    name: string,
    label: string,
): string => {
    const invalidCharacters = [...new Set(name.match(INVALID_CHARACTER_REGEX))];
    return invalidCharacters.length > 0
        ? `${label} may only contain letters, digits, '.', '-' and '_' (found ${invalidCharacters
              .map((c) => (c === ' ' ? 'space' : `'${c}'`))
              .join(', ')})`
        : `${label} must not start with '.' or '-'`;
};

/**
 * Returns a human-readable error for an invalid name, or undefined if the
 * name is valid. The `label` is used as the subject, e.g. "Project name".
 */
export const getNameValidationError = (
    name: string,
    label = 'Name',
): string | undefined => {
    if (!name) return `${label} is required`;

    if (name.length < NAME_MIN_LENGTH)
        return `${label} must be at least ${String(NAME_MIN_LENGTH)} characters long`;

    if (name.length > NAME_MAX_LENGTH)
        return `${label} must be at most ${String(NAME_MAX_LENGTH)} characters long`;

    if (!NON_UUID_REGEX.test(name)) return `${label} must not be a UUID`;

    if (NAME_REGEX.test(name)) return undefined;

    const problem = getNameCharacterProblem(name, label);
    const suggestion = suggestName(name);
    return suggestion ? `${problem}. Try "${suggestion}".` : `${problem}.`;
};

export const isValidName = (name: string): boolean =>
    getNameValidationError(name) === undefined;

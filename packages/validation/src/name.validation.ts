import { NON_UUID_REGEX } from './validation-logic';

/**
 * Naming rules for projects, missions and access groups. These names are
 * used as identifiers in the CLI and SDK, so they are limited to characters
 * that need no quoting in a shell and are valid directory names.
 *
 * The CLI duplicates these rules in `cli/kleinkram/core.py`, keep both in sync.
 */
export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 100;

const ALLOWED_CHARACTERS = String.raw`A-Za-z0-9_.\-`;

// must not start with a dot, so a name never becomes a hidden directory
export const NAME_REGEX = new RegExp(
    String.raw`^(?!\.)[${ALLOWED_CHARACTERS}]{${String(NAME_MIN_LENGTH)},${String(NAME_MAX_LENGTH)}}$`,
);

const INVALID_CHARACTER_REGEX = new RegExp(`[^${ALLOWED_CHARACTERS}]`, 'g');

/**
 * Turns an invalid name into a valid one, e.g. `My Project` into `My-Project`.
 * Returns undefined if no valid name can be derived.
 */
export const suggestName = (name: string): string | undefined => {
    const suggestion = name
        .normalize('NFKD')
        .replaceAll(/[\u0300-\u036F]/g, '') // drop accents: ü -> u
        .replaceAll(new RegExp(`[^${ALLOWED_CHARACTERS}]+`, 'g'), '-')
        .replaceAll(/-{2,}/g, '-')
        .replace(/^[.-]+/, '')
        .replace(/-+$/, '')
        .slice(0, NAME_MAX_LENGTH);

    return NAME_REGEX.test(suggestion) && NON_UUID_REGEX.test(suggestion)
        ? suggestion
        : undefined;
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

    const invalidCharacters = [...new Set(name.match(INVALID_CHARACTER_REGEX))];
    const problem =
        invalidCharacters.length > 0
            ? `${label} may only contain letters, digits, '.', '-' and '_' (found ${invalidCharacters
                  .map((c) => (c === ' ' ? 'space' : `'${c}'`))
                  .join(', ')})`
            : `${label} must not start with '.'`;

    const suggestion = suggestName(name);
    return suggestion ? `${problem}. Try "${suggestion}".` : `${problem}.`;
};

export const isValidName = (name: string): boolean =>
    getNameValidationError(name) === undefined;

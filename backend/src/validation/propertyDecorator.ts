import { ValidationOptions } from 'class-validator/types/decorator/ValidationOptions';
import { Matches } from 'class-validator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const IsNoValidUUID = (
    validationOptions?: ValidationOptions,
): PropertyDecorator =>
    Matches(
        /^(?![0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$)/,
        {
            message: 'File name is not valid, are you trying to use a UUID?',
            ...validationOptions,
        },
    );

/**
 * Validates that the property is a valid filename.
 *
 * A valid file name is ending with .bag or .mcap.
 * The file name can contain letters, numbers, underscores, hyphens and dots.
 *
 * Spaces, special characters and other characters are not allowed.
 *
 * @param validationOptions
 * @constructor
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IsValidFileName = (
    validationOptions?: ValidationOptions,
): PropertyDecorator =>
    Matches(/^[\w\-.() ]{3,50}.(bag|mcap)$/, {
        message: 'Filename is not valid!',
        ...validationOptions,
    });

/**
 * Validates that the property is a valid project name.
 *
 * numbers [0-9]
 * letters [A-Z, a-z]
 * underscore [_]
 * dash [-]
 *
 * A valid project name is between 3 and 20 characters long.
 *
 * @param validationOptions
 * @constructor
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IsValidName = (
    validationOptions?: ValidationOptions,
): PropertyDecorator =>
    Matches(/^[\w\-_]{3,20}$/, {
        message: 'Project name is not valid!',
        ...validationOptions,
    });

/**
 * Validates that the property is a valid mission name.
 *
 * numbers [0-9]
 * letters [A-Z, a-z]
 * underscore [_]
 * dash [-]
 *
 * A valid mission name is between 3 and 40 characters long.
 *
 * @param validationOptions
 * @constructor
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IsValidMissionName = (
    validationOptions?: ValidationOptions,
): PropertyDecorator =>
    Matches(/^[\w\-_]{3,40}$/, {
        message: 'Mission name is not valid!',
        ...validationOptions,
    });

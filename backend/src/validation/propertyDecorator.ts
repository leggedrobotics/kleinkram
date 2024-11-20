import { ValidationOptions } from 'class-validator/types/decorator/ValidationOptions';
import { Matches } from 'class-validator';
import {
    FILE_NAME_REGEX,
    MISSION_NAME_REGEX,
    PROJECT_NAME_REGEX,
    NON_UUID_REGEX,
} from './validationLogic';

export const IsNoValidUUID = (
    validationOptions?: ValidationOptions,
): PropertyDecorator =>
    Matches(NON_UUID_REGEX, {
        message: 'File name is not valid, are you trying to use a UUID?',
        ...validationOptions,
    });

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

export const IsValidFileName = (
    validationOptions?: ValidationOptions,
): PropertyDecorator =>
    Matches(FILE_NAME_REGEX, {
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

export const IsValidName = (
    validationOptions?: ValidationOptions,
): PropertyDecorator =>
    Matches(PROJECT_NAME_REGEX, {
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

export const IsValidMissionName = (
    validationOptions?: ValidationOptions,
): PropertyDecorator =>
    Matches(MISSION_NAME_REGEX, {
        message: 'Mission name is not valid!',
        ...validationOptions,
    });

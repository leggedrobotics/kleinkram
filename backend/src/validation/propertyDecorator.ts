import { ValidationOptions } from 'class-validator/types/decorator/ValidationOptions';
import { Matches } from 'class-validator';

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
    Matches(/^[\w\-.() ]+.(bag|mcap)$/, {
        message: 'Filename is not valid!',
        ...validationOptions,
    });

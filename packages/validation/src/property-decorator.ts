import {
    Matches,
    registerDecorator,
    ValidationArguments,
} from 'class-validator';
import { ValidationOptions } from 'class-validator/types/decorator/ValidationOptions';
import { isValidDockerImageName } from './docker-image.validation';
import { FILE_NAME_REGEX } from './filename.validation';
import { getNameValidationError } from './name.validation';
import { NON_UUID_REGEX } from './validation-logic';

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
        message: 'Filename "$value" is not valid!',
        ...validationOptions,
    });

/**
 * Validates that the property is a valid project, mission or access group
 * name, see `name.validation.ts` for the rules.
 *
 * @param label the subject used in the error message, e.g. "Project name"
 * @param validationOptions
 */
export function IsValidName(
    label = 'Name',
    validationOptions?: ValidationOptions,
): PropertyDecorator {
    return function (object: object, propertyName: string | symbol) {
        registerDecorator({
            name: 'isValidName',
            target: object.constructor,
            propertyName: propertyName as string,
            options: validationOptions,
            validator: {
                validate(value: unknown) {
                    return (
                        typeof value === 'string' &&
                        getNameValidationError(value, label) === undefined
                    );
                },
                defaultMessage(validationArguments: ValidationArguments) {
                    return (
                        getNameValidationError(
                            typeof validationArguments.value === 'string'
                                ? validationArguments.value
                                : '',
                            label,
                        ) ?? `${label} is not valid`
                    );
                },
            },
        });
    };
}

export function IsDockerImage(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            name: 'isDockerImage',

            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                validate(value: any, _args: ValidationArguments) {
                    return (
                        typeof value === 'string' &&
                        isValidDockerImageName(value)
                    );
                },
                defaultMessage(_args: ValidationArguments) {
                    return `Invalid Docker image name. It contains forbidden characters, has an invalid format, or exceeds the maximum length.`;
                },
            },
        });
    };
}

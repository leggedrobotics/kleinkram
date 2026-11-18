import {
    Matches,
    registerDecorator,
    ValidationArguments,
} from 'class-validator';
import { ValidationOptions } from 'class-validator/types/decorator/ValidationOptions';
import { isValidDockerImageName } from './docker-image.validation';
import { getFileNameValidationError } from './filename.validation';
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
 * Validates that the property is a valid file name, see
 * `filename.validation.ts` for the rules. The error message says what is
 * wrong and suggests a valid name.
 *
 * @param validationOptions
 */
export function IsValidFileName(
    validationOptions?: ValidationOptions,
): PropertyDecorator {
    return function (object: object, propertyName: string | symbol) {
        registerDecorator({
            name: 'isValidFileName',
            target: object.constructor,
            propertyName: propertyName as string,
            options: validationOptions,
            validator: {
                validate(value: unknown) {
                    return (
                        typeof value === 'string' &&
                        getFileNameValidationError(value) === undefined
                    );
                },
                defaultMessage(validationArguments: ValidationArguments) {
                    // with `each: true` the message gets the whole list: name the bad entry
                    const value: unknown = validationArguments.value;
                    if (Array.isArray(value)) {
                        for (const entry of value) {
                            const error =
                                typeof entry === 'string'
                                    ? getFileNameValidationError(entry)
                                    : 'File name is not valid';
                            if (error !== undefined)
                                return `${String(entry)}: ${error}`;
                        }
                    }
                    return (
                        getFileNameValidationError(
                            typeof value === 'string' ? value : '',
                        ) ?? 'File name is not valid'
                    );
                },
            },
        });
    };
}

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

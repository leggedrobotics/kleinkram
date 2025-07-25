import { buildMessage, ValidateBy, ValidationOptions } from 'class-validator';

export function isRecordStringString(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    return Object.entries(value).every(
        ([key, value_]) =>
            typeof key === 'string' && typeof value_ === 'string',
    );
}

export function IsRecordStringString(
    validationOptions?: ValidationOptions,
): PropertyDecorator {
    return ValidateBy({
        name: 'IsRecordStringString',
        constraints: [],
        validator: {
            validate: (value: unknown): boolean => isRecordStringString(value),
            defaultMessage: buildMessage(
                (eachPrefix) =>
                    `${
                        eachPrefix
                    }$property must be a record of string key-value pairs`,
                validationOptions,
            ),
        },
    });
}

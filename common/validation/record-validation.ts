import { ValidationOptions } from 'class-validator';
import { ValidateBy } from 'class-validator';
import { buildMessage } from 'class-validator';

export function isRecordStringString(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    return Object.entries(value).every(
        ([key, val]) => typeof key === 'string' && typeof val === 'string',
    );
}

export function IsRecordStringString(
    validationOptions?: ValidationOptions,
): PropertyDecorator {
    return ValidateBy({
        name: 'IsRecordStringString',
        constraints: [],
        validator: {
            validate: (value: unknown, _): boolean =>
                isRecordStringString(value),
            defaultMessage: buildMessage(
                (eachPrefix) =>
                    eachPrefix +
                    '$property must be a record of string key-value pairs',
                validationOptions,
            ),
        },
    });
}

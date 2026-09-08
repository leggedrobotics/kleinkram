import { registerDecorator } from 'class-validator';
import { ValidationOptions } from 'class-validator/types/decorator/ValidationOptions';

export function IsSkip(validationOptions?: ValidationOptions) {
    return (object: object, propertyName: string): void => {
        registerDecorator({
            name: 'isSkip',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions ?? {},
            validator: {
                validate(value: number) {
                    // Allow undefined (optional)
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    if (value === undefined) return true;

                    // Check if the value is an integer and within range
                    return (
                        Number.isInteger(value) &&
                        value >= 0 &&
                        value <= Number.MAX_SAFE_INTEGER
                    );
                },
                defaultMessage() {
                    return 'Skip must be an optional non-negative integer'; // Custom error message
                },
            },
        });
    };
}

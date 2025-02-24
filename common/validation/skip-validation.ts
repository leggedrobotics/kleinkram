import { ValidationOptions } from 'class-validator/types/decorator/ValidationOptions';
import { registerDecorator } from 'class-validator';

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
                    if (value === undefined) return true;

                    // Check if the value is an integer and within range
                    return (
                        Number.isInteger(value) && value >= 0 && value <= 9999
                    );
                },
                defaultMessage() {
                    return 'Skip must be an optional integer between 0 and 9999'; // Custom error message
                },
            },
        });
    };
}

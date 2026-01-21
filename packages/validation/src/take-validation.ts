import { registerDecorator } from 'class-validator';
import { ValidationOptions } from 'class-validator/types/decorator/ValidationOptions';

export function IsTake(validationOptions?: ValidationOptions) {
    return (object: object, propertyName: string): void => {
        registerDecorator({
            name: 'isTake',
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
                        Number.isInteger(value) && value >= 0 && value <= 50_000
                    );
                },
                defaultMessage() {
                    return 'Take must be an optional integer between 0 and 50000'; // Custom error message
                },
            },
        });
    };
}

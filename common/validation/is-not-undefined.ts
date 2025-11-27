import { registerDecorator, ValidationOptions } from 'class-validator';

export const IsNotUndefined = (validationOptions?: ValidationOptions) => {
    return function (object: object, propertyName: string): void {
        registerDecorator({
            name: 'isNotUndefined',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions ?? {},
            validator: {
                validate(value: unknown): Promise<boolean> | boolean {
                    return value !== undefined;
                },
                defaultMessage(): string {
                    return '$property must not be undefined';
                },
            },
        });
    };
};

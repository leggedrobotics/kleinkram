import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isDateOrNever', async: false })
export class IsDateOrNeverConstraint implements ValidatorConstraintInterface {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validate(value: any): boolean {
        if (value === 'never') return true;

        // Ensure we strictly receive a Date object (which @Transform creates for valid strings/numbers)
        if (!(value instanceof Date)) return false;

        return !Number.isNaN(value.getTime());
    }

    defaultMessage(): string {
        return 'expireDate must be a valid Date or the string "never".';
    }
}

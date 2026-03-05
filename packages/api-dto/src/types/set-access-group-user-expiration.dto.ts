import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsNotEmpty,
    Validate,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isDateOrNever', async: false })
class IsDateOrNeverConstraint implements ValidatorConstraintInterface {
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

export class SetAccessGroupUserExpirationDto {
    @IsNotEmpty()
    @Validate(IsDateOrNeverConstraint)
    @ApiProperty({
        description:
            'Expiration Date as an ISO 8601 string or the literal string "never".',
        type: String,
        example: '2027-12-31T23:59:59.000Z',
    })
    @Transform(({ value }: { value: unknown }) => {
        if (value === 'never') return 'never';

        // Only parse strings and numbers to prevent implicit `new Date(null)` -> 1970 coercion
        if (typeof value !== 'string' && typeof value !== 'number') {
            return value;
        }

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : date;
    })
    expireDate!: Date | 'never';
}

import { ApiUUIDProperty } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import {
    Validate,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isDateOrNever', async: false })
class IsDateOrNeverConstraint implements ValidatorConstraintInterface {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validate(value: any): boolean {
        if (value === 'never') {
            return true;
        }

        // Try to parse the value as a Date
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const parsedDate = new Date(value);
        return !Number.isNaN(parsedDate.getTime());
    }

    defaultMessage(): string {
        return 'expireDate must be a valid Date or the string "never".';
    }
}

export class SetAccessGroupUserExpirationDto {
    @ApiUUIDProperty('Access Group UUID')
    uuid!: string;

    @ApiUUIDProperty('User UUID')
    userUuid!: string;

    @Validate(IsDateOrNeverConstraint)
    @ApiProperty({ description: 'Expiration Date', format: 'dateString' })
    expireDate!: Date | 'never';
}

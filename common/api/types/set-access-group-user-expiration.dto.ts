import { ApiUUIDProperty } from '../../../backend/src/validation/body-decorators';
import {
    Validate,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'isDateOrNever', async: false })
class IsDateOrNeverConstraint implements ValidatorConstraintInterface {
    validate(value: any): boolean {
        if (value === 'never') {
            return true;
        }

        // Try to parse the value as a Date
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

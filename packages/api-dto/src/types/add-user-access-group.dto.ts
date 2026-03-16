import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID, Validate } from 'class-validator';
import { IsDateOrNeverConstraint } from './is-date-or-never.constraint';

export class AddUserToAccessGroupDto {
    @IsUUID()
    @ApiProperty({ description: 'User UUID', format: 'uuid' })
    userUuid!: string;

    @ApiProperty({
        description: 'Whether the user can edit the access group',
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    canEditGroup?: boolean;

    @ApiProperty({
        description: 'Expiration date or never',
        required: false,
    })
    @IsOptional()
    @Validate(IsDateOrNeverConstraint)
    @Transform(({ value }: { value: unknown }) => {
        if (value === 'never') return 'never';
        if (typeof value !== 'string' && typeof value !== 'number')
            return value;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : date;
    })
    expireDate?: Date | 'never';
}

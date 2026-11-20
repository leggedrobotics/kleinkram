import { MAX_ACCESS_GROUP_BATCH_SIZE } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayNotEmpty,
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsOptional,
    IsUUID,
    Validate,
} from 'class-validator';
import { IsDateOrNeverConstraint } from './is-date-or-never.constraint';

export class AddUsersToAccessGroupDto {
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(MAX_ACCESS_GROUP_BATCH_SIZE)
    @ArrayUnique((uuid: unknown) =>
        typeof uuid === 'string' ? uuid.toLowerCase() : uuid,
    )
    @IsUUID('all', { each: true })
    @ApiProperty({
        description:
            'UUIDs of the users to add. Either all of them are added or none.',
        type: [String],
        format: 'uuid',
        minItems: 1,
        maxItems: MAX_ACCESS_GROUP_BATCH_SIZE,
        uniqueItems: true,
    })
    userUuids!: string[];

    @ApiProperty({
        description: 'Whether the users can edit the access group',
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

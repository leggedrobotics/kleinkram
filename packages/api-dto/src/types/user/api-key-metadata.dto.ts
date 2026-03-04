import { AccessGroupRights, KeyTypes } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsBoolean,
    IsDate,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export class ApiKeyMetadataDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty({ enum: KeyTypes })
    @IsEnum(KeyTypes)
    keyType!: KeyTypes;

    @ApiProperty({ enum: AccessGroupRights })
    @IsEnum(AccessGroupRights)
    rights!: AccessGroupRights;

    @ApiProperty({
        description: 'Whether the key has been soft-deleted (expired)',
    })
    @IsBoolean()
    expired!: boolean;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    missionUuid?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    missionName?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    actionUuid?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    actionTemplateName?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    actionTemplateVersion?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    projectUuid?: string;
}

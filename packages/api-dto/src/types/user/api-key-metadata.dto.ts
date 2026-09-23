/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { AccessGroupRights, KeyTypes } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import {
    IsBoolean,
    IsDate,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

@Expose()
export class ApiKeyMetadataDto {
    @ApiProperty()
    @IsUUID()
    @Expose()
    uuid!: string;

    @ApiProperty({ enum: KeyTypes })
    @IsEnum(KeyTypes)
    @Expose()
    @Transform(({ value, obj }) => obj.key_type ?? value)
    keyType!: KeyTypes;

    @ApiProperty({ enum: AccessGroupRights })
    @IsEnum(AccessGroupRights)
    @Expose()
    rights!: AccessGroupRights;

    @ApiProperty({
        description: 'Whether the key has been soft-deleted (expired)',
    })
    @IsBoolean()
    @Expose()
    @Transform(({ value, obj }) =>
        obj.deletedAt === undefined ? value : !!obj.deletedAt,
    )
    expired!: boolean;

    @ApiProperty()
    @IsDate()
    @Expose()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    @Expose()
    updatedAt!: Date;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    @Expose()
    @Transform(({ value, obj }) => obj.mission?.uuid ?? value)
    missionUuid?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Expose()
    @Transform(({ value, obj }) => obj.mission?.name ?? value)
    missionName?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    @Expose()
    @Transform(({ value, obj }) => obj.action?.uuid ?? value)
    actionUuid?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Expose()
    @Transform(({ value, obj }) => obj.action?.template?.name ?? value)
    actionTemplateName?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Expose()
    @Transform(({ value, obj }) => obj.action?.template?.version ?? value)
    actionTemplateVersion?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    @Expose()
    @Transform(({ value, obj }) => obj.mission?.project?.uuid ?? value)
    projectUuid?: string;
}

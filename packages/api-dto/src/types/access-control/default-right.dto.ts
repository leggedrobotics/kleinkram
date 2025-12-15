import { AccessGroupRights, AccessGroupType } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsString, IsUUID } from 'class-validator';

export class DefaultRightDto {
    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsEnum(AccessGroupType)
    type!: AccessGroupType;

    @ApiProperty()
    @IsEnum(AccessGroupRights)
    rights!: AccessGroupRights;

    @ApiProperty()
    @IsNumber()
    memberCount!: number;
}

import {
    AccessGroupRights,
    AccessGroupType,
} from '../../../frontend_shared/enum';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsEnum, IsNumber, IsString } from 'class-validator';

export class ProjectAccessDto {
    @ApiProperty()
    @IsString()
    uuid!: string;

    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty({
        description: 'Type of the access group',
        format: 'AccessGroupType',
        enum: AccessGroupType,
    })
    @IsEnum(AccessGroupType)
    type!: AccessGroupType;

    @ApiProperty()
    @IsBoolean()
    hidden!: boolean;

    @ApiProperty()
    @IsNumber()
    memberCount!: number;

    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty({
        description: 'Rights of the user in the access group',
        format: 'AccessGroupRights',
        enum: AccessGroupRights,
    })
    @IsEnum(AccessGroupRights)
    rights!: AccessGroupRights;
}

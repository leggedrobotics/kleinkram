import {
    AccessGroupRights,
    AccessGroupType,
} from '../../../frontend_shared/enum';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsBoolean,
    IsDate,
    IsEnum,
    IsNumber,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Paginated } from '../pagination';
import { IsSkip } from '../../../validation/skip-validation';
import { IsTake } from '../../../validation/take-validation';
import { Type } from 'class-transformer';

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

export class ProjectAccessListDto implements Paginated<ProjectAccessDto> {
    @ApiProperty({
        type: [ProjectAccessDto],
        isArray: true,
    })
    @ValidateNested()
    @Type(() => ProjectAccessDto)
    data!: ProjectAccessDto[];

    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}

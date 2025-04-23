import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsString, ValidateNested } from 'class-validator';
import {
    AccessGroupRights,
    AccessGroupType,
} from '../../../frontend_shared/enum';
import { IsSkip } from '../../../validation/skip-validation';
import { IsTake } from '../../../validation/take-validation';
import { Paginated } from '../pagination';

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
    @IsNumber()
    memberCount!: number;

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

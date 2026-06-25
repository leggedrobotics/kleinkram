/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Paginated } from '@api-dto/pagination';
import { AccessGroupRights, AccessGroupType } from '@kleinkram/shared';
import { IsSkip, IsTake } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsString, ValidateNested } from 'class-validator';

@Expose()
export class ProjectAccessDto {
    @ApiProperty()
    @IsString()
    @Expose()
    @Transform(({ value, obj }) => obj.accessGroup?.uuid ?? value)
    uuid!: string;

    @ApiProperty()
    @IsString()
    @Expose()
    @Transform(({ value, obj }) => obj.accessGroup?.name ?? value)
    name!: string;

    @ApiProperty({
        description: 'Type of the access group',
        format: 'AccessGroupType',
        enum: AccessGroupType,
    })
    @IsEnum(AccessGroupType)
    @Expose()
    @Transform(({ value, obj }) => obj.accessGroup?.type ?? value)
    type!: AccessGroupType;

    @ApiProperty()
    @IsNumber()
    @Expose()
    @Transform(
        ({ value, obj }) => obj.accessGroup?.memberships?.length ?? value,
    )
    memberCount!: number;

    @ApiProperty({
        description: 'Rights of the user in the access group',
        format: 'AccessGroupRights',
        enum: AccessGroupRights,
    })
    @IsEnum(AccessGroupRights)
    @Expose()
    rights!: AccessGroupRights;
}

export class ProjectAccessListDto implements Paginated<ProjectAccessDto> {
    @ApiProperty({
        type: () => [ProjectAccessDto],
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

import { AccessGroupType } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MAX_TAKE } from '../pagination';

export class GetFilteredAccessGroupsDto {
    @ApiProperty({
        description: 'Searchkey for accessgroup name',
    })
    @IsString()
    search!: string;

    @ApiProperty()
    @IsInt()
    @Min(0)
    @Max(Number.MAX_SAFE_INTEGER)
    skip!: number;

    @ApiProperty()
    @IsInt()
    @Min(0)
    @Max(MAX_TAKE)
    take!: number;

    @ApiProperty({
        description: 'Type of AccessGroup',
    })
    @IsOptional()
    @IsEnum(AccessGroupType)
    type?: AccessGroupType;
}

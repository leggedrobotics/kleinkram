import { AccessGroupType } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class GetFilteredAccessGroupsDto {
    @ApiProperty({
        description: 'Searchkey for accessgroup name',
    })
    @IsString()
    search!: string;

    @ApiProperty()
    @IsNumber()
    skip!: number;

    @ApiProperty()
    @IsNumber()
    take!: number;

    @ApiProperty({
        description: 'Type of AccessGroup',
    })
    @IsOptional()
    @IsEnum(AccessGroupType)
    type?: AccessGroupType;
}

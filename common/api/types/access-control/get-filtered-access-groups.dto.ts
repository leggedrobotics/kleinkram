import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { AccessGroupType } from '../../../frontend_shared/enum';

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

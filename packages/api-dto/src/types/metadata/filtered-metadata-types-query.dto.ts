import { DataType } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class FilteredMetadataTypesQueryDto {
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, description: 'Filter by TagType name' })
    name?: string;

    @IsOptional()
    @IsEnum(DataType)
    @ApiProperty({
        required: false,
        enum: DataType,
        description: 'Filter by TagType datatype',
    })
    type?: DataType;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Type(() => Number)
    @ApiProperty({ required: false, default: 0 })
    skip = 0;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(1000)
    @Type(() => Number)
    @ApiProperty({ required: false, default: 100 })
    take = 100;
}

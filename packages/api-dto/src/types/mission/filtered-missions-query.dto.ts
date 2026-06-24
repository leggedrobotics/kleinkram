import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    Min,
} from 'class-validator';

export class FilteredMissionsQueryDto {
    @IsUUID('4')
    @ApiProperty({ description: 'Project UUID' })
    uuid!: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, description: 'Search in mission name' })
    search?: string;

    @IsOptional()
    @IsEnum(['ASC', 'DESC'])
    @ApiProperty({ required: false, enum: ['ASC', 'DESC'], default: 'ASC' })
    sortDirection: 'ASC' | 'DESC' = 'ASC';

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, default: 'createdAt' })
    sortBy = 'createdAt';

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

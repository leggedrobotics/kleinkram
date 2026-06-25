import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsInt,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';

export class ActionTemplatesQueryDto {
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

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    search?: string;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    @ApiProperty({ required: false, default: false })
    includeArchived?: boolean;
}

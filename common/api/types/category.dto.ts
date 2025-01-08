import { ApiProperty } from '@nestjs/swagger';
import { PaggedResponse } from './pagged-response';
import { IsNumber, IsString, ValidateNested } from 'class-validator';
import { IsTake } from '../../validation/take-validation';
import { IsSkip } from '../../validation/skip-validation';
import { Type } from 'class-transformer';

export class CategoryDto {
    @ApiProperty()
    @IsString()
    uuid!: string;

    @ApiProperty()
    @IsString()
    name!: string;
}

export class CategoriesDto implements PaggedResponse<CategoryDto> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        type: [CategoryDto],
        description: 'List of categories',
    })
    @ValidateNested()
    @Type(() => CategoryDto)
    data!: CategoryDto[];

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}

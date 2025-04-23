import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString, ValidateNested } from 'class-validator';
import { IsSkip } from '../../validation/skip-validation';
import { IsTake } from '../../validation/take-validation';
import { Paginated } from './pagination';

export class CategoryDto {
    @ApiProperty()
    @IsString()
    uuid!: string;

    @ApiProperty()
    @IsString()
    name!: string;
}

export class CategoriesDto implements Paginated<CategoryDto> {
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

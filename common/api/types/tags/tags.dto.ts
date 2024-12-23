import { ApiProperty } from '@nestjs/swagger';
import { DataType } from '../../../frontend_shared/enum';
import {
    IsDate,
    IsDefined,
    IsEnum,
    IsNumber,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { PaggedResponse } from '../pagged-response';
import { IsSkip } from '../../../validation/skip-validation';
import { IsTake } from '../../../validation/take-validation';
import { Type } from 'class-transformer';

export class TagTypeDto {
    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ApiProperty({
        description: 'The data type of the tag',
        format: 'DataType',
        enum: DataType,
    })
    @IsEnum(DataType)
    datatype!: DataType;

    @ApiProperty()
    @IsString()
    description?: string;
}

export class TagDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty({
        description: 'The data type of the tag',
        format: 'DataType',
        enum: DataType,
    })
    @IsEnum(DataType)
    datatype!: DataType;

    @ApiProperty({
        description: 'The type of the tag',
        type: TagTypeDto,
    })
    @ValidateNested()
    @Type(() => TagTypeDto)
    type!: TagTypeDto;

    @ApiProperty()
    @IsDefined()
    value!: string | Date | number | boolean;

    get valueAsString(): string {
        return this.value.toString();
    }
}

export class TagsDto {
    @ApiProperty({
        description: 'List of tags',
        type: [TagDto],
    })
    @ValidateNested()
    @Type(() => TagDto)
    data!: TagDto[];

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

export class TagTypesDto implements PaggedResponse<TagTypeDto> {
    @ApiProperty({
        description: 'List of tag types',
        type: [TagTypeDto],
    })
    @ValidateNested()
    @Type(() => TagTypeDto)
    data!: TagTypeDto[];

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

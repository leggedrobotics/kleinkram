/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Paginated } from '@api-dto/pagination';
import { DataType } from '@kleinkram/shared';
import { IsSkip, IsTake } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import {
    IsDate,
    IsDefined,
    IsEnum,
    IsNumber,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';

@Expose()
export class TagTypeDto {
    @ApiProperty()
    @IsString()
    @Expose()
    name!: string;

    @ApiProperty()
    @IsUUID()
    @Expose()
    uuid!: string;

    @ApiProperty()
    @IsDate()
    @Expose()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    @Expose()
    updatedAt!: Date;

    @ApiProperty({
        description: 'The data type of the tag',
        format: 'DataType',
        enum: DataType,
    })
    @IsEnum(DataType)
    @Expose()
    datatype!: DataType;

    @ApiProperty()
    @IsString()
    @Expose()
    @Transform(({ value, obj }) => obj.description ?? value ?? '')
    description?: string;
}

@Expose()
export class TagDto {
    @ApiProperty()
    @IsUUID()
    @Expose()
    uuid!: string;

    @ApiProperty()
    @IsDate()
    @Expose()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    @Expose()
    updatedAt!: Date;

    @ApiProperty()
    @IsString()
    @Expose()
    @Transform(({ value, obj }) => obj.tagType?.name ?? value)
    name!: string;

    @ApiProperty({
        description: 'The data type of the tag',
        format: 'DataType',
        enum: DataType,
    })
    @IsEnum(DataType)
    @Expose()
    @Transform(({ value, obj }) => obj.tagType?.datatype ?? value)
    datatype!: DataType;

    @ApiProperty({
        description: 'The type of the tag',
        type: () => TagTypeDto,
    })
    @ValidateNested()
    @Type(() => TagTypeDto)
    @Expose()
    @Transform(({ value, obj }) => obj.tagType ?? value)
    type!: TagTypeDto;

    @ApiProperty()
    @IsDefined()
    @Expose()
    @Transform(({ value, obj }) => {
        return (
            obj.value_string ??
            obj.value_number ??
            obj.value_boolean ??
            obj.value_date ??
            obj.value_location ??
            value
        );
    })
    value!: string | Date | number | boolean;

    get valueAsString(): string {
        return this.value.toString();
    }
}

export class TagsDto {
    @ApiProperty({
        description: 'List of tags',
        type: () => [TagDto],
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

export class TagTypesDto implements Paginated<TagTypeDto> {
    @ApiProperty({
        description: 'List of tag types',
        type: () => [TagTypeDto],
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

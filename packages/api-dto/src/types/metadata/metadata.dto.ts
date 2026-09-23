/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Paginated } from '@api-dto/pagination';
import { DataType } from '@kleinkram/shared';
import { IsSkip, IsTake } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type, plainToInstance } from 'class-transformer';
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
export class MetadataTypeDto {
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
        description: 'The data type of values of this metadata type',
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
export class MetadataDto {
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
    @Transform(({ value, obj }) => obj.metadataType?.name ?? value)
    name!: string;

    @ApiProperty({
        description: 'The data type of the value',
        format: 'DataType',
        enum: DataType,
    })
    @IsEnum(DataType)
    @Expose()
    @Transform(({ value, obj }) => obj.metadataType?.datatype ?? value)
    datatype!: DataType;

    @ApiProperty({
        description: 'The metadata type of the value',
        type: () => MetadataTypeDto,
    })
    @ValidateNested()
    @Type(() => MetadataTypeDto)
    @Expose()
    @Transform(({ value, obj }) => {
        const t = (obj.metadataType ?? value) as object | undefined;
        return t
            ? plainToInstance(MetadataTypeDto, t, {
                  excludeExtraneousValues: true,
              })
            : undefined;
    })
    type!: MetadataTypeDto;

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

export class MetadataListDto {
    @ApiProperty({
        description: 'List of metadata values',
        type: () => [MetadataDto],
    })
    @ValidateNested()
    @Type(() => MetadataDto)
    data!: MetadataDto[];

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

export class MetadataTypesDto implements Paginated<MetadataTypeDto> {
    @ApiProperty({
        description: 'List of metadata types',
        type: () => [MetadataTypeDto],
    })
    @ValidateNested()
    @Type(() => MetadataTypeDto)
    data!: MetadataTypeDto[];

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

import { DataType } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

/**
 * Types a metadata value can have. `ANY` is only used by the UI as "no type
 * selected yet": a metadata type of type `ANY` couldn't hold any value.
 */
const VALUE_DATA_TYPES = Object.values(DataType).filter(
    (type) => type !== DataType.ANY,
);

export class CreateMetadataTypeDto {
    @ApiProperty({ description: 'Metadata type name' })
    @IsString()
    name!: string;

    @ApiProperty({
        description: 'Data type of the values',
        enum: VALUE_DATA_TYPES,
    })
    @IsIn(VALUE_DATA_TYPES, {
        message: `type must be one of ${VALUE_DATA_TYPES.join(', ')}`,
    })
    type!: DataType;
}

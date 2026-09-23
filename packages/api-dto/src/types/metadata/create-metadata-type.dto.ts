import { DataType } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

export class CreateMetadataTypeDto {
    @ApiProperty({ description: 'Metadata type name' })
    @IsString()
    name!: string;

    @ApiProperty({
        description: 'Data type of the values',
    })
    @IsEnum(DataType)
    type!: DataType;
}

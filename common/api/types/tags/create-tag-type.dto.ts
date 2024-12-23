import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { DataType } from '../../../frontend_shared/enum';

export class CreateTagTypeDto {
    @ApiProperty({ description: 'Tag name' })
    @IsString()
    name!: string;

    @ApiProperty({
        description: 'Tag type',
    })
    @IsEnum(DataType)
    type!: DataType;
}

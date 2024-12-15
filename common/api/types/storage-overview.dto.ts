import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

type Bytes = number;
type Inodes = number;

export class StorageOverviewDto {
    @ApiProperty()
    @IsNumber()
    usedBytes!: Bytes;

    @ApiProperty()
    @IsNumber()
    totalBytes!: Bytes;

    @ApiProperty()
    @IsNumber()
    usedInodes!: Inodes;

    @ApiProperty()
    @IsNumber()
    totalInodes!: Inodes;
}

import { ApiProperty } from '@nestjs/swagger';

type Bytes = number;
type Inodes = number;

export class StorageOverviewDto {
    @ApiProperty()
    usedBytes!: Bytes;

    @ApiProperty()
    totalBytes!: Bytes;

    @ApiProperty()
    usedInodes!: Inodes;

    @ApiProperty()
    totalInodes!: Inodes;
}

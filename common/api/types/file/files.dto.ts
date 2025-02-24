import { ApiProperty } from '@nestjs/swagger';
import { FileDto } from './file.dto';
import { Paginated } from '../pagination';
import { IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsTake } from '../../../validation/take-validation';
import { IsSkip } from '../../../validation/skip-validation';

export class FilesDto implements Paginated<FileDto> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        type: [FileDto],
        description: 'List of files',
    })
    @ValidateNested()
    @Type(() => FileDto)
    data!: FileDto[];

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}

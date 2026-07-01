import { FileSource } from '@kleinkram/shared';
import { IsNoValidUUID, IsValidFileName } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export class TemporaryAccessRequestDto {
    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    @IsNoValidUUID({ each: true })
    @IsValidFileName({ each: true })
    @ApiProperty({
        description: 'Filenames for which to generate temporary access',
    })
    filenames!: string[];

    @IsUUID()
    @ApiProperty({
        description:
            'UUID of the mission for which to generate temporary access',
    })
    missionUUID!: string;

    @IsEnum(FileSource)
    @IsOptional()
    @ApiProperty({
        description: 'Source of the upload (CLI, Web Interface, etc.)',
        required: false,
        enum: FileSource,
    })
    source?: FileSource;

    @IsNumber({}, { each: true })
    @IsArray()
    @IsOptional()
    @ApiProperty({
        description:
            'Sizes of the files in bytes matching the order of filenames',
        required: false,
        type: [Number],
    })
    fileSizes?: number[];
}

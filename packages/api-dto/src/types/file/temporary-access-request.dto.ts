import { FileSource, MAX_FILES_PER_UPLOAD_REQUEST } from '@kleinkram/shared';
import { IsNoValidUUID, IsValidFileName } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    IsArray,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    Min,
} from 'class-validator';

export class TemporaryAccessRequestDto {
    @IsArray()
    @ArrayMaxSize(MAX_FILES_PER_UPLOAD_REQUEST)
    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    @IsNoValidUUID({ each: true })
    @IsValidFileName({ each: true })
    @ApiProperty({
        description: 'Filenames for which to generate temporary access',
        maxItems: MAX_FILES_PER_UPLOAD_REQUEST,
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

    @IsInt({ each: true })
    @Min(0, { each: true })
    @IsArray()
    @ArrayMaxSize(MAX_FILES_PER_UPLOAD_REQUEST)
    @IsOptional()
    @ApiProperty({
        description:
            'Sizes of the files in bytes matching the order of filenames',
        required: false,
        type: [Number],
        maxItems: MAX_FILES_PER_UPLOAD_REQUEST,
    })
    fileSizes?: number[];
}

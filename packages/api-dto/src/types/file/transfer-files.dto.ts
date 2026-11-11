import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayNotEmpty,
    IsArray,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

/**
 * Request body of `PATCH /files` (move) and `POST /files/copy` (copy).
 */
export class TransferFilesDto {
    @ApiProperty({
        description: 'UUIDs of the files to move or copy',
        type: [String],
    })
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('all', { each: true })
    fileUUIDs!: string[];

    @ApiProperty({ description: 'UUID of the target mission' })
    @IsUUID()
    missionUUID!: string;

    @ApiPropertyOptional({
        description:
            'New filenames in the target mission, keyed by file UUID. ' +
            'Use it to resolve name conflicts. The extension must not change.',
        type: 'object',
        additionalProperties: { type: 'string' },
    })
    @IsOptional()
    @IsObject()
    renames?: Record<string, string>;
}

export class CopyFilesResponseDto {
    @ApiProperty({
        description: 'UUIDs of the new files, in the order of the request',
        type: [String],
    })
    @IsArray()
    @IsUUID('all', { each: true })
    fileUUIDs!: string[];
}

/**
 * Request body of `POST /files/existingNames`.
 */
export class ExistingFilenamesDto {
    @ApiProperty({ description: 'UUID of the mission to check' })
    @IsUUID()
    missionUUID!: string;

    @ApiProperty({ description: 'Filenames to look up', type: [String] })
    @IsArray()
    @IsString({ each: true })
    filenames!: string[];
}

export class ExistingFilenamesResponseDto {
    @ApiProperty({
        description: 'The requested filenames that exist in the mission',
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    filenames!: string[];
}

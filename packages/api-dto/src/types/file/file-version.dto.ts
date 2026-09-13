import { FileOrigin, FileState, FileType } from '@kleinkram/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
    IsDate,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
} from 'class-validator';

@Expose()
export class FileVersionDto {
    @ApiProperty()
    @IsString()
    @Expose()
    uuid!: string;

    @ApiProperty()
    @IsString()
    @Expose()
    fileUuid!: string;

    @ApiProperty()
    @IsNumber()
    @Expose()
    versionNumber!: number;

    @ApiProperty()
    @IsNumber()
    @Expose()
    size!: number;

    @ApiProperty({
        format: 'FileType',
        enum: FileType,
    })
    @IsEnum(FileType)
    @Expose()
    type!: FileType;

    @ApiProperty({
        format: 'FileState',
        enum: FileState,
    })
    @IsEnum(FileState)
    @Expose()
    state!: FileState;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    @Expose()
    hash?: string | null;

    @ApiPropertyOptional({
        format: 'FileOrigin',
        enum: FileOrigin,
    })
    @IsEnum(FileOrigin)
    @IsOptional()
    @Expose()
    origin?: FileOrigin | null;

    @ApiProperty()
    @IsDate()
    @Expose()
    date!: Date;

    @ApiPropertyOptional()
    @IsDate()
    @IsOptional()
    @Expose()
    recordingStartDate?: Date | null;

    @ApiPropertyOptional()
    @IsDate()
    @IsOptional()
    @Expose()
    recordingEndDate?: Date | null;

    @ApiProperty()
    @IsDate()
    @Expose()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    @Expose()
    updatedAt!: Date;
}

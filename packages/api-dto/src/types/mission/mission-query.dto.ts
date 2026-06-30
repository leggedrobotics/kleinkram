import { ProjectQueryDto } from '@api-dto/project/project-query.dto';
import { IsRecordStringString } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    ArrayNotEmpty,
    IsArray,
    IsBoolean,
    IsEnum,
    IsNotEmptyObject,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export class MissionQueryDto extends ProjectQueryDto {
    @IsOptional()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('4', { each: true })
    @ApiProperty({ required: false })
    missionUuids?: string[];

    @IsOptional()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @ApiProperty({ required: false })
    missionPatterns?: string[];

    @IsOptional()
    @IsNotEmptyObject()
    @IsRecordStringString()
    @ApiProperty({ required: false })
    metadata?: Record<string, string>;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    @ApiProperty({
        required: false,
        description: 'Return minimal mission info',
    })
    minimal?: boolean;

    @IsOptional()
    @IsUUID('4')
    @ApiProperty({ required: false, description: 'Project UUID to filter by' })
    projectUuid?: string;

    @IsOptional()
    @IsUUID('4')
    @ApiProperty({
        required: false,
        description: 'Backwards-compatible Project UUID',
    })
    uuid?: string;

    @IsOptional()
    @IsEnum(['ASC', 'DESC'])
    @ApiProperty({ required: false, enum: ['ASC', 'DESC'] })
    sortDirection?: 'ASC' | 'DESC';
}

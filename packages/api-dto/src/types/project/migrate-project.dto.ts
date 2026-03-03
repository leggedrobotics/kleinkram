import { IsNoValidUUID, IsValidName } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsInt,
    IsOptional,
    IsUUID,
    Min,
} from 'class-validator';

export class MigrateProjectDto {
    @ApiProperty()
    @IsUUID('4')
    sourceProjectUUID!: string;

    @ApiProperty()
    @IsUUID('4')
    targetProjectUUID!: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsValidName()
    @IsNoValidUUID()
    archiveSourceProjectAs?: string;
}

export class MigrateProjectResponseDto {
    @ApiProperty()
    @IsBoolean()
    success!: boolean;

    @ApiProperty()
    @IsUUID('4')
    sourceProjectUUID!: string;

    @ApiProperty()
    @IsUUID('4')
    targetProjectUUID!: string;

    @ApiProperty()
    @IsInt()
    @Min(0)
    movedMissionCount!: number;

    @ApiProperty()
    @IsInt()
    @Min(0)
    movedFileCount!: number;

    @ApiProperty({ type: [String] })
    @IsArray()
    @IsUUID('4', { each: true })
    movedMissionUUIDs!: string[];
}

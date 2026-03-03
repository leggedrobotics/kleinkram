import { IsNoValidUUID, IsValidMissionName } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import {
    ArrayNotEmpty,
    IsArray,
    IsBoolean,
    IsInt,
    IsOptional,
    IsUUID,
} from 'class-validator';

export class MoveMissionsDto {
    @ApiProperty({ type: [String] })
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('4', { each: true })
    missionUUIDs!: string[];

    @ApiProperty()
    @IsUUID('4')
    targetProjectUUID!: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsValidMissionName()
    @IsNoValidUUID()
    newName?: string;
}

export class MoveMissionsResponseDto {
    @ApiProperty()
    @IsBoolean()
    success!: boolean;

    @ApiProperty()
    @IsInt()
    movedMissionCount!: number;

    @ApiProperty()
    @IsUUID('4')
    targetProjectUUID!: string;
}

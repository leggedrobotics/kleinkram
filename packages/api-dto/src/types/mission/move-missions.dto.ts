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
    @ApiProperty({
        type: [String],
        description:
            'Explicit mission UUIDs to move. This endpoint does not migrate all missions of a project.',
    })
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('4', { each: true })
    missionUUIDs!: string[];

    @ApiProperty({
        description: 'Target project UUID for the selected missions.',
    })
    @IsUUID('4')
    targetProjectUUID!: string;

    @ApiProperty({
        required: false,
        description:
            'Optional new name, allowed only when moving exactly one mission.',
    })
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

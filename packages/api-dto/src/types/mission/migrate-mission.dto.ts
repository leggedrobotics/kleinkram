import { IsNoValidUUID, IsValidMissionName } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class MigrateMissionDto {
    @ApiProperty()
    @IsUUID('4')
    missionUUID!: string;

    @ApiProperty()
    @IsUUID('4')
    targetProjectUUID!: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsValidMissionName()
    @IsNoValidUUID()
    newName?: string;
}

export class MigrateMissionResponseDto {
    @ApiProperty()
    @IsBoolean()
    success!: boolean;

    @ApiProperty()
    @IsUUID('4')
    missionUUID!: string;

    @ApiProperty()
    @IsUUID('4')
    targetProjectUUID!: string;
}

import { ActionState } from '@common/frontend_shared/enum';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { IsSkip } from '../../validation/skip-validation';

export class SubmitActionMulti {
    @IsString({ each: true })
    missionUUIDs!: string[];

    @IsUUID()
    templateUUID!: string;
}

export class ActionQuery {
    @ApiProperty()
    @IsOptional()
    @IsUUID()
    missionUuid?: string;

    @ApiProperty()
    @IsOptional()
    @IsUUID()
    projectUuid!: string;

    @ApiProperty()
    @IsOptional()
    @IsSkip()
    skip?: number;

    @ApiProperty()
    @IsOptional()
    @IsSkip()
    take?: number;

    @ApiProperty()
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiProperty()
    @IsOptional()
    @IsString()
    sortDirection?: string;

    @ApiProperty()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiProperty()
    @IsOptional()
    @IsBoolean()
    exactMatch?: boolean;

    @ApiProperty()
    @IsOptional()
    @IsString({ each: true })
    states?: ActionState[];
}

export class ActionDetailsQuery {
    @IsUUID()
    action_uuid!: string;
}

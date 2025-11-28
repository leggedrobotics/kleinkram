import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { ActionState } from '../../frontend_shared/enum';
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
    missionUuid?: string | undefined;

    @ApiProperty()
    @IsOptional()
    @IsUUID()
    projectUuid?: string | undefined;

    @ApiProperty()
    @IsOptional()
    @IsSkip()
    @Type(() => Number)
    skip?: number | undefined;

    @ApiProperty()
    @IsOptional()
    @IsSkip()
    @Type(() => Number)
    take?: number | undefined;

    @ApiProperty()
    @IsOptional()
    @IsString()
    sortBy?: string | undefined;

    @ApiProperty()
    @IsOptional()
    @IsString()
    sortDirection?: string | undefined;

    @ApiProperty()
    @IsOptional()
    @IsString()
    search?: string | undefined;

    @ApiProperty()
    @IsOptional()
    @IsBoolean()
    exactMatch?: boolean | undefined;

    @ApiProperty()
    @IsOptional()
    @IsString({ each: true })
    states?: ActionState[] | undefined;
}

export class ActionDetailsQuery {
    @IsUUID()
    action_uuid!: string;
}

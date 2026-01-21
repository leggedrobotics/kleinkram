import { TriggerType } from '@kleinkram/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEnum,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';
import type { TriggerConfig } from './action-trigger.dto';

export class UpdateActionTriggerDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    templateUuid?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    missionUuid?: string;

    @ApiPropertyOptional({ enum: TriggerType })
    @IsOptional()
    @IsEnum(TriggerType)
    type?: TriggerType;

    @ApiPropertyOptional()
    @IsOptional()
    @IsObject()
    config?: TriggerConfig;
}

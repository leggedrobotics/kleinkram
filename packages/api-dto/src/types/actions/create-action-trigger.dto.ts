import { TriggerType } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsEnum,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';
import type { TriggerConfig } from './action-trigger.dto';

export class CreateActionTriggerDto {
    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsString()
    description!: string;

    @ApiProperty()
    @IsUUID()
    templateUuid!: string;

    @ApiProperty()
    @IsUUID()
    missionUuid!: string;

    @ApiProperty({ enum: TriggerType })
    @IsEnum(TriggerType)
    type!: TriggerType;

    @ApiProperty()
    @IsObject()
    config!: TriggerConfig;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    uuid?: string;
}

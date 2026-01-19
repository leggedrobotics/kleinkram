import { TriggerType } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsEnum,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export type WebhookConfig = Record<string, unknown>;

export interface TimeConfig {
    cron: string;
}

export interface FileConfig {
    patterns: string[];
}

export type TriggerConfig = WebhookConfig | TimeConfig | FileConfig;

export class ActionTriggerDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsString()
    description!: string;

    @ApiProperty()
    @IsUUID()
    templateUuid!: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    templateName?: string | null;

    @ApiProperty()
    @IsUUID()
    missionUuid!: string;

    @ApiProperty({ enum: TriggerType })
    @IsEnum(TriggerType)
    type!: TriggerType;

    @ApiProperty()
    @IsObject()
    config!: TriggerConfig;
}

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDate,
    IsEnum,
    IsNumber,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { ActionState, ArtifactState } from '../../../frontend_shared/enum';
import { ActionWorkerDto } from '../action-workers.dto';
import { MissionDto } from '../mission/mission.dto';
import { UserDto } from '../user.dto';
import { AuditLogDto } from './audit-log.dto';
import { DockerImageDto } from './docker-image.dto';
import { LogsDto } from './logs.dto';

import { IsSkip } from '../../../validation/skip-validation';
import { IsTake } from '../../../validation/take-validation';
import { Paginated } from '../pagination';
import { ActionTemplateDto } from './action-template.dto';

export class ActionDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsEnum(ActionState)
    state!: ActionState;

    @ApiProperty()
    @IsEnum(ArtifactState)
    artifacts!: ArtifactState;

    @ApiProperty()
    @ValidateNested()
    @Type(() => ActionTemplateDto)
    template!: ActionTemplateDto;

    @ApiProperty()
    @IsString()
    stateCause!: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ApiProperty()
    @ValidateNested({ each: true })
    @Type(() => AuditLogDto)
    auditLogs!: AuditLogDto[];

    @ApiProperty()
    @ValidateNested({ each: true })
    @Type(() => LogsDto)
    logs?: LogsDto[];

    @ApiProperty()
    @IsString()
    artifactUrl!: string;

    @ApiProperty()
    @ValidateNested()
    @Type(() => MissionDto)
    mission!: MissionDto;

    @ApiProperty()
    @ValidateNested()
    @Type(() => DockerImageDto)
    image!: DockerImageDto;

    @ApiProperty()
    @ValidateNested()
    @Type(() => UserDto)
    creator!: UserDto;

    @ApiProperty()
    @ValidateNested()
    @Type(() => ActionWorkerDto)
    worker!: ActionWorkerDto;
}

export class ActionsDto implements Paginated<ActionDto> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        type: () => [ActionDto],
        description: 'List of actions',
    })
    @ValidateNested({ each: true })
    @Type(() => ActionDto)
    data!: ActionDto[];

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}

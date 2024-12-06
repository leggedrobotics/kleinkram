import { ApiProperty } from '@nestjs/swagger';
import {
    IsDate,
    IsEnum,
    IsNumber,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { ActionState, ArtifactState } from '../../../frontend_shared/enum';
import { Type } from 'class-transformer';
import { AuditLogDto } from './audit-log.dto';
import { LogsDto } from './logs.dto';
import { FlatMissionDto } from '../mission.dto';
import { DockerImageDto } from './docker-image.dto';
import { UserDto } from '../user.dto';
import { ActionWorkerDto } from '../action-workers.dto';

import { ActionTemplateDto } from './action-template.dto';
import { PaggedResponse } from '../pagged-response';
import { IsSkip } from '../../../validation/skip-validation';
import { IsTake } from '../../../validation/take-validation';

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
    logs!: LogsDto[];

    @ApiProperty()
    @IsString()
    artifactUrl!: string;

    @ApiProperty()
    @ValidateNested()
    @Type(() => FlatMissionDto)
    mission!: FlatMissionDto;

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

    get runtimeInMS(): number {
        return this.updatedAt.getTime() - this.createdAt.getTime();
    }
}

export class ActionsDto implements PaggedResponse<ActionDto> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        type: [ActionDto],
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

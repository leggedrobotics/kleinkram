import { ApiProperty } from '@nestjs/swagger';
import {
    AccessGroupRights,
    ActionState,
    ArtifactState,
} from '../../frontend_shared/enum';
import { FlatMissionDto } from './Mission.dto';
import { UserDto } from './User.dto';
import { ActionWorkerDto } from './ActionWorkersDto';
import {
    IsDate,
    IsEnum,
    IsNumber,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaggedResponse } from './pagged-response';
import { IsSkip } from '../../validation/skip-validation';
import { IsTake } from '../../validation/take-validation';

export class AuditLogDto {
    @ApiProperty()
    @IsString()
    url!: string;

    @ApiProperty()
    @IsString()
    method!: string;

    @ApiProperty()
    @IsString()
    message!: string;
}

export class LogsDto {
    @ApiProperty()
    @IsDate()
    timestamp!: Date;

    @ApiProperty()
    @IsString()
    message!: string;

    @ApiProperty()
    @IsEnum(['stdout', 'stderr'])
    type!: 'stdout' | 'stderr';
}

export class DockerImageDto {
    @ApiProperty()
    @ValidateNested()
    @Type(() => String)
    repoDigests!: string[];
}

export class ActionTemplateDto {
    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsString()
    imageName!: string;

    @ApiProperty()
    @IsString()
    command!: string;

    @ApiProperty()
    @IsString()
    entrypoint!: string;

    @ApiProperty()
    @IsEnum(AccessGroupRights)
    accessRights!: AccessGroupRights;

    @ApiProperty()
    @IsNumber()
    gpuMemory!: number;

    @ApiProperty()
    @IsNumber()
    cpuMemory!: number;

    @ApiProperty()
    @IsNumber()
    cpuCores!: number;

    @ApiProperty()
    @IsString()
    version!: string;

    @ApiProperty()
    @IsNumber()
    maxRuntime!: number;
}

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

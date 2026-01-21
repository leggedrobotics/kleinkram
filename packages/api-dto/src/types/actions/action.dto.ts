import { ActionWorkerDto } from '@api-dto/action-workers.dto';
import { ActionTemplateDto } from '@api-dto/actions/action-template.dto';
import { AuditLogDto } from '@api-dto/actions/audit-log.dto';
import { DockerImageDto } from '@api-dto/actions/docker-image.dto';
import { MissionDto } from '@api-dto/mission/mission.dto';
import { UserDto } from '@api-dto/user/user.dto';
import {
    ActionErrorHint,
    ActionState,
    ActionTriggerSource,
    ArtifactState,
} from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDate,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';

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

    @ApiProperty({ required: false })
    @IsOptional()
    runtime?: number;

    @ApiProperty()
    @ValidateNested({ each: true })
    @Type(() => AuditLogDto)
    auditLogs!: AuditLogDto[];

    @ApiProperty()
    @IsString()
    artifactUrl!: string;

    @ApiProperty({ required: false })
    @IsOptional()
    artifactSize?: number | undefined;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString({ each: true })
    artifactFiles?: string[] | undefined;

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
    @IsOptional()
    @ValidateNested()
    @Type(() => ActionWorkerDto)
    worker!: ActionWorkerDto | null;

    @ApiProperty()
    @IsEnum(ActionTriggerSource)
    triggerSource!: ActionTriggerSource;

    @ApiProperty({ required: false })
    @IsOptional()
    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    triggerUuid?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsEnum(ActionErrorHint)
    errorHint?: ActionErrorHint;

    @ApiProperty({ required: false })
    @IsOptional()
    exitCode?: number;
}

import { ActionWorkerDto } from '@common/api/types/action-workers.dto';
import { ActionTemplateDto } from '@common/api/types/actions/action-template.dto';
import { AuditLogDto } from '@common/api/types/actions/audit-log.dto';
import { DockerImageDto } from '@common/api/types/actions/docker-image.dto';
import { LogsDto } from '@common/api/types/actions/logs.dto';
import { MissionDto } from '@common/api/types/mission/mission.dto';
import { UserDto } from '@common/api/types/user/user.dto';
import { ActionState, ArtifactState } from '@common/frontend_shared/enum';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDate,
    IsEnum,
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

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDate,
    IsEnum,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { ActionWorkerDto } from '../../../api/types/action-workers.dto';
import { ActionTemplateDto } from '../../../api/types/actions/action-template.dto';
import { AuditLogDto } from '../../../api/types/actions/audit-log.dto';
import { DockerImageDto } from '../../../api/types/actions/docker-image.dto';
import { MissionDto } from '../../../api/types/mission/mission.dto';
import { UserDto } from '../../../api/types/user/user.dto';
import { ActionState, ArtifactState } from '../../../frontend_shared/enum';

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

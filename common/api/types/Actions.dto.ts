import { ApiProperty } from '@nestjs/swagger';
import {
    AccessGroupRights,
    ActionState,
    ArtifactState,
} from '../../frontend_shared/enum';
import { FlatMissionDto } from './Mission.dto';
import { UserDto } from './User.dto';
import { WorkerDto } from './Workers.dto';

export class AuditLogDto {
    @ApiProperty()
    url!: string;

    @ApiProperty()
    method!: string;

    @ApiProperty()
    message!: string;
}

export class LogsDto {
    @ApiProperty()
    timestamp!: Date;

    @ApiProperty()
    message!: string;

    @ApiProperty()
    type!: 'stdout' | 'stderr';
}

export class DockerImageDto {
    @ApiProperty()
    repoDigests!: string[];
}

export class ActionTemplateDto {
    @ApiProperty()
    name!: string;

    @ApiProperty()
    imageName!: string;

    @ApiProperty()
    command!: string;

    @ApiProperty()
    entrypoint!: string;

    @ApiProperty()
    accessRights!: AccessGroupRights;

    @ApiProperty()
    gpuMemory!: number;

    @ApiProperty()
    cpuMemory!: number;

    @ApiProperty()
    cpuCores!: number;

    @ApiProperty()
    version!: string;

    @ApiProperty()
    maxRuntime!: number;
}

export class ActionDto {
    @ApiProperty()
    uuid!: string;

    @ApiProperty()
    state!: ActionState;

    @ApiProperty()
    artifacts!: ArtifactState;

    @ApiProperty()
    template!: ActionTemplateDto;

    @ApiProperty()
    stateCause!: string;

    @ApiProperty()
    createdAt!: Date;

    @ApiProperty()
    updatedAt!: Date;

    @ApiProperty()
    auditLogs!: AuditLogDto[];

    @ApiProperty()
    logs!: LogsDto[];

    @ApiProperty()
    artifactUrl!: string;

    @ApiProperty()
    mission!: FlatMissionDto;

    @ApiProperty()
    image!: DockerImageDto;

    @ApiProperty()
    creator!: UserDto;

    @ApiProperty()
    worker!: WorkerDto;

    get runtimeInMS(): number {
        return this.updatedAt.getTime() - this.createdAt.getTime();
    }
}

export class ActionsDto {
    @ApiProperty()
    count!: number;

    @ApiProperty({
        type: [ActionDto],
        description: 'List of actions',
    })
    actions!: ActionDto[];
}

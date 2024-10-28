import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SubmitAction {
    @IsUUID()
    missionUUID: string;

    @IsUUID()
    templateUUID: string;
}

export class SubmitActionMulti {
    @IsString({ each: true })
    missionUUIDs: string[];

    @IsUUID()
    templateUUID: string;
}

export class CreateActionTemplate {
    @IsString()
    name: string;

    @IsString()
    command: string;

    @IsString()
    // eslint-disable-next-line @typescript-eslint/naming-convention
    docker_image: string;

    @IsString()
    // eslint-disable-next-line @typescript-eslint/naming-convention
    gpu_model: string;
}

export class ActionQuery {
    @IsUUID()
    @IsOptional()
    // eslint-disable-next-line @typescript-eslint/naming-convention
    mission_uuid: string;

    @IsOptional()
    @IsUUID()
    // eslint-disable-next-line @typescript-eslint/naming-convention
    project_uuid: string;
}

export class ActionDetailsQuery {
    @IsUUID()
    // eslint-disable-next-line @typescript-eslint/naming-convention
    action_uuid: string;
}

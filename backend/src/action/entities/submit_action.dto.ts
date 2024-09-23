import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

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
    docker_image: string;

    @IsString()
    gpu_model: string;
}

export class ActionQuery {
    @IsUUID()
    @IsOptional()
    mission_uuid: string;

    @IsOptional()
    @IsUUID()
    project_uuid: string;
}

export class ActionDetailsQuery {
    @IsUUID()
    action_uuid: string;
}

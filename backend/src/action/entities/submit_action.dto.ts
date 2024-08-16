import { IsString, IsUUID } from 'class-validator';

export class SubmitAction {
    @IsUUID()
    missionUUID: string;

    @IsString()
    docker_image: string;

    @IsString()
    action_name: string;

    @IsString()
    gpu_model: string;
}

export class ActionQuery {
    @IsUUID()
    mission_uuid: string;
}

export class ActionDetailsQuery {
    @IsUUID()
    action_uuid: string;
}

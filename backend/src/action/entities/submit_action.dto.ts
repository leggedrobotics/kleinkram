import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SubmitActionMulti {
    @IsString({ each: true })
    missionUUIDs: string[];

    @IsUUID()
    templateUUID: string;
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

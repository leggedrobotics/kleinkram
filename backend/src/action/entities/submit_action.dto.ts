export class SubmitAction {
    missionUUID: string;
    docker_image: string;
}

export class ActionQuery {
    projectUUID: string;
    mission_uuids: string;
}

export class ActionDetailsQuery {
    action_uuid: string;
}

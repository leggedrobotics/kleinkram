export class SubmitAction {
    missionUUID: string;
    docker_image: string;
}

export class ActionQuery {
    mission_uuids: string;
}

export class ActionDetailsQuery {
    action_uuid: string;
}

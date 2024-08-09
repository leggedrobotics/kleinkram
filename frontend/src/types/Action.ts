import { ActionState } from 'src/enums/QUEUE_ENUM';
import { BaseEntity } from 'src/types/BaseEntity';
import { Mission } from 'src/types/Mission';
import { User } from 'src/types/User';

type ContainerLog = {
    timestamp: string;
    message: string;
    type: 'stdout' | 'stderr';
};

export class Action extends BaseEntity {
    state: ActionState;
    state_cause: string;
    docker_image: string;
    docker_image_sha: string;
    createdBy: User;

    mission: Mission | null;
    logs: ContainerLog[] | null;

    constructor(
        uuid: string,
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
        state: ActionState,
        state_cause: string,
        docker_image: string,
        docker_image_sha: string,
        mission: Mission | null,
        createdBy: User,
        logs: ContainerLog[] | null = null,
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);

        this.state = state;
        this.state_cause = state_cause || '';
        this.docker_image = docker_image;
        this.mission = mission;
        this.logs = logs;
        this.docker_image_sha = docker_image_sha || '';
        this.createdBy = createdBy;
    }
}

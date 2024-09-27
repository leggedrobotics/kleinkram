import { ActionState } from 'src/enums/QUEUE_ENUM';
import { BaseEntity } from 'src/types/BaseEntity';
import { Mission } from 'src/types/Mission';
import { User } from 'src/types/User';
import { ActionTemplate } from 'src/types/ActionTemplate';
import { ArtifactState } from 'src/enums/ARTIFACT_STATE';

type ContainerLog = {
    timestamp: string;
    message: string;
    type: 'stdout' | 'stderr';
};

export type Image = {
    sha: string | null;
    repo_digests: string[] | null;
};

export class Action extends BaseEntity {
    state: ActionState;
    state_cause: string;
    image: Image;
    createdBy: User;

    mission: Mission | null;
    logs: ContainerLog[] | null;

    worker: Worker | null;

    executionStartedAt: Date | null;
    executionEndedAt: Date | null;

    template: ActionTemplate;
    artifactUrl: string;
    artifacts: ArtifactState;

    constructor(
        uuid: string,
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
        state: ActionState,
        state_cause: string,
        artifactUrl: string,
        artifacts: ArtifactState,
        mission: Mission | null,
        template: ActionTemplate,
        image: Image,
        createdBy: User,
        logs: ContainerLog[] | null = null,
        worker: Worker | null = null,
        executionStartedAt: string | null = null,
        executionEndedAt: string | null = null,
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);
        this.image = image;
        this.state = state;
        this.state_cause = state_cause || '';
        this.artifactUrl = artifactUrl;
        this.artifacts = artifacts;
        this.mission = mission;
        this.logs = logs;
        this.createdBy = createdBy;
        this.worker = worker;
        this.template = template;
        this.executionStartedAt = executionStartedAt
            ? new Date(executionStartedAt)
            : null;
        this.executionEndedAt = executionEndedAt
            ? new Date(executionEndedAt)
            : null;
    }

    public getRuntimeInMS(): number {
        if (!this.executionStartedAt || !this.executionEndedAt) {
            return 0;
        }

        return (
            this.executionEndedAt.getTime() - this.executionStartedAt.getTime()
        );
    }
}

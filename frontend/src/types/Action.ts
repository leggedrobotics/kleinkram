import { ActionState } from 'src/enums/QUEUE_ENUM';
import { BaseEntity } from 'src/types/BaseEntity';
import { Mission } from 'src/types/Mission';
import { User } from 'src/types/User';
import { ActionTemplate } from 'src/types/ActionTemplate';

type ContainerLog = {
    timestamp: string;
    message: string;
    type: 'stdout' | 'stderr';
};

export class Action extends BaseEntity {
    state: ActionState;
    state_cause: string;

    createdBy: User;

    mission: Mission | null;
    logs: ContainerLog[] | null;

    runner_hostname: string | null;
    runner_cpu_model: string | null;

    executionStartedAt: Date | null;
    executionEndedAt: Date | null;

    template: ActionTemplate;
    artifactUrl: string;

    constructor(
        uuid: string,
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
        state: ActionState,
        state_cause: string,
        artifactUrl: string,
        mission: Mission | null,
        template: ActionTemplate,
        createdBy: User,
        logs: ContainerLog[] | null = null,
        runner_hostname: string | null = null,
        runner_cpu_model: string | null = null,
        executionStartedAt: string | null = null,
        executionEndedAt: string | null = null,
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);

        this.state = state;
        this.state_cause = state_cause || '';
        this.artifactUrl = artifactUrl;
        this.mission = mission;
        this.logs = logs;
        this.createdBy = createdBy;
        this.runner_hostname = runner_hostname;
        this.runner_cpu_model = runner_cpu_model;
        this.template = template;
        this.executionStartedAt = executionStartedAt
            ? new Date(executionStartedAt)
            : null;
        this.executionEndedAt = executionEndedAt
            ? new Date(executionEndedAt)
            : null;
    }

    public getRuntimeInMS(): number {
        console.log('getRuntime');
        console.log(this.executionStartedAt);
        console.log(this.executionEndedAt);

        if (!this.executionStartedAt || !this.executionEndedAt) {
            return 0;
        }

        return (
            this.executionEndedAt.getTime() - this.executionStartedAt.getTime()
        );
    }
}

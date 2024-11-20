import { BaseEntity } from 'src/types/BaseEntity';
import { Mission } from 'src/types/Mission';
import { User } from 'src/types/User';
import { ActionTemplate } from 'src/types/ActionTemplate';
import { Worker } from 'src/types/Worker';
import { ActionState, ArtifactState } from '@common/enum';

type ContainerLog = {
    timestamp: string;
    message: string;
    type: 'stdout' | 'stderr';
};

export type Image = {
    sha: string | null;
    repoDigests: string[] | null;
};

export class Action extends BaseEntity {
    state: ActionState;
    stateCause: string;
    image: Image;
    createdBy: User | null;

    mission: Mission | null;
    logs: ContainerLog[] | null;
    auditLogs:
        | {
              method: string;
              url: string;
          }[]
        | null;

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
        state: ActionState,
        stateCause: string,
        artifactUrl: string,
        artifacts: ArtifactState,
        mission: Mission | null,
        template: ActionTemplate,
        image: Image,
        createdBy: User | null,
        logs: ContainerLog[] | null = null,
        auditLogs:
            | {
                  method: string;
                  url: string;
              }[]
            | null = null,
        worker: Worker | null = null,
        executionStartedAt: string | null = null,
        executionEndedAt: string | null = null,
    ) {
        super(uuid, createdAt, updatedAt);
        this.image = image;
        this.state = state;
        this.stateCause = stateCause || '';
        this.artifactUrl = artifactUrl;
        this.artifacts = artifacts;
        this.mission = mission;
        this.logs = logs;
        this.auditLogs = auditLogs;
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

    static fromAPIResponse(response: any): Action {
        const mission = response.mission
            ? Mission.fromAPIResponse(response.mission)
            : null;
        const createdBy = User.fromAPIResponse(response.createdBy);
        const template = ActionTemplate.fromAPIResponse(response.template);
        const worker = response.worker
            ? Worker.fromAPIResponse(response.worker)
            : null;
        const logs = response.logs
            ? response.logs.map((log: any) => ({
                  timestamp: log.timestamp,
                  message: log.message,
                  type: log.type,
              }))
            : null;
        const auditLogs = response.auditLogs
            ? response.auditLogs.map((log: any) => ({
                  method: log.method,
                  url: log.url,
              }))
            : null;
        return new Action(
            response.uuid,
            new Date(response.createdAt),
            new Date(response.updatedAt),
            response.state,
            response.stateCause,
            response.artifactUrl,
            response.artifacts,
            mission,
            template,
            {
                sha: response.image.sha,
                repoDigests: response.image.repoDigests,
            },
            createdBy,
            logs,
            auditLogs,
            worker,
            response.executionStartedAt,
            response.executionEndedAt,
        );
    }
}

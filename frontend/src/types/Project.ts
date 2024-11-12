import { BaseEntity } from 'src/types/BaseEntity';
import { User } from 'src/types/User';
import { Mission } from 'src/types/Mission';
import { TagType } from 'src/types/TagType';
import { ProjectAccess } from 'src/types/ProjectAccess';

export class Project extends BaseEntity {
    name: string;
    description: string;
    missions: Mission[];
    requiredTags: TagType[];
    creator: User | null;
    projectAccesses: ProjectAccess[];

    constructor(
        uuid: string,
        name: string,
        description: string,
        missions: Mission[],
        creator: User | null,
        requiredTags: TagType[] | undefined,
        projectAccesses: ProjectAccess[] | undefined,
        createdAt: Date | null,
        updatedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt);
        this.name = name;
        this.creator = creator;
        this.missions = missions;
        this.description = description;
        this.requiredTags = requiredTags || [];
        this.projectAccesses = projectAccesses || [];
    }

    clone(): Project {
        return new Project(
            this.uuid,
            this.name,
            this.description,
            this.missions,
            this.creator,
            this.requiredTags,
            this.projectAccesses,
            this.createdAt,
            this.updatedAt,
        );
    }

    static fromAPIResponse(response: any): Project | null {
        if (!response) {
            return null;
        }
        const creator = User.fromAPIResponse(response.creator);
        let missions: Mission[] = [];
        if (response.missions) {
            missions = response.missions.map((mission: any) =>
                Mission.fromAPIResponse(mission),
            );
        }
        let projectAccesses: ProjectAccess[] = [];
        if (response.projectAccesses) {
            projectAccesses = response.projectAccesses.map(
                (projectAccess: any) =>
                    ProjectAccess.fromAPIResponse(projectAccess),
            );
        }
        let requiredTags: TagType[] = [];
        if (response.requiredTags) {
            requiredTags = response.requiredTags.map((tagType: any) =>
                TagType.fromAPIResponse(tagType),
            );
        }
        return new Project(
            response.uuid,
            response.name,
            response.description,
            missions,
            creator,
            requiredTags,
            projectAccesses,
            new Date(response.createdAt),
            new Date(response.updatedAt),
        );
    }
}

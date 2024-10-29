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
    creator?: User;
    projectAccesses: ProjectAccess[];

    constructor(
        uuid: string,
        name: string,
        description: string,
        missions: Mission[],
        creator: User | undefined,
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
}

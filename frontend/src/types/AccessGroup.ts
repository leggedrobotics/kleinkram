import { BaseEntity } from 'src/types/BaseEntity';
import { ProjectAccess } from 'src/types/ProjectAccess';
import { User } from 'src/types/User';
import { MissionAccess } from 'src/types/MissionAccess';

export class AccessGroup extends BaseEntity {
    name: string;
    users: User[];
    project_accesses: ProjectAccess[];
    mission_accesses: MissionAccess[];
    creator?: User;
    personal: boolean;
    inheriting: boolean;

    constructor(
        uuid: string,
        name: string,
        users: User[],
        project_accesses: ProjectAccess[],
        mission_accesses: MissionAccess[],
        personal: boolean,
        inheriting: boolean,
        creator: User | undefined,
        createdAt: Date,
        updatedAt: Date,
        deletedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);
        this.name = name;
        this.users = users;
        this.project_accesses = project_accesses;
        this.mission_accesses = mission_accesses;
        this.personal = personal;
        this.inheriting = inheriting;
        this.creator = creator;
    }
}

import { BaseEntity } from 'src/types/BaseEntity';
import { ProjectAccess } from 'src/types/ProjectAccess';
import { User } from 'src/types/User';
import { MissionAccess } from 'src/types/MissionAccess';

export class AccessGroup extends BaseEntity {
    name: string;
    users: User[];
    projectAccesses: ProjectAccess[];
    missionAccesses: MissionAccess[];
    creator?: User;
    personal: boolean;
    inheriting: boolean;

    constructor(
        uuid: string,
        name: string,
        users: User[],
        projectAccesses: ProjectAccess[],
        missionAccesses: MissionAccess[],
        personal: boolean,
        inheriting: boolean,
        creator: User | undefined,
        createdAt: Date,
        updatedAt: Date,
    ) {
        super(uuid, createdAt, updatedAt);
        this.name = name;
        this.users = users;
        this.projectAccesses = projectAccesses;
        this.missionAccesses = missionAccesses;
        this.personal = personal;
        this.inheriting = inheriting;
        this.creator = creator;
    }
}

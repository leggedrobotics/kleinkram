import { BaseEntity } from 'src/types/BaseEntity';
import { ProjectAccess } from 'src/types/ProjectAccess';
import { User } from 'src/types/User';
import { MissionAccess } from 'src/types/MissionAccess';
import { AccessGroupUser } from 'src/types/AccessGroupUser';

export class AccessGroup extends BaseEntity {
    name: string;
    accessGroupUsers: AccessGroupUser[];
    projectAccesses: ProjectAccess[];
    missionAccesses: MissionAccess[];
    creator?: User;
    personal: boolean;
    inheriting: boolean;

    constructor(
        uuid: string,
        name: string,
        accessGroupUsers: AccessGroupUser[],
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
        this.accessGroupUsers = accessGroupUsers;
        this.projectAccesses = projectAccesses;
        this.missionAccesses = missionAccesses;
        this.personal = personal;
        this.inheriting = inheriting;
        this.creator = creator;
    }

    static fromAPIResponse(response: any): AccessGroup {
        const accessGroupUsers =
            response.accessGroupUsers?.map((accessGroupUser: any) =>
                AccessGroupUser.fromAPIResponse(accessGroupUser),
            ) || [];
        const projectAccesses =
            response.projectAccesses?.map((projectAccess: any) =>
                ProjectAccess.fromAPIResponse(projectAccess),
            ) || [];
        const missionAccesses =
            response.missionAccesses?.map((missionAccess: any) =>
                MissionAccess.fromAPIResponse(missionAccess),
            ) || [];
        const creator = User.fromAPIResponse(response.creator);
        return new AccessGroup(
            response.uuid,
            response.name,
            accessGroupUsers,
            projectAccesses,
            missionAccesses,
            response.personal,
            response.inheriting,
            creator,
            new Date(response.createdAt),
            new Date(response.updatedAt),
        );
    }
}

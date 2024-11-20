import { BaseEntity } from 'src/types/BaseEntity';
import { ProjectAccess } from 'src/types/ProjectAccess';
import { User } from 'src/types/User';
import { MissionAccess } from 'src/types/MissionAccess';
import { GroupMembership } from 'src/types/AccessGroupUser';
import { AccessGroupType } from '@common/enum';

export class AccessGroup extends BaseEntity {
    name: string;
    memberships: GroupMembership[];
    projectAccesses: ProjectAccess[];
    missionAccesses: MissionAccess[];
    creator?: User;
    type: AccessGroupType;

    private constructor(
        uuid: string,
        name: string,
        memberships: GroupMembership[],
        projectAccesses: ProjectAccess[],
        missionAccesses: MissionAccess[],
        type: AccessGroupType,
        creator: User | undefined | null,
        createdAt: Date,
        updatedAt: Date,
    ) {
        super(uuid, createdAt, updatedAt);
        this.name = name;
        this.memberships = memberships;
        this.projectAccesses = projectAccesses;
        this.missionAccesses = missionAccesses;
        this.type = type;
        this.creator = creator;
    }

    static fromAPIResponse(response: any): AccessGroup {
        const memberships =
            response.memberships?.map((accessGroupUser: any) =>
                GroupMembership.fromAPIResponse(accessGroupUser),
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
            memberships,
            projectAccesses,
            missionAccesses,
            response.type,
            creator,
            new Date(response.createdAt),
            new Date(response.updatedAt),
        );
    }
}

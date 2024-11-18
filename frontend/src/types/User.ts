import ROLE from 'src/enums/USER_ROLES';
import { BaseEntity } from 'src/types/BaseEntity';
import { Project } from 'src/types/Project';
import { GroupMembership } from 'src/types/AccessGroupUser';

export class User extends BaseEntity {
    name: string;
    email: string;
    avatarUrl: string;
    role: ROLE;
    projects: Project[];
    memberships: GroupMembership[];

    private constructor(
        uuid: string,
        name: string,
        email: string,
        role: ROLE,
        avatarUrl: string,
        projects: Project[],
        memberships: GroupMembership[],
        createdAt: Date | null,
        updatedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt);
        this.name = name;
        this.email = email;
        this.role = role;
        this.projects = projects;
        this.memberships = memberships;
        this.avatarUrl = avatarUrl;
    }

    static fromAPIResponse(response: any): User | null {
        if (!response) {
            return null;
        }

        const projects: Project[] =
            response?.projects?.map((project: any) =>
                Project.fromAPIResponse(project),
            ) || [];

        console.log('response', response);

        const memberships: GroupMembership[] =
            response?.memberships?.map((_memberships: any) =>
                GroupMembership.fromAPIResponse(_memberships),
            ) || [];

        console.log('memberships', memberships);

        return new User(
            response.uuid,
            response.name,
            response.email,
            response.role,
            response.avatarUrl,
            projects,
            memberships,
            new Date(response.createdAt),
            new Date(response.updatedAt),
        );
    }
}

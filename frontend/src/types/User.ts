import ROLE from 'src/enums/USER_ROLES';
import { BaseEntity } from 'src/types/BaseEntity';
import { Project } from 'src/types/Project';
import { AccessGroupUser } from 'src/types/AccessGroupUser';

export class User extends BaseEntity {
    name: string;
    email: string;
    avatarUrl: string;
    role: ROLE;
    projects: Project[];
    accessGroupUsers: AccessGroupUser[];

    constructor(
        uuid: string,
        name: string,
        email: string,
        role: ROLE,
        avatarUrl: string,
        projects: Project[],
        accessGroupUsers: AccessGroupUser[],
        createdAt: Date | null,
        updatedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt);
        this.name = name;
        this.email = email;
        this.role = role;
        this.projects = projects;
        this.accessGroupUsers = accessGroupUsers;
        this.avatarUrl = avatarUrl;
    }

    static fromAPIResponse(response: any): User | null {
        if (!response) {
            return null;
        }
        let projects: Project[] = [];
        if (response.projects) {
            projects = response.projects.map((project: any) =>
                Project.fromAPIResponse(project),
            );
        }

        let accessGroupUsers: AccessGroupUser[] = [];
        if (response.accessGroupUsers) {
            accessGroupUsers = response.accessGroupUsers.map(
                (accessGroupUser: any) =>
                    AccessGroupUser.fromAPIResponse(accessGroupUser),
            );
        }
        return new User(
            response.uuid,
            response.name,
            response.email,
            response.role,
            response.avatarUrl,
            projects,
            accessGroupUsers,
            new Date(response.createdAt),
            new Date(response.updatedAt),
        );
    }
}

import ROLE from 'src/enums/USER_ROLES';
import { BaseEntity } from 'src/types/BaseEntity';
import { Project } from 'src/types/Project';
import { AccessGroup } from 'src/types/AccessGroup';

export class User extends BaseEntity {
    name: string;
    email: string;
    avatarUrl: string;
    role: ROLE;
    projects: Project[];
    accessGroups: AccessGroup[];

    constructor(
        uuid: string,
        name: string,
        email: string,
        role: ROLE,
        avatarUrl: string,
        projects: Project[],
        accessGroups: AccessGroup[],
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);
        this.name = name;
        this.email = email;
        this.role = role;
        this.projects = projects;
        this.accessGroups = accessGroups;
        this.avatarUrl = avatarUrl;
    }
}

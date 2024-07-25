import ROLE from 'src/enum/USER_ROLES';
import { BaseEntity } from 'src/types/BaseEntity';
import { Project } from 'src/types/Project';

export class User extends BaseEntity {
    name: string;
    email: string;
    role: ROLE;
    googleId: string;
    projects: Project[];

    constructor(
        uuid: string,
        name: string,
        email: string,
        role: ROLE,
        googleId: string,
        projects: Project[],
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);
        this.name = name;
        this.email = email;
        this.role = role;
        this.googleId = googleId;
        this.projects = projects;
    }
}

import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import AccessGroup from './accessgroup.entity';
import Project from '../project/project.entity';

import { AccessGroupRights } from '../../frontend_shared/enum';

@Unique('no_duplicated_access_groups_per_project', ['accessGroup', 'project'])
@Entity()
export default class ProjectAccess extends BaseEntity {
    @Column()
    rights!: AccessGroupRights;

    @ManyToOne(() => AccessGroup, (group) => group.project_accesses, {
        nullable: false,
    })
    accessGroup?: AccessGroup;

    @ManyToOne(() => Project, (project) => project.project_accesses, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        nullable: false,
    })
    project?: Project;

    get projectAccessDto() {
        if (this.accessGroup === undefined) {
            throw new Error('Access group not found');
        }

        if (this.accessGroup.memberships === undefined) {
            throw new Error('Access group has no memberships');
        }

        return {
            createdAt: this.createdAt,
            hidden: false,
            memberCount: this.accessGroup.memberships.length,
            type: this.accessGroup.type,
            updatedAt: this.updatedAt,
            name: this.accessGroup.name,
            rights: this.rights,
            uuid: this.accessGroup.uuid,
        };
    }
}

export const projectAccessEntityToDto = (projectAccess: ProjectAccess) => {
    if (projectAccess.accessGroup === undefined) {
        throw new Error('Access group not found');
    }

    if (projectAccess.accessGroup.memberships === undefined) {
        throw new Error('Access group has no memberships');
    }

    return {
        createdAt: projectAccess.createdAt,
        hidden: false,
        memberCount: projectAccess.accessGroup.memberships.length,
        type: projectAccess.accessGroup.type,
        updatedAt: projectAccess.updatedAt,
        name: projectAccess.accessGroup.name,
        rights: projectAccess.rights,
        uuid: projectAccess.accessGroup.uuid,
    };
};

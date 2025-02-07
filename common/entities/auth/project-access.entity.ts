import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import AccessGroup from './accessgroup.entity';
import Project from '../project/project.entity';

import { AccessGroupRights } from '../../frontend_shared/enum';
import { ProjectWithAccessRightsDto } from '../../api/types/project/project-access.dto';

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

    get projectsOfGroup(): ProjectWithAccessRightsDto {
        if (this.project === undefined) {
            throw new Error('Project not found');
        }

        return {
            uuid: this.project.uuid,
            name: this.project.name,
            description: this.project.description,
            createdAt: this.project.createdAt,
            updatedAt: this.project.updatedAt,
            rights: this.rights,
        };
    }

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

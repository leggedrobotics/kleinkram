import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import { AccessGroupRights } from '../../enum';
import AccessGroup from './accessgroup.entity';
import Project from '../project/project.entity';

@Unique('no_duplicated_access_groups_per_project', ['accessGroup', 'project'])
@Entity()
export default class ProjectAccess extends BaseEntity {
    @Column()
    rights: AccessGroupRights;

    @ManyToOne(() => AccessGroup, (group) => group.project_accesses)
    accessGroup: AccessGroup;

    @ManyToOne(() => Project, (project) => project.project_accesses, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    })
    project: Project;
}

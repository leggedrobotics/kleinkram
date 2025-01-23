import { Column, Entity, ManyToOne, OneToMany, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Action from './action.entity';
import User from '../user/user.entity';

import { AccessGroupRights } from '../../frontend_shared/enum';

import { ActionTemplateDto } from '../../api/types/actions/action-template.dto';

@Entity()
@Unique('unique_versioned_action_name', ['name', 'version'])
export default class ActionTemplate extends BaseEntity {
    @Column()
    image_name!: string;

    @Column()
    name!: string;

    @ManyToOne(() => User, (user) => user.templates)
    createdBy!: User;

    @Column({ nullable: true })
    command?: string;

    @OneToMany(() => Action, (action) => action.template)
    actions?: Action[];

    @Column({ default: 1 })
    version!: number;

    @Column({ default: false })
    searchable!: boolean;

    @Column()
    cpuCores!: number;

    @Column()
    cpuMemory!: number;

    @Column()
    gpuMemory!: number;

    @Column()
    maxRuntime!: number; // in hours

    @Column({ nullable: true })
    entrypoint?: string;

    @Column()
    accessRights!: AccessGroupRights;

    get actionTemplateDto(): ActionTemplateDto {
        return {
            uuid: this.uuid,
            accessRights: this.accessRights,
            command: this.command ?? '',
            cpuCores: this.cpuCores,
            cpuMemory: this.cpuMemory,
            entrypoint: this.entrypoint ?? '',
            gpuMemory: this.gpuMemory,
            imageName: this.image_name,
            maxRuntime: this.maxRuntime,
            createdAt: this.createdAt,
            name: this.name,
            version: this.version.toString(),
        };
    }
}

export const ActionTemplateEntityToDto = (
    actionTemplate: ActionTemplate,
): ActionTemplateDto => {
    return {
        uuid: actionTemplate.uuid,
        accessRights: actionTemplate.accessRights,
        command: actionTemplate.command ?? '',
        cpuCores: actionTemplate.cpuCores,
        cpuMemory: actionTemplate.cpuMemory,
        entrypoint: actionTemplate.entrypoint ?? '',
        gpuMemory: actionTemplate.gpuMemory,
        imageName: actionTemplate.image_name,
        maxRuntime: actionTemplate.maxRuntime,
        createdAt: actionTemplate.createdAt,
        name: actionTemplate.name,
        version: actionTemplate.version.toString(),
    };
};

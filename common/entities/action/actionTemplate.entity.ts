import { Column, Entity, ManyToOne, OneToMany, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Action from './action.entity';
import User from '../user/user.entity';

import { AccessGroupRights } from '../../frontend_shared/enum';
import { ActionTemplateDto } from '../../api/types/Actions.dto';

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
            accessRights: this.accessRights,
            command: this.command || '',
            cpuCores: this.cpuCores,
            cpuMemory: this.cpuMemory,
            entrypoint: this.entrypoint || '',
            gpuMemory: this.gpuMemory,
            imageName: this.image_name,
            maxRuntime: this.maxRuntime,
            name: this.name,
            version: this.version.toString(),
        };
    }
}

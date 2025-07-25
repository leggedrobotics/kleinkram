import { Column, Entity, ManyToOne, OneToMany, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import User from '../user/user.entity';
import Action from './action.entity';

import { AccessGroupRights } from '../../frontend_shared/enum';

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
}

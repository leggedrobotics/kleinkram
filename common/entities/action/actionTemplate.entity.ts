import { Column, Entity, ManyToOne, OneToMany, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Action, { Image } from './action.entity';
import User from '../user/user.entity';

@Entity()
@Unique(['name', 'version'])
export default class ActionTemplate extends BaseEntity {
    @Column()
    image_name: string;

    @Column()
    name: string;

    @ManyToOne(() => User, (user) => user.templates)
    createdBy: User;

    @Column({ nullable: true })
    command: string;

    @OneToMany(() => Action, (action) => action.template)
    actions: Action[];

    @Column({ default: 1 })
    version: number;

    @Column({ default: false })
    searchable: boolean;

    @Column()
    cpuCores: number;

    @Column()
    cpuMemory: number;

    @Column()
    gpuMemory: number;

    @Column()
    maxRuntime: number; // in hours
}

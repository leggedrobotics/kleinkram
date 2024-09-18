import { Column, Entity, ManyToOne, OneToMany, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import { RuntimeRequirements } from '../../types';
import Action, { Image } from './action.entity';
import User from '../user/user.entity';

@Entity()
@Unique(['name', 'version'])
export default class ActionTemplate extends BaseEntity {
    @Column({ type: 'json' })
    runtime_requirements: RuntimeRequirements;

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
}

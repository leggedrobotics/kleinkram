import { Column, Entity, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Action from '../action/action.entity';

@Entity()
export default class Worker extends BaseEntity {
    @Column({ unique: true })
    identifier: string;

    @Column()
    hostname: string;

    @Column()
    cpuMemory: number;

    @Column({ nullable: true })
    gpuModel: string;

    @Column({ default: -1 })
    gpuMemory: number;

    @Column()
    cpuCores: number;

    @Column()
    cpuModel: string;

    @Column()
    storage: number;

    @Column()
    lastSeen: Date;

    @Column()
    reachable: boolean;

    @OneToMany(() => Action, (action) => action.worker)
    actions: Action[];
}

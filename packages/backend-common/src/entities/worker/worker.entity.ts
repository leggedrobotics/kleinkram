import { ActionEntity } from '@backend-common/entities/action/action.entity';
import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { Column, Entity, OneToMany } from 'typeorm';

@Entity({ name: 'worker' })
export class WorkerEntity extends BaseEntity {
    @Column({ unique: true })
    identifier!: string;

    @Column()
    hostname!: string;

    @Column({ type: 'float' })
    cpuMemory!: number;

    @Column({ nullable: true })
    gpuModel?: string;

    @Column({ default: -1, type: 'float' })
    gpuMemory!: number;

    @Column()
    cpuCores!: number;

    @Column()
    cpuModel!: string;

    @Column()
    storage!: number;

    @Column()
    lastSeen!: Date;

    @Column()
    reachable!: boolean;

    @OneToMany(() => ActionEntity, (action: ActionEntity) => action.worker)
    actions?: ActionEntity[];
}

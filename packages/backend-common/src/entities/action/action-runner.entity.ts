import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { Column, Entity } from 'typeorm';

@Entity({ name: 'action_runner' })
export class ActionRunnerEntity extends BaseEntity {
    @Column()
    hostname!: string;

    @Column()
    version!: string;

    @Column()
    gitHash!: string;

    @Column()
    startedAt!: Date;

    @Column()
    lastSeenAt!: Date;
}

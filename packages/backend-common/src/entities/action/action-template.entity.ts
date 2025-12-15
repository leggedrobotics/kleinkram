import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { AccessGroupRights } from '@kleinkram/shared';
import { Column, Entity, ManyToOne, OneToMany, Unique } from 'typeorm';
import { ActionEntity } from './action.entity';

@Entity({ name: 'action_template' })
@Unique('unique_versioned_action_name', ['name', 'version'])
export class ActionTemplateEntity extends BaseEntity {
    @Column()

    // eslint-disable-next-line @typescript-eslint/naming-convention
    image_name!: string;

    @Column()
    name!: string;

    @Column({ default: '' })
    description!: string;

    @ManyToOne(() => UserEntity, (user) => user.templates)
    creator!: UserEntity;

    @Column({ nullable: true })
    command?: string;

    @OneToMany(() => ActionEntity, (action) => action.template)
    actions?: ActionEntity[];

    @Column({ default: 1 })
    version!: number;

    @Column({ default: false })
    isArchived!: boolean;

    @Column({ type: 'float' })
    cpuCores!: number;

    @Column({ type: 'float' })
    cpuMemory!: number;

    @Column({ type: 'float' })
    gpuMemory!: number;

    @Column({ type: 'float' })
    maxRuntime!: number; // in hours

    @Column({ nullable: true })
    entrypoint?: string;

    @Column({ type: 'enum', enum: AccessGroupRights })
    accessRights!: AccessGroupRights;

    // Add this (not a column, just for runtime data)
    executionCount?: number;
}

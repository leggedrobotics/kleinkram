import ActionEntity from '@backend-common/entities/action/action.entity';
import BaseEntity from '@backend-common/entities/base-entity.entity';
import UserEntity from '@backend-common/entities/user/user.entity';
import { AccessGroupRights } from '@kleinkram/shared';
import { Column, Entity, ManyToOne, OneToMany, Unique } from 'typeorm';

@Entity({ name: 'action_template' })
@Unique('unique_versioned_action_name', ['name', 'version'])
export default class ActionTemplateEntity extends BaseEntity {
    @Column()
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

    // Add this (not a column, just for runtime data)
    executionCount?: number;
}

import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { CategoryEntity } from '@backend-common/entities/category/category.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { TopicEntity } from '@backend-common/entities/topic/topic.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { FileOrigin, FileState, FileType } from '@kleinkram/shared';
import {
    Column,
    Entity,
    Index,
    JoinTable,
    ManyToMany,
    ManyToOne,
    OneToMany,
} from 'typeorm';

@Index('unique_file_name_per_mission', ['filename', 'mission'], {
    where: '"deletedAt" IS NULL',
    unique: true,
})
@Entity({ name: 'file_entity' })
export class FileEntity extends BaseEntity {
    @ManyToOne(() => MissionEntity, (mission: MissionEntity) => mission.files, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    mission?: MissionEntity;

    @Column()
    date!: Date;

    @OneToMany(() => TopicEntity, (topic: TopicEntity) => topic.file)
    topics?: TopicEntity[];

    @Column()
    filename!: string;

    @Column({
        type: 'bigint',
        transformer: {
            to: (value: number) => value,
            from: (value: string) => Number.parseInt(value, 10),
        },
    })
    size?: number;

    /**
     * The user who uploaded the file.
     */
    @ManyToOne(() => UserEntity, (user: UserEntity) => user.files, {
        nullable: false,
    })
    creator?: UserEntity;

    @Column({ type: 'enum', enum: FileType })
    type!: FileType;

    @Column({ type: 'enum', enum: FileState, default: FileState.OK })
    state!: FileState;

    @Column({ nullable: true })
    hash?: string;

    @ManyToMany(
        () => CategoryEntity,
        (category: CategoryEntity) => category.files,
    )
    @JoinTable()
    categories?: CategoryEntity[];

    /**
     * The parent file this file was derived from.
     * e.g., If this is a .mcap converted from a .bag, the .bag is the parent.
     */
    @ManyToOne(() => FileEntity, (file: FileEntity) => file.derivedFiles, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    parent?: FileEntity;

    /**
     * Files derived from this file.
     */
    @OneToMany(() => FileEntity, (file: FileEntity) => file.parent)
    derivedFiles?: FileEntity[];

    @Column({ type: 'enum', enum: FileOrigin, nullable: true })
    origin?: FileOrigin;
}

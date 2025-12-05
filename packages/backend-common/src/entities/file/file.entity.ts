import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { CategoryEntity } from '@backend-common/entities/category/category.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { TopicEntity } from '@backend-common/entities/topic/topic.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { FileOrigin, FileState, FileType } from '@kleinkram/shared';
import {
    Column,
    Entity,
    JoinTable,
    ManyToMany,
    ManyToOne,
    OneToMany,
    Unique,
} from 'typeorm';

@Entity({ name: 'file_entity' })
@Unique('unique_file_name_per_mission', ['filename', 'mission'])
export class FileEntity extends BaseEntity {
    @ManyToOne(() => MissionEntity, (mission) => mission.files, {
        nullable: false,
    })
    mission?: MissionEntity;

    @Column()
    date!: Date;

    @OneToMany(() => TopicEntity, (topic) => topic.file)
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
    @ManyToOne(() => UserEntity, (user) => user.files, { nullable: false })
    creator?: UserEntity;

    @Column({ type: 'enum', enum: FileType })
    type!: FileType;

    @Column({ type: 'enum', enum: FileState, default: FileState.OK })
    state!: FileState;

    @Column({ nullable: true })
    hash?: string;

    @ManyToMany(() => CategoryEntity, (category) => category.files)
    @JoinTable()
    categories?: CategoryEntity[];

    /**
     * The parent file this file was derived from.
     * e.g., If this is a .mcap converted from a .bag, the .bag is the parent.
     */
    @ManyToOne(() => FileEntity, (file) => file.derivedFiles, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    parent?: FileEntity;

    /**
     * Files derived from this file.
     */
    @OneToMany(() => FileEntity, (file) => file.parent)
    derivedFiles?: FileEntity[];

    @Column({ type: 'enum', enum: FileOrigin, nullable: true })
    origin?: FileOrigin;
}

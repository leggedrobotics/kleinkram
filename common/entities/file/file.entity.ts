import {
    Column,
    Entity,
    JoinColumn,
    JoinTable,
    ManyToMany,
    ManyToOne,
    OneToMany,
    OneToOne,
    Unique,
} from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Topic from '../topic/topic.entity';
import Mission from '../mission/mission.entity';
import User from '../user/user.entity';
import { FileOrigin, FileState, FileType } from '../../frontend_shared/enum';
import CategoryEntity from '../category/category.entity';
import { FileDto, FileWithTopicDto } from '../../api/types/file/file.dto';

@Entity()
@Unique('unique_file_name_per_mission', ['filename', 'mission'])
export default class FileEntity extends BaseEntity {
    @ManyToOne(() => Mission, (mission) => mission.files, { nullable: false })
    mission?: Mission;

    @Column()
    date!: Date;

    @OneToMany(() => Topic, (topic) => topic.file)
    topics?: Topic[];

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
    @ManyToOne(() => User, (user) => user.files, { nullable: false })
    creator?: User;

    @Column()
    type!: FileType;

    @Column({ default: FileState.OK })
    state!: FileState;

    @Column({ nullable: true })
    hash?: string;

    @ManyToMany(() => CategoryEntity, (category) => category.files)
    @JoinTable()
    categories?: CategoryEntity[];

    /**
     * Saves the reference to the bag or mcap file the current file was converted
     * to or from. May be null if the file was not converted or the reference is
     * not available.
     */
    @OneToOne(() => FileEntity, (file) => file.relatedFile, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'related_file_uuid' })
    relatedFile?: FileEntity;

    @Column({ nullable: true })
    origin?: FileOrigin;

    get fileDto(): FileDto {
        return fileEntityToDto(this);
    }

    get fileWithTopicDto(): FileWithTopicDto {
        return fileEntitiyToDtoWithTopic(this);
    }
}

export const fileEntityToDto = (file: FileEntity): FileDto => {
    if (!file.creator) {
        throw new Error('File creator is not set');
    }

    if (!file.mission) {
        throw new Error('File mission is not set');
    }

    return {
        uuid: file.uuid,
        state: file.state,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        date: file.date,
        filename: file.filename,
        type: file.type,
        size: file.size ?? 0,
        hash: file.hash ?? '',
        creator: file.creator.userDto,
        mission: file.mission.missionDto,
        categories:
            file.categories?.map((c) => ({
                uuid: c.uuid,
                name: c.name,
            })) ?? [],
    };
};

export const fileEntitiyToDtoWithTopic = (
    file: FileEntity,
): FileWithTopicDto => {
    if (!file.topics) {
        throw new Error('File topics are not set');
    }
    return {
        ...fileEntityToDto(file),
        topics: file.topics.map((topic) => topic.topicDto),
    };
};

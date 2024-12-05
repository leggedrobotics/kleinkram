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
import { FileDto } from '../../api/types/files/file.dto';

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
        if (!this.creator) {
            throw new Error('File creator is not set');
        }

        if (!this.mission) {
            throw new Error('File mission is not set');
        }

        return {
            uuid: this.uuid,
            state: this.state,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            date: this.date,
            filename: this.filename,
            type: this.type,
            size: this.size ?? 0,
            hash: this.hash ?? '',
            creator: this.creator.userDto,
            mission: this.mission.missionDto,
            topics: [],
            categories: [],
        };
    }
}

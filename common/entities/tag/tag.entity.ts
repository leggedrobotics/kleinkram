import { Column, Entity, ManyToOne } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import { DataType } from '../../enum';
import Mission from '../mission/mission.entity';
import TagType from '../tagType/tagType.entity';
import User from '../user/user.entity';

@Entity()
export default class Tag extends BaseEntity {
    @Column()
    STRING: string;

    @Column()
    NUMBER: number;

    @Column()
    BOOLEAN: boolean;

    @Column()
    DATE: Date;

    @Column()
    LOCATION: string;

    @ManyToOne(() => Mission, (mission) => mission.tags)
    mission: Mission;

    @ManyToOne(() => TagType, (tagType) => tagType.tags)
    tagType: TagType;

    @ManyToOne(() => User, (user) => user.tags)
    creator: User;
}

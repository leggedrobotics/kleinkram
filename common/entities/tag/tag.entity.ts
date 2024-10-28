import { Column, Entity, ManyToOne } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Mission from '../mission/mission.entity';
import TagType from '../tagType/tagType.entity';
import User from '../user/user.entity';

@Entity()
export default class Tag extends BaseEntity {
    @Column({ nullable: true })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    STRING: string;

    @Column({ nullable: true, type: 'double precision' })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    NUMBER: number;

    @Column({ nullable: true })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    BOOLEAN: boolean;

    @Column({ nullable: true })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    DATE: Date;

    @Column({ nullable: true })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    LOCATION: string;

    @ManyToOne(() => Mission, (mission) => mission.tags, {
        onDelete: 'CASCADE',
    })
    mission: Mission;

    @ManyToOne(() => TagType, (tagType) => tagType.tags, { eager: true })
    tagType: TagType;

    @ManyToOne(() => User, (user) => user.tags)
    creator: User;
}

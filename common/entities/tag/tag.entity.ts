import { Column, Entity, ManyToOne } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import { DataType } from '../../enum';
import Mission from '../mission/mission.entity';
import Project from '../project/project.entity';

@Entity()
export default class Tag extends BaseEntity {
    @Column()
    name: string;

    @Column()
    datatype: DataType;

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
}

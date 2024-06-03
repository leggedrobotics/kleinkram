import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import Mission from '../../mission/entities/mission.entity';
import User from '../../user/entities/user.entity';

@Entity()
export default class Project extends BaseEntity {
    @Column()
    name: string;

    @OneToMany(() => Mission, (mission) => mission.project)
    missions: Mission[];

    @Column({ nullable: true })
    description: string;

    @ManyToOne(() => User, (user) => user.projects)
    creator: User;
}

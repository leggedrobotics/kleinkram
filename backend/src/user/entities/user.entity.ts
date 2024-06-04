import { Column, Entity, OneToMany } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import { UserRole } from '../../enum';
import Project from '../../project/entities/project.entity';
import Mission from '../../mission/entities/mission.entity';
import File from '../../file/entities/file.entity';
import QueueEntity from '../../queue/entities/queue.entity';

@Entity()
export default class User extends BaseEntity {
    @Column()
    name: string;

    @Column()
    email: string;

    @Column()
    role: UserRole;

    @Column()
    googleId: string;

    @OneToMany(() => Project, (project) => project.creator)
    projects: Project[];

    @OneToMany(() => Mission, (mission) => mission.creator)
    missions: Mission[];

    @OneToMany(() => File, (file) => file.creator)
    files: File[];

    @OneToMany(() => QueueEntity, (queue) => queue.creator)
    queues: QueueEntity[];
}

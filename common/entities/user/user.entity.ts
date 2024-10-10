import {
    Column,
    Entity,
    JoinColumn,
    ManyToMany,
    OneToMany,
    OneToOne,
} from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Account from '../auth/account.entity';
import AccessGroup from '../auth/accessgroup.entity';
import Project from '../project/project.entity';
import Mission from '../mission/mission.entity';
import QueueEntity from '../queue/queue.entity';
import { UserRole } from '../../enum';
import FileEntity from '../file/file.entity';
import Tag from '../tag/tag.entity';
import Action from '../action/action.entity';
import ActionTemplate from '../action/actionTemplate.entity';
import Apikey from '../auth/apikey.entity';
import Category from '../category/category.entity';

@Entity()
export default class User extends BaseEntity {
    @Column()
    name: string;

    @Column({ unique: true })
    email: string;

    @Column()
    role: UserRole;

    @Column({ nullable: true })
    avatarUrl: string;

    @OneToOne(() => Account, (account) => account.user)
    @JoinColumn({ name: 'account_uuid' })
    account: Account;

    @ManyToMany(() => AccessGroup, (accessGroup) => accessGroup.users)
    accessGroups: AccessGroup[];

    @OneToMany(() => Project, (project) => project.creator)
    projects: Project[];

    @OneToMany(() => Mission, (mission) => mission.creator)
    missions: Mission[];

    @OneToMany(() => FileEntity, (file) => file.creator)
    files: FileEntity[];

    @OneToMany(() => QueueEntity, (queue) => queue.creator)
    queues: QueueEntity[];

    @OneToMany(() => Action, (action) => action.mission)
    submittedActions: Action[];

    @OneToMany(
        () => ActionTemplate,
        (actionTemplate) => actionTemplate.createdBy,
    )
    templates: ActionTemplate[];

    @OneToMany(() => Tag, (tag) => tag.creator)
    tags: Tag[];

    @OneToMany(() => Apikey, (apikey) => apikey.user)
    api_keys: Apikey[];

    @OneToMany(() => Category, (category) => category.creator)
    categories: Category[];
}

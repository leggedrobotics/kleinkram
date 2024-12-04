import { Column, Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Account from '../auth/account.entity';
import Project from '../project/project.entity';
import Mission from '../mission/mission.entity';
import QueueEntity from '../queue/queue.entity';
import { UserRole } from '../../frontend_shared/enum';
import FileEntity from '../file/file.entity';
import Tag from '../tag/tag.entity';
import Action from '../action/action.entity';
import ActionTemplate from '../action/actionTemplate.entity';
import Apikey from '../auth/apikey.entity';
import Category from '../category/category.entity';
import GroupMembership from '../auth/group_membership.entity';
import { UserDto } from '../../api/types/User.dto';

@Entity()
export default class User extends BaseEntity {
    /**
     * The name of the user. This is the name that will be displayed in the UI.
     * The name gets automatically extracted from the oauth provider.
     *
     * @example 'John Doe'
     */
    @Column()
    name!: string;

    /**
     * The email of the user. This is the email that will be displayed in the UI.
     * The email gets automatically extracted from the oauth provider.
     *
     * @example 'john.doe@example.com'
     *
     * The email is unique and cannot be changed.
     *
     */
    @Column({ unique: true, select: false, update: false })
    email?: string;

    /**
     * The role of the user. The role determines what the user can do in the application.
     *
     * @example 'USER'
     *
     * @see UserRole
     *
     */
    @Column({
        select: false,
        type: 'enum',
        enum: UserRole,
        default: UserRole.USER,
    })
    role?: UserRole;

    /**
     * A hidden user is not returned in any search queries.
     * Hidden users may still be accessed by their UUID (e.g., when
     * listing group memberships).
     *
     */
    @Column({
        select: false,
        default: false,
    })
    hidden?: boolean;

    /**
     * The avatar url of the user. This is the url of the avatar that will be displayed in the UI.
     * The avatar url gets automatically extracted from the oauth provider.
     *
     * @example 'https://example.com/avatar.jpg'
     */
    @Column({ nullable: true })
    avatarUrl?: string;

    @OneToOne(() => Account, (account) => account.user)
    @JoinColumn({ name: 'account_uuid' })
    account?: Account;

    @OneToMany(() => GroupMembership, (membership) => membership.user)
    memberships?: GroupMembership[];

    @OneToMany(() => Project, (project) => project.creator)
    projects?: Project[];

    @OneToMany(() => Mission, (mission) => mission.creator)
    missions?: Mission[];

    @OneToMany(() => FileEntity, (file) => file.creator)
    files?: FileEntity[];

    @OneToMany(() => QueueEntity, (queue) => queue.creator)
    queues?: QueueEntity[];

    @OneToMany(() => Action, (action) => action.mission)
    submittedActions?: Action[];

    @OneToMany(
        () => ActionTemplate,
        (actionTemplate) => actionTemplate.createdBy,
    )
    templates?: ActionTemplate[];

    @OneToMany(() => Tag, (tag) => tag.creator)
    tags?: Tag[];

    @OneToMany(() => Apikey, (apikey) => apikey.user)
    api_keys?: Apikey[];

    @OneToMany(() => Category, (category) => category.creator)
    categories?: Category[];

    get userDto(): UserDto {
        return {
            uuid: this.uuid,
            name: this.name,
            avatarUrl: this.avatarUrl ?? null,
        };
    }
}

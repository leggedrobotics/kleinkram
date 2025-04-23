import { Column, Entity, OneToOne, Unique } from 'typeorm';
import { Providers } from '../../frontend_shared/enum';
import BaseEntity from '../base-entity.entity';
import User from '../user/user.entity';

/**
 * Account entity class that represents the account of a user.
 * The account is used to authenticate the user.
 */
@Entity()
@Unique('provider_oauthID', ['provider', 'oauthID'])
export default class Account extends BaseEntity {
    @Column()
    provider!: Providers;

    @OneToOne(() => User, (user) => user.account, {
        onDelete: 'CASCADE',
    })
    user?: User;

    @Column()
    oauthID!: string;
}

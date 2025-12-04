import BaseEntity from '@backend-common/entities/base-entity.entity';
import UserEntity from '@backend-common/entities/user/user.entity';
import { Providers } from '@kleinkram/shared';
import { Column, Entity, OneToOne, Unique } from 'typeorm';

/**
 * Account entity class that represents the account of a user.
 * The account is used to authenticate the user.
 */
@Entity({ name: 'account' })
@Unique('provider_oauthID', ['provider', 'oauthID'])
export default class AccountEntity extends BaseEntity {
    @Column()
    provider!: Providers;

    @OneToOne(() => UserEntity, (user) => user.account, {
        onDelete: 'CASCADE',
    })
    user?: UserEntity;

    @Column()
    oauthID!: string;
}

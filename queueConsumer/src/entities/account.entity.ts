import { Column, Entity, OneToOne, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import User from './user.entity';
import { Providers } from '../enum';

@Entity()
@Unique('provider_oauthID', ['provider', 'oauthID'])
export default class Account extends BaseEntity {
    @Column()
    provider: Providers;

    @OneToOne(() => User, (user) => user.account)
    user: User;

    @Column()
    oauthID: string;

}

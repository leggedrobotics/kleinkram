import { Column, Entity, OneToOne } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import User from './user.entity';
import { AccountType } from '../enum';

@Entity()
export default class Account extends BaseEntity {
    @Column()
    type: AccountType;

    @OneToOne(() => User, (user) => user.account)
    user: User;

    @Column()
    oauthID: string;
}

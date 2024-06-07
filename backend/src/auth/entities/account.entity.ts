import { Column, Entity, OneToOne } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import { AccountType } from '../../enum';
import User from '../../user/entities/user.entity';

@Entity()
export default class Account extends BaseEntity {
    @Column()
    type: AccountType;

    @OneToOne(() => User, (user) => user.account)
    user: User;

    @Column()
    oauthID: string;
}

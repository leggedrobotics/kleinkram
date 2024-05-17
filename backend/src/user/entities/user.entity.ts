import { Column, Entity } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import { UserRole } from '../../enum';

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
}
